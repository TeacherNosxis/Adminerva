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
// LOADER UTILS & QUOTA
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
function buildFeedbackHtml(gradeData, maxScore) {
    let html = `<div class="space-y-1">`;
    html += `<div class="font-extrabold text-lg text-gray-800 border-b pb-1 mb-2">Total: ${gradeData.total_score} / ${maxScore}</div>`;
    if (gradeData.breakdown) {
        gradeData.breakdown.forEach(b => {
            html += `<div class="text-gray-700 font-semibold">${b.criterion}: ${b.score}/${b.max}</div>`;
        });
    }
    html += `<div class="mt-4"><strong class="text-gray-800 uppercase text-[10px] tracking-wider">Feedback based on criteria:</strong><br><span class="text-gray-600 text-sm leading-relaxed">${(gradeData.feedback_criteria || "None").replace(/\n/g, '<br>')}</span></div>`;
    html += `<div class="mt-2"><strong class="text-gray-800 uppercase text-[10px] tracking-wider">Additional feedback:</strong><br><span class="text-gray-600 text-sm leading-relaxed">${(gradeData.additional_feedback || "None").replace(/\n/g, '<br>')}</span></div>`;
    html += `<div class="mt-2"><strong class="text-gray-800 uppercase text-[10px] tracking-wider">Optional Suggestion:</strong><br><span class="text-gray-600 text-sm leading-relaxed">${(gradeData.optional_suggestion || "None").replace(/\n/g, '<br>')}</span></div>`;
    html += `</div>`;
    return html;
}

function updateQuotaDisplay() {
    const today = new Date().toISOString().split('T')[0];
    let usage = JSON.parse(localStorage.getItem('repoReview_ai_usage') || '{"date": "", "count": 0}');
    
    if (usage.date !== today) {
        usage = { date: today, count: 0 };
        localStorage.setItem('repoReview_ai_usage', JSON.stringify(usage));
    }
    
    const display = document.getElementById('aiQuotaDisplay');
    if (display) {
        display.textContent = `${usage.count} / 1500`;
        if (usage.count >= 1400) display.classList.add('text-red-600');
    }
    return usage;
}

function incrementAiQuota() {
    const usage = updateQuotaDisplay();
    usage.count++;
    localStorage.setItem('repoReview_ai_usage', JSON.stringify(usage));
    updateQuotaDisplay();
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    initRubric();
    initDateSelects();
    updateQuotaDisplay();
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
        const qStudents = query(collection(db, "students"), where("section", "==", section));
        const stuSnap = await getDocs(qStudents);
        currentStudents = [];
        stuSnap.forEach(d => currentStudents.push({ id: d.id, ...d.data() }));

        if (currentStudents.length === 0) {
            document.getElementById('gradingTableBody').innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-500">No students found in this section.</td></tr>`;
            return window.hideLoader();
        }

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
                    commitDataMap[student.id].commitSha = commits[0].sha;
                    commitDataMap[student.id].latestMsg = commits[0].commit.message;
                    commitDataMap[student.id].allMsgs = commits.map(c => c.commit.message);
                    
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

        let actionBtns = ghData.count > 0 
            ? `<div class="flex flex-col gap-1.5 w-full">
                <button onclick="openDetails('${student.id}')" class="bg-gray-100 text-gray-700 border border-gray-300 font-semibold px-2 py-1 rounded text-[10px] hover:bg-gray-200 transition shadow-sm text-left">📄 View Code</button>
                <button onclick="gradeCode('${student.id}')" class="bg-purple-100 text-purple-700 border border-purple-300 font-semibold px-2 py-1 rounded text-[10px] hover:bg-purple-600 hover:text-white transition shadow-sm text-left">🤖 ${gradeBtnTxt}</button>
                ${dbGrade ? `<button onclick="openEditModal('${student.id}')" class="bg-amber-100 text-amber-700 border border-amber-300 font-semibold px-2 py-1 rounded text-[10px] hover:bg-amber-600 hover:text-white transition shadow-sm text-left w-full">✏️ Manual Edit</button>` : ''}
               </div>`
            : `<span class="text-[10px] text-gray-400 font-bold block text-center">No Data</span>`;

        if (dbGrade) {
            feedbackHtml = `
                <div class="mb-1 flex items-center gap-2">
                    <strong class="text-purple-700 text-sm">Score: ${dbGrade.score}/${dbGrade.maxScore}</strong>
                </div>
                <div class="text-gray-700 text-[11px] leading-relaxed max-h-24 overflow-y-auto pr-1">${dbGrade.feedback}</div>
            `;
            
            // Inject the Edit Grade button into the action buttons stack
            actionBtns += `<button onclick="openEditModal('${student.id}')" class="bg-amber-100 text-amber-700 border border-amber-300 font-semibold px-2 py-1 rounded text-[10px] hover:bg-amber-600 hover:text-white transition shadow-sm text-left mt-1.5 w-full">✏️ Manual Edit</button>`;

            if (dbGrade.publishedToGithub) {
                publishBtnHtml = `<span class="bg-green-100 text-green-700 border border-green-300 font-bold px-2 py-1 rounded text-[10px] block text-center mt-2 shadow-sm">✅ Published</span>`;
            } else if (dbGrade.commitSha) {
                publishBtnHtml = `<button onclick="publishSingle('${student.id}')" class="w-full bg-blue-100 text-blue-700 border border-blue-300 font-semibold px-2 py-1 rounded text-[10px] hover:bg-blue-600 hover:text-white transition shadow-sm mt-2">🚀 Publish</button>`;
            }
        }

        let commitDisplay = ghData.error 
            ? `<span class="text-red-500 text-[10px] font-bold leading-tight block">${ghData.error}</span>`
            : `<span class="${ghData.count === 0 ? 'text-red-500' : 'text-green-600'} font-bold text-sm">${ghData.count}</span>`;

        // Notice the px-2 and py-2 for tighter spacing
        const tr = `
            <tr class="border-b hover:bg-gray-50">
                <td class="py-2 px-2 align-top">
                    <div class="font-bold text-gray-800 text-xs">${student.name}</div>
                    <div class="text-[10px] text-gray-500 truncate w-32" title="${student.githubUsername}">${student.githubUsername}</div>
                </td>
                <td class="py-2 px-2 text-center align-top">${commitDisplay}</td>
                <td class="py-2 px-2 text-center align-top text-[10px] font-mono whitespace-nowrap"><span class="text-green-600">+${ghData.additions}</span><br><span class="text-red-500">-${ghData.deletions}</span></td>
                <td class="py-2 px-2 text-[10px] text-gray-600 align-top">
                    <div class="max-h-16 overflow-y-auto leading-snug">${ghData.latestMsg}</div>
                </td>
                <td class="py-2 px-2 align-top" id="fb-${student.id}">${feedbackHtml}</td>
                <td class="py-2 px-2 align-top">
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
window.openEditModal = function(studentId) {
    const gradeRec = firestoreGradesMap[studentId];
    if (!gradeRec || !gradeRec.rawAiData) return alert("Cannot manually edit older grades. Please click 'Regrade via AI' first to convert to the new format.");
    
    const ai = gradeRec.rawAiData;

    document.getElementById('editStudentId').value = studentId;
    document.getElementById('editMaxScore').value = gradeRec.maxScore;
    
    document.getElementById('editTotalScoreDisplay').textContent = ai.total_score;
    document.getElementById('editMaxScoreDisplay').textContent = gradeRec.maxScore;

    const container = document.getElementById('editCriteriaContainer');
    container.innerHTML = '';
    
    // Generate an input box for every single criteria in the rubric
    if (ai.breakdown) {
        ai.breakdown.forEach((b, index) => {
            container.insertAdjacentHTML('beforeend', `
                <div class="flex items-center justify-between bg-white p-2 border rounded shadow-sm">
                    <label class="text-xs font-bold text-gray-700 w-2/3 truncate pr-2" title="${b.criterion}">${b.criterion}</label>
                    <div class="flex items-center gap-1 w-1/3 justify-end">
                        <input type="number" id="editCrit_${index}" value="${b.score}" max="${b.max}" min="0" onchange="recalculateTotal()" class="w-16 p-1 border rounded text-center font-bold text-purple-700 focus:ring-purple-500">
                        <span class="text-xs text-gray-500 font-bold">/ ${b.max}</span>
                        <input type="hidden" id="editCritName_${index}" value="${b.criterion}">
                        <input type="hidden" id="editCritMax_${index}" value="${b.max}">
                    </div>
                </div>
            `);
        });
    }

    // Populate the clean textareas
    document.getElementById('editFeedbackCriteria').value = ai.feedback_criteria || "";
    document.getElementById('editAdditionalFeedback').value = ai.additional_feedback || "";
    document.getElementById('editOptionalSuggestion').value = ai.optional_suggestion || "";
    
    document.getElementById('editGradeModal').classList.remove('hidden');
};

window.recalculateTotal = function() {
    let total = 0;
    const inputs = document.querySelectorAll('[id^="editCrit_"]');
    inputs.forEach(input => {
        total += parseInt(input.value) || 0;
    });
    document.getElementById('editTotalScoreDisplay').textContent = total;
};

window.closeEditModal = function() {
    document.getElementById('editGradeModal').classList.add('hidden');
};

window.saveEditedGrade = async function() {
    const studentId = document.getElementById('editStudentId').value;
    const maxScore = parseInt(document.getElementById('editMaxScore').value);
    const gradeRec = firestoreGradesMap[studentId];
    if(!gradeRec) return;

    // 1. Reconstruct the new breakdown array and Total Score
    let newTotal = 0;
    let newBreakdown = [];
    const inputs = document.querySelectorAll('[id^="editCrit_"]');
    inputs.forEach((input, index) => {
        const score = parseInt(input.value) || 0;
        const criterion = document.getElementById(`editCritName_${index}`).value;
        const max = parseInt(document.getElementById(`editCritMax_${index}`).value);
        newTotal += score;
        newBreakdown.push({ criterion, score, max });
    });

    // 2. Build the new AI JSON Object
    const newRawAiData = {
        total_score: newTotal,
        breakdown: newBreakdown,
        feedback_criteria: document.getElementById('editFeedbackCriteria').value.trim(),
        additional_feedback: document.getElementById('editAdditionalFeedback').value.trim(),
        optional_suggestion: document.getElementById('editOptionalSuggestion').value.trim()
    };

    // 3. Convert it back into HTML using the helper
    const newFormattedFeedback = buildFeedbackHtml(newRawAiData, maxScore);

    window.showLoader("Saving Manual Override...");
    try {
        const updatedData = {
            score: newTotal,
            feedback: newFormattedFeedback,
            rawAiData: newRawAiData // Save it back so the GitHub publisher can format it
        };

        await setDoc(doc(db, "grades", gradeRec.docId), updatedData, { merge: true });

        firestoreGradesMap[studentId].score = newTotal;
        firestoreGradesMap[studentId].feedback = newFormattedFeedback;
        firestoreGradesMap[studentId].rawAiData = newRawAiData;

        closeEditModal();
        renderGradingTable();
    } catch(e) {
        alert("Error saving manual edit: " + e.message);
    } finally {
        window.hideLoader();
    }
};
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

    // We isolate the active template and force the AI to ignore its old formatting rules
    const prompt = `
[START OF RUBRIC PERSONA]
${activeTemplate.generalPrompt}
[END OF RUBRIC PERSONA]

CRITICAL SYSTEM INSTRUCTIONS:
1. IGNORE any formatting instructions that may exist in the "Rubric Persona" above. 
2. You MUST output ONLY a valid JSON object. Do NOT write "Score: X" outside the JSON.
3. DO NOT use conversational filler. Be blunt and direct.
4. Evaluate the code against the provided criteria and assign a specific score for each.
5. Output MUST be strictly in the following JSON format. Do NOT wrap it in markdown blocks.
6. CODE QUOTATION RULE: If you quote the student's code, you MUST use backticks (\`) or single quotes ('). You are STRICTLY FORBIDDEN from using double quotes (").
7. DO NOT REPEAT THE STUDENT'S CODE. Limit your feedback to concise, actionable sentences.

{
    "total_score": <number>,
    "breakdown": [
        { "criterion": "<Name of Criterion>", "score": <number>, "max": <number> }
    ],
    "feedback_criteria": "<Bullet points explaining the deductions based on criteria>",
    "additional_feedback": "<1-2 sentences of factual praise or missing logic>",
    "optional_suggestion": "<1 bullet point for best practices>"
}

Grade out of a maximum total score of ${maxScore}.
Criteria:
${criteriaText}

Student Code:
${data.patches.substring(0, 15000)}
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
                    response_schema: {
                        type: "OBJECT",
                        properties: {
                            total_score: { type: "INTEGER" },
                            breakdown: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        criterion: { type: "STRING" },
                                        score: { type: "INTEGER" },
                                        max: { type: "INTEGER" }
                                    }
                                }
                            },
                            feedback_criteria: { type: "STRING" },
                            additional_feedback: { type: "STRING" },
                            optional_suggestion: { type: "STRING" }
                        }
                    },
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
        let rawJson = aiResult.candidates[0].content.parts[0].text;
        rawJson = rawJson.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        
        let gradeData;
        try {
            gradeData = JSON.parse(rawJson);
        } catch (e) {
            throw new Error("AI returned truncated or invalid JSON. Please try clicking Regrade via AI. (" + e.message + ")");
        }
        
        // Safety check to prevent the 'forEach' undefined crash
        if (!gradeData.breakdown) gradeData.breakdown = [];

        // Build the HTML using our new helper function
        const formattedFeedback = buildFeedbackHtml(gradeData, maxScore);

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
            feedback: formattedFeedback, 
            rawAiData: gradeData, 
            publishedToGithub: false,
            commitSha: data.commitSha
        };

        await setDoc(doc(db, "grades", gradeDocId), dbEntry);
        
        firestoreGradesMap[student.id] = { docId: gradeDocId, ...dbEntry };
        
        document.getElementById('aiStudentName').textContent = `Graded: ${student.name}`;
        document.getElementById('aiScore').textContent = gradeData.total_score;
        document.getElementById('aiScoreMax').textContent = `/${maxScore}`;
        document.getElementById('aiFeedback').innerHTML = formattedFeedback;
        document.getElementById('aiModal').classList.remove('hidden');

        renderGradingTable(); 
    } catch (err) {
        alert("AI Grading failed: " + err.message);
    } finally {
        window.hideLoader();
    }
};

// ==========================================
// PUBLISHING (GITHUB API) & CONFIRMATION
// ==========================================

let pendingPublishAction = null; 

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

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const targetMonthName = monthNames[gradeRec.month];
    const targetWeek = `Week ${gradeRec.week}`;

    const publishTimestamp = new Date().toLocaleString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: 'numeric', minute: 'numeric', hour12: true 
    });

    let commentBody = `### ${targetMonthName} ${targetWeek}\n\n`;

    // Construct the Markdown exactly as requested
    if (gradeRec.rawAiData) {
        const ai = gradeRec.rawAiData;
        
        // 1. Total First
        commentBody += `**Total: ${ai.total_score} / ${gradeRec.maxScore}**\n`;
        
        // 2. Breakdown Second
        ai.breakdown.forEach(b => {
            commentBody += `**${b.criterion}:** ${b.score}/${b.max}\n`;
        });
        
        // 3. Feedback Sections
        commentBody += `\n**Feedback based on criteria:**\n${ai.feedback_criteria}\n\n`;
        commentBody += `**Additional feedback:**\n${ai.additional_feedback}\n\n`;
        commentBody += `**Optional Suggestion:**\n${ai.optional_suggestion}\n\n`;
    } else {
        const mdFeedback = gradeRec.feedback.replace(/<br>/g, '\n').replace(/<[^>]*>?/gm, '');
        commentBody += `**Total: ${gradeRec.score} / ${gradeRec.maxScore}**\n\n${mdFeedback}\n\n`;
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
    
    await setDoc(doc(db, "grades", gradeRec.docId), { publishedToGithub: true }, { merge: true });
    firestoreGradesMap[student.id].publishedToGithub = true;
}

window.publishSingle = function(studentId) {
    const student = currentStudents.find(s => s.id === studentId);
    const gradeRec = firestoreGradesMap[studentId];

    if (!gradeRec || !gradeRec.commitSha) return alert("Cannot publish: No valid commit SHA found to attach comment.");

    pendingPublishAction = { type: 'single', studentId: studentId };

    document.getElementById('publishConfirmWarning').innerHTML = `You are about to publish the AutoGrader report for <strong class="text-gray-900">${student.name}</strong>. <br><br>Once published, GitHub will instantly email this student the feedback and score below.`;
    
    document.getElementById('publishConfirmScore').textContent = `${gradeRec.score} / ${gradeRec.maxScore}`;
    document.getElementById('publishConfirmFeedback').innerHTML = gradeRec.feedback;
    
    document.getElementById('publishConfirmPreview').classList.remove('hidden');

    document.getElementById('executePublishBtn').onclick = executePublish;
    document.getElementById('publishConfirmModal').classList.remove('hidden');
};

window.publishAllGrades = function() {
    const pendingQueue = currentStudents.filter(s => {
        const g = firestoreGradesMap[s.id];
        return g && g.commitSha && !g.publishedToGithub;
    });

    if (pendingQueue.length === 0) return alert("No pending grades to publish. Ensure students are graded first.");

    pendingPublishAction = { type: 'bulk', queue: pendingQueue };

    document.getElementById('publishConfirmWarning').innerHTML = `You are about to batch publish AutoGrader reports to <strong class="text-red-600 text-lg">${pendingQueue.length} student repositories</strong>.<br><br>⚠️ <strong class="text-gray-900">WARNING:</strong> GitHub will instantly blast an email to all ${pendingQueue.length} students containing their individual feedback. Are you absolutely sure the grades are finalized?`;
    
    document.getElementById('publishConfirmPreview').classList.add('hidden');
    
    document.getElementById('executePublishBtn').onclick = executePublish;
    document.getElementById('publishConfirmModal').classList.remove('hidden');
};

window.closePublishConfirmModal = function() {
    document.getElementById('publishConfirmModal').classList.add('hidden');
    pendingPublishAction = null;
};

async function executePublish() {
    const action = pendingPublishAction;
    closePublishConfirmModal();

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