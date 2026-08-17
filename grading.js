import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, doc, setDoc, query, where 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ==========================================
// GLOBAL STATE
// ==========================================
let db = null;
let activeTemplate = null;
let currentStudents = [];
let commitDataMap = {}; // Maps studentId -> github fetch results
let firestoreGradesMap = {}; // Maps studentId -> saved firebase grades

let activeStartDateStr = "";
let activeEndDateStr = "";
// ==========================================
// LOADER UTILS
// ==========================================
window.showLoader = function(msg, subMsg = "") {
    document.getElementById('loaderMessage').textContent = msg;
    document.getElementById('loaderSubMessage').textContent = subMsg;
    document.getElementById('globalLoader').classList.remove('hidden');
    document.getElementById('globalLoader').classList.add('flex');
};
window.hideLoader = function() {
    document.getElementById('globalLoader').classList.add('hidden');
    document.getElementById('globalLoader').classList.remove('flex');
};
function getQuarter(monthStr) {
    const m = parseInt(monthStr);
    if (m >= 7 && m <= 9) return "Q1";
    if (m >= 10 && m <= 11 || m === 0) return "Q2";
    if (m >= 1 && m <= 3) return "Q3";
    return "Q4";
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    initRubric();
    initDateSelects();
});

function initFirebase() {
    const configStr = localStorage.getItem('repoReview_firebase_config');
    if (!configStr) {
        document.getElementById('gradingTableBody').innerHTML = `<tr><td colspan="6" class="py-8 text-center text-red-500 font-bold">Firebase not configured. Please visit the Admin Hub.</td></tr>`;
        return;
    }
    try {
        db = getFirestore(initializeApp(JSON.parse(configStr)));
        loadSections();
    } catch (e) {
        console.error(e);
    }
}

function initRubric() {
    const tplStr = localStorage.getItem('repoReview_grading_templates');
    const activeId = localStorage.getItem('repoReview_active_template_id');
    
    if (tplStr && activeId) {
        const templates = JSON.parse(tplStr);
        activeTemplate = templates.find(t => t.id === activeId) || templates[0];
    }
    
    if (!activeTemplate) {
        document.getElementById('activeRubricLabel').textContent = "WARNING: No Rubric Found!";
        document.getElementById('activeRubricLabel').classList.replace('text-purple-600', 'text-red-600');
    } else {
        document.getElementById('activeRubricLabel').textContent = activeTemplate.name;
    }
}

function initDateSelects() {
    const currentYear = new Date().getFullYear();
    const yearSelect = document.getElementById('yearSelect');
    for (let i = currentYear - 2; i <= currentYear + 1; i++) {
        yearSelect.insertAdjacentHTML('beforeend', `<option value="${i}" ${i === currentYear ? 'selected' : ''}>${i}</option>`);
    }

    const today = new Date();
    document.getElementById('monthSelect').value = today.getMonth();
    const day = today.getDate();
    document.getElementById('weekSelect').value = day <= 7 ? "1" : day <= 14 ? "2" : day <= 21 ? "3" : "4";
    updateDateScope();
}
function updateQuotaDisplay() {
    const today = new Date().toISOString().split('T')[0];
    let usage = JSON.parse(localStorage.getItem('repoReview_ai_usage') || '{"date": "", "count": 0}');
    
    // Reset counter if it is a new day
    if (usage.date !== today) {
        usage = { date: today, count: 0 };
        localStorage.setItem('repoReview_ai_usage', JSON.stringify(usage));
    }
    
    const display = document.getElementById('aiQuotaDisplay');
    if (display) {
        display.textContent = `${usage.count} / 1500`;
        if (usage.count >= 1400) display.classList.add('text-red-600'); // Warning color near limit
    }
    return usage;
}

function incrementAiQuota() {
    const usage = updateQuotaDisplay();
    usage.count++;
    localStorage.setItem('repoReview_ai_usage', JSON.stringify(usage));
    updateQuotaDisplay();
}

// Ensure the display updates when the page loads
document.addEventListener('DOMContentLoaded', () => {
    updateQuotaDisplay();
});

window.updateDateScope = function() {
    const y = parseInt(document.getElementById('yearSelect').value);
    const m = parseInt(document.getElementById('monthSelect').value);
    const w = parseInt(document.getElementById('weekSelect').value);

    let startDay = 1, endDay = 7;
    if (w === 2) { startDay = 8; endDay = 14; }
    if (w === 3) { startDay = 15; endDay = 21; }
    if (w === 4) { startDay = 22; endDay = new Date(y, m + 1, 0).getDate(); }

    const sDate = new Date(y, m, startDay);
    const eDate = new Date(y, m, endDay);
    
    const offsetStart = sDate.getTimezoneOffset() * 60000;
    const offsetEnd = eDate.getTimezoneOffset() * 60000;
    
    activeStartDateStr = new Date(sDate.getTime() - offsetStart).toISOString().split('T')[0];
    activeEndDateStr = new Date(eDate.getTime() - offsetEnd).toISOString().split('T')[0];

    const opts = { month: 'short', day: 'numeric', year: 'numeric' };
    document.getElementById('dateScopeDisplay').textContent = `${sDate.toLocaleDateString('en-US', opts)} - ${eDate.toLocaleDateString('en-US', opts)}`;
    
    // Clear table if date changes to prevent grading wrong weeks
    document.getElementById('gradingTableBody').innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-400 italic">Date changed. Please fetch commits again.</td></tr>`;
    document.getElementById('publishAllBtn').classList.add('hidden');
};

async function loadSections() {
    if (!db) return;
    try {
        const snap = await getDocs(collection(db, "sections"));
        const select = document.getElementById('sectionSelect');
        select.innerHTML = '';
        snap.forEach(d => {
            select.insertAdjacentHTML('beforeend', `<option value="${d.data().name}">${d.data().name}</option>`);
        });
    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// FETCHING DATA (GITHUB + FIRESTORE)
// ==========================================
window.fetchSectionCommits = async function() {
    const ghToken = localStorage.getItem('repoReview_github_token');
    if (!ghToken) return alert("Missing GitHub PAT. Configure it in Admin Hub.");
    if (!db) return alert("Firebase not connected.");

    const section = document.getElementById('sectionSelect').value;
    if (!section) return alert("Please select a section.");

    const year = parseInt(document.getElementById('yearSelect').value);
    const month = parseInt(document.getElementById('monthSelect').value);
    const week = parseInt(document.getElementById('weekSelect').value);

    window.showLoader(`Fetching students in ${section}...`);

    try {
        // 1. Get Students in Section
        const qStudents = query(collection(db, "students"), where("section", "==", section));
        const stuSnap = await getDocs(qStudents);
        currentStudents = [];
        stuSnap.forEach(d => currentStudents.push({ id: d.id, ...d.data() }));

        if (currentStudents.length === 0) {
            document.getElementById('gradingTableBody').innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-500">No students found in this section.</td></tr>`;
            return window.hideLoader();
        }

        // 2. Fetch existing Firebase Grades for this exact Week
        window.showLoader("Syncing historical grades from Firebase...");
        firestoreGradesMap = {};
        const qGrades = query(
            collection(db, "grades"), 
            where("section", "==", section), where("year", "==", year), where("month", "==", month), where("week", "==", week)
        );
        const gradeSnap = await getDocs(qGrades);
        gradeSnap.forEach(d => {
            const g = d.data();
            firestoreGradesMap[g.studentId] = { docId: d.id, ...g };
        });

        // 3. Fetch GitHub Commits
        commitDataMap = {};
        let processed = 0;
        
        for (let student of currentStudents) {
            processed++;
            window.showLoader(`Fetching GitHub Data...`, `Checking repos: ${processed} of ${currentStudents.length}`);
            
            commitDataMap[student.id] = { count: 0, additions: 0, deletions: 0, latestMsg: "No commits", patches: "", commitSha: null, error: null };
            
            if (!student.repoUrl) {
                commitDataMap[student.id].error = "Missing Repo URL";
                continue;
            }

            try {
                let owner, repo;
                const urlParts = student.repoUrl.replace(/\/$/, '').replace('.git', '').split('/');
                repo = urlParts.pop(); owner = urlParts.pop();

                const since = new Date(activeStartDateStr + 'T00:00:00Z').toISOString();
                const until = new Date(activeEndDateStr + 'T23:59:59Z').toISOString();
                
                const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&until=${until}`, {
                    headers: { 'Authorization': `Bearer ${ghToken}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
                });

                if (!response.ok) {
                    commitDataMap[student.id].error = response.status === 404 ? "Repo Not Found / Private" : `HTTP ${response.status}`;
                    continue;
                }

                const commits = await response.json();
                commitDataMap[student.id].count = commits.length;
                if (commits.length > 0) {
                    // Grab the SHA of the most recent commit in this window for commenting
                    commitDataMap[student.id].commitSha = commits[0].sha;
                    commitDataMap[student.id].latestMsg = commits[0].commit.message;
                    commitDataMap[student.id].allMsgs = commits.map(c => c.commit.message);
                    
                    // Fetch code diffs (Only checking first 5 to prevent overload)
                    const limit = Math.min(commits.length, 5);
                    for (let i = 0; i < limit; i++) {
                        const detailRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${commits[i].sha}`, { headers: { 'Authorization': `Bearer ${ghToken}` }});
                        if (detailRes.ok) {
                            const detail = await detailRes.json();
                            if (detail.stats) {
                                commitDataMap[student.id].additions += detail.stats.additions;
                                commitDataMap[student.id].deletions += detail.stats.deletions;
                            }
                            if (detail.files) {
                                detail.files.forEach(file => {
                                    // Skip giant non-code files
                                    if (file.patch && !file.filename.match(/\.(png|jpg|exe|zip|svg|lock)$/i)) {
                                        commitDataMap[student.id].patches += `\n--- ${file.filename} ---\n${file.patch}\n`;
                                    }
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                commitDataMap[student.id].error = err.message;
            }
        }

        renderGradingTable();
        document.getElementById('publishAllBtn').classList.remove('hidden');

    } catch (e) {
        console.error(e);
        alert("Critical Error: " + e.message);
    } finally {
        window.hideLoader();
    }
};

function renderGradingTable() {
    const tbody = document.getElementById('gradingTableBody');
    tbody.innerHTML = '';

    currentStudents.forEach(student => {
        const ghData = commitDataMap[student.id];
        const dbGrade = firestoreGradesMap[student.id];

        let feedbackHtml = `<span class="text-gray-400 italic">Not graded</span>`;
        let gradeBtnTxt = "Grade via AI";
        let publishBtnHtml = "";

        if (dbGrade) {
            feedbackHtml = `
                <div class="mb-1"><strong class="text-purple-700">Score: ${dbGrade.score}/${dbGrade.maxScore}</strong></div>
                <div class="text-gray-700 text-xs leading-relaxed max-h-16 overflow-y-auto">${dbGrade.feedback}</div>
            `;
            gradeBtnTxt = "Regrade via AI";
            
            if (dbGrade.publishedToGithub) {
                publishBtnHtml = `<span class="bg-green-100 text-green-700 border border-green-300 font-bold px-3 py-1.5 rounded text-xs block text-center mt-2 shadow-sm">✅ Published</span>`;
            } else if (dbGrade.commitSha) {
                publishBtnHtml = `<button onclick="publishSingle('${student.id}')" class="w-full bg-blue-100 text-blue-700 border border-blue-300 font-semibold px-3 py-1.5 rounded text-xs hover:bg-blue-600 hover:text-white transition shadow-sm mt-2">🚀 Publish to Repo</button>`;
            }
        }

        let commitDisplay = ghData.error 
            ? `<span class="text-red-500 text-xs font-bold">${ghData.error}</span>`
            : `<span class="${ghData.count === 0 ? 'text-red-500' : 'text-green-600'} font-bold">${ghData.count}</span>`;

        let actionBtns = ghData.count > 0 
            ? `<div class="flex flex-col gap-2 w-full">
                <button onclick="openDetails('${student.id}')" class="bg-gray-100 text-gray-700 border border-gray-300 font-semibold px-3 py-1.5 rounded text-xs hover:bg-gray-200 transition shadow-sm text-left">📄 View Code</button>
                <button onclick="gradeCode('${student.id}')" class="bg-purple-100 text-purple-700 border border-purple-300 font-semibold px-3 py-1.5 rounded text-xs hover:bg-purple-600 hover:text-white transition shadow-sm text-left">🤖 ${gradeBtnTxt}</button>
               </div>`
            : `<span class="text-xs text-gray-400 font-bold block text-center">No Data</span>`;

        const tr = `
            <tr class="border-b hover:bg-gray-50">
                <td class="py-3 px-4">
                    <div class="font-bold text-gray-800">${student.name}</div>
                    <div class="text-xs text-gray-500">${student.githubUsername}</div>
                </td>
                <td class="py-3 px-4">${commitDisplay}</td>
                <td class="py-3 px-4 text-xs font-mono"><span class="text-green-600">+${ghData.additions}</span> | <span class="text-red-500">-${ghData.deletions}</span></td>
                <td class="py-3 px-4 text-xs text-gray-600 truncate max-w-[200px]" title="${ghData.latestMsg}">${ghData.latestMsg}</td>
                <td class="py-3 px-4 text-xs" id="fb-${student.id}">${feedbackHtml}</td>
                <td class="py-3 px-4 align-top">
                    ${actionBtns}
                    <div id="pub-${student.id}">${publishBtnHtml}</div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', tr);
    });
}

// ==========================================
// MODALS
// ==========================================
window.openDetails = function(studentId) {
    const student = currentStudents.find(s => s.id === studentId);
    const data = commitDataMap[studentId];
    if (!student || !data) return;

    document.getElementById('detailsTitle').textContent = `${student.name}'s Code`;
    document.getElementById('detCommits').textContent = data.count;
    document.getElementById('detAdded').textContent = "+" + data.additions;
    document.getElementById('detDeleted').textContent = "-" + data.deletions;
    document.getElementById('detCommitList').innerHTML = data.allMsgs ? data.allMsgs.map(m => `<li>${m}</li>`).join('') : "";
    document.getElementById('detCodeBlock').textContent = data.patches || "No code readable code changes recorded.";
    
    document.getElementById('detailsModal').classList.remove('hidden');
};
window.closeDetailsModal = function() { document.getElementById('detailsModal').classList.add('hidden'); };
window.closeAiModal = function() { document.getElementById('aiModal').classList.add('hidden'); };

// ==========================================
// STRICT AI GRADING
// ==========================================
window.gradeCode = async function(studentId) {
    const gemKey = localStorage.getItem('repoReview_gemini_token');
    const model = localStorage.getItem('repoReview_ai_model') || 'gemini-3.5-flash';
    if (!gemKey) return alert("Missing Gemini API Key.");

    const student = currentStudents.find(s => s.id === studentId);
    const data = commitDataMap[studentId];

    if (!data.patches || data.patches.trim() === "") {
        return alert("No code patches available to grade. Student may have only committed non-code files.");
    }

    if (!activeTemplate) return alert("No active rubric equipped.");

    const isPct = activeTemplate.scoringType === 'percentage';
    const criteriaText = activeTemplate.criteria.map(c => `- ${c.name} (${c.weight}${isPct ? '%' : ' pts'}): ${c.description}`).join('\n');
    const maxScore = isPct ? 100 : activeTemplate.criteria.reduce((sum, c) => sum + Number(c.weight || 0), 0);

    const prompt = `
${activeTemplate.generalPrompt}
You are a strict Computer Programming Professor grading a student's weekly commits. Review the following GitHub diff patches.

CRITICAL INSTRUCTIONS:
1. DO NOT use conversational filler. Be blunt and direct.
2. Evaluate the code against the provided criteria and assign a specific score for each.
3. Output MUST be strictly in the following JSON format:
{
    "total_score": <number>,
    "breakdown": [
        { "criterion": "<Name of Criterion>", "score": <number>, "max": <number> }
    ],
    "feedback_criteria": "<Bullet points explaining the deductions and errors based strictly on the criteria>",
    "additional_feedback": "<1-2 sentences of factual praise, missing logic, or extra context>",
    "optional_suggestion": "<1 bullet point for best practices>"
}

Grade out of a maximum total score of ${maxScore}.
Criteria:
${criteriaText}

Student Code:
${data.patches.substring(0, 30000)}
`;

    window.showLoader(`AI Analyzing Code for ${student.name}...`, "Applying strict grading rubrics.");

    try {
        const currentUsage = updateQuotaDisplay();
        if (currentUsage.count >= 1500) {
            throw new Error("Daily AI Quota Reached (1500/1500). Please wait until tomorrow to grade more students.");
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    response_mime_type: "application/json",
                    temperature: 0.0 
                }
            })
        });

        if (!response.ok) {
            if (response.status === 429) throw new Error("Rate Limit Exceeded. You are clicking too fast. Wait 60 seconds.");
            throw new Error("Gemini API Error: " + response.statusText);
        }
        
        incrementAiQuota();
        
        const aiResult = await response.json();
        const rawJson = aiResult.candidates[0].content.parts[0].text;
        const gradeData = JSON.parse(rawJson);

        // Format the feedback for the Dashboard UI
        let formattedFeedback = `<div class="space-y-2">`;
        formattedFeedback += `<div><strong class="text-gray-800">Criteria Breakdown:</strong><br>`;
        gradeData.breakdown.forEach(b => {
            formattedFeedback += `<span class="text-gray-600">- ${b.criterion}: ${b.score}/${b.max}</span><br>`;
        });
        formattedFeedback += `</div>`;
        formattedFeedback += `<div><strong class="text-gray-800">Feedback based on criteria:</strong><br><span class="text-gray-600">${gradeData.feedback_criteria.replace(/\n/g, '<br>')}</span></div>`;
        formattedFeedback += `<div><strong class="text-gray-800">Additional feedback:</strong><br><span class="text-gray-600">${gradeData.additional_feedback.replace(/\n/g, '<br>')}</span></div>`;
        formattedFeedback += `<div><strong class="text-gray-800">Optional Suggestion:</strong><br><span class="text-gray-600">${gradeData.optional_suggestion.replace(/\n/g, '<br>')}</span></div>`;
        formattedFeedback += `</div>`;

        const y = parseInt(document.getElementById('yearSelect').value);
        const m = parseInt(document.getElementById('monthSelect').value);
        const w = parseInt(document.getElementById('weekSelect').value);
        const quarter = getQuarter(document.getElementById('monthSelect').value);
        
        const gradeDocId = `${student.id}_${y}_m${m}_w${w}`; 
        
        const dbEntry = {
            studentId: student.id,
            section: student.section,
            githubUsername: student.githubUsername,
            year: y,
            month: m,
            week: w,
            quarter: quarter,
            score: gradeData.total_score,
            maxScore: maxScore,
            feedback: formattedFeedback, // Saved for dashboard display
            rawAiData: gradeData, // Saved as raw JSON so GitHub publisher can build clean markdown
            publishedToGithub: false,
            commitSha: data.commitSha
        };

        await setDoc(doc(db, "grades", gradeDocId), dbEntry);
        
        // Update Local State
        firestoreGradesMap[student.id] = { docId: gradeDocId, ...dbEntry };
        
        // Show Modal
        document.getElementById('aiStudentName').textContent = `Graded: ${student.name}`;
        document.getElementById('aiScore').textContent = gradeData.score;
        document.getElementById('aiScoreMax').textContent = `/${maxScore}`;
        document.getElementById('aiFeedback').innerHTML = formattedFeedback;
        document.getElementById('aiModal').classList.remove('hidden');

        renderGradingTable(); // Refresh UI with new data
    } catch (err) {
        alert("AI Grading failed: " + err.message);
    } finally {
        window.hideLoader();
    }
};

// ==========================================
// PUBLISHING (GITHUB API) & CONFIRMATION
// ==========================================

let pendingPublishAction = null; // Tracks if we are confirming a 'single' or 'bulk' publish

async function postCommentToGithub(student, gradeRec) {
    const ghToken = localStorage.getItem('repoReview_github_token');
    let owner, repo;
    
    try {
        const cleanUrl = student.repoUrl.trim().replace(/\/$/, '').replace('.git', '');
        const urlParts = cleanUrl.split('/');
        repo = urlParts.pop(); 
        owner = urlParts.pop();
        if (!owner || !repo) throw new Error("Invalid URL format");
    } catch (e) {
        throw new Error(`Could not parse owner/repo from URL: ${student.repoUrl}`);
    }

    // Translate the month index back to the Month Name
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const targetMonthName = monthNames[gradeRec.month];
    const targetWeek = `Week ${gradeRec.week}`;

    // Generate the current Timestamp
    const publishTimestamp = new Date().toLocaleString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: 'numeric', minute: 'numeric', hour12: true 
    });

    let commentBody = `### ${targetMonthName} ${targetWeek}\n\n`;

    // Construct the detailed Markdown if the new rawAiData exists
    if (gradeRec.rawAiData) {
        const ai = gradeRec.rawAiData;
        
        // Breakdown
        ai.breakdown.forEach(b => {
            commentBody += `**${b.criterion}:** ${b.score}/${b.max}\n`;
        });
        
        // Total
        commentBody += `\n**Total Score: ${ai.total_score} / ${gradeRec.maxScore}**\n\n`;
        
        // Feedback Sections
        commentBody += `**Feedback based on criteria:**\n${ai.feedback_criteria}\n\n`;
        commentBody += `**Additional feedback:**\n${ai.additional_feedback}\n\n`;
        commentBody += `**Optional Suggestion:**\n${ai.optional_suggestion}\n\n`;
    } else {
        // Fallback for older grades generated before this update
        const mdFeedback = gradeRec.feedback.replace(/<br>/g, '\n').replace(/<[^>]*>?/gm, '');
        commentBody += `**Score:** ${gradeRec.score} / ${gradeRec.maxScore}\n\n${mdFeedback}\n\n`;
    }

    commentBody += `*Graded via RepoReview System (${publishTimestamp})*`;

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${gradeRec.commitSha}/comments`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ghToken}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({ body: commentBody })
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const ghErrorMsg = errorData.message || res.statusText;
        throw new Error(`GitHub says: "${ghErrorMsg}"`);
    }
    
    // Mark as published in Firestore
    await setDoc(doc(db, "grades", gradeRec.docId), { publishedToGithub: true }, { merge: true });
    firestoreGradesMap[student.id].publishedToGithub = true;
}

window.publishSingle = function(studentId) {
    const student = currentStudents.find(s => s.id === studentId);
    const gradeRec = firestoreGradesMap[studentId];

    if (!gradeRec || !gradeRec.commitSha) return alert("Cannot publish: No valid commit SHA found to attach comment.");

    // Store the pending action
    pendingPublishAction = { type: 'single', studentId: studentId };

    // Setup Modal Text
    document.getElementById('publishConfirmWarning').innerHTML = `You are about to publish the AutoGrader report for <strong class="text-gray-900">${student.name}</strong>. <br><br>Once published, GitHub will instantly email this student the feedback and score below.`;
    
    document.getElementById('publishConfirmScore').textContent = `${gradeRec.score} / ${gradeRec.maxScore}`;
    document.getElementById('publishConfirmFeedback').innerHTML = gradeRec.feedback;
    
    // Show Preview Box
    document.getElementById('publishConfirmPreview').classList.remove('hidden');

    // Link the execute button and open modal
    document.getElementById('executePublishBtn').onclick = executePublish;
    document.getElementById('publishConfirmModal').classList.remove('hidden');
};

window.publishAllGrades = function() {
    const pendingQueue = currentStudents.filter(s => {
        const g = firestoreGradesMap[s.id];
        return g && g.commitSha && !g.publishedToGithub;
    });

    if (pendingQueue.length === 0) return alert("No pending grades to publish. Ensure students are graded first.");

    // Store the pending bulk action
    pendingPublishAction = { type: 'bulk', queue: pendingQueue };

    // Setup Modal Text
    document.getElementById('publishConfirmWarning').innerHTML = `You are about to batch publish AutoGrader reports to <strong class="text-red-600 text-lg">${pendingQueue.length} student repositories</strong>.<br><br>⚠️ <strong class="text-gray-900">WARNING:</strong> GitHub will instantly blast an email to all ${pendingQueue.length} students containing their individual feedback. Are you absolutely sure the grades are finalized?`;
    
    // Hide Preview Box for Bulk
    document.getElementById('publishConfirmPreview').classList.add('hidden');
    
    // Link the execute button and open modal
    document.getElementById('executePublishBtn').onclick = executePublish;
    document.getElementById('publishConfirmModal').classList.remove('hidden');
};

window.closePublishConfirmModal = function() {
    document.getElementById('publishConfirmModal').classList.add('hidden');
    pendingPublishAction = null;
};

// The function that runs when you click "Yes, Publish" inside the Modal
async function executePublish() {
    const action = pendingPublishAction;
    closePublishConfirmModal(); // Hide modal immediately

    if (action.type === 'single') {
        const student = currentStudents.find(s => s.id === action.studentId);
        const gradeRec = firestoreGradesMap[action.studentId];
        
        window.showLoader(`Publishing to GitHub...`, student.name);
        try {
            await postCommentToGithub(student, gradeRec);
            renderGradingTable();
        } catch (e) {
            alert("Failed to publish: " + e.message);
        } finally {
            window.hideLoader();
        }
    } 
    else if (action.type === 'bulk') {
        const pendingQueue = action.queue;
        window.showLoader("Initializing Batch Publish...", "Connecting to GitHub API...");
        
        let successCount = 0;
        for (let i = 0; i < pendingQueue.length; i++) {
            const student = pendingQueue[i];
            const gradeRec = firestoreGradesMap[student.id];
            
            window.showLoader(`Publishing: ${i + 1} / ${pendingQueue.length}`, `Target: ${student.name}`);
            
            try {
                await postCommentToGithub(student, gradeRec);
                successCount++;
                // Artificial delay (1.5 seconds) to avoid GitHub spam filters
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (e) {
                console.error(`Failed on ${student.name}:`, e);
            }
        }

        window.hideLoader();
        renderGradingTable();
        alert(`Batch Complete: Published ${successCount} out of ${pendingQueue.length} comments.`);
    }
}