import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let db = null;
let currentPlan = [];
let currentWeeklyOverview = null;
let currentTargetGrade = '';
let cachedCompiledText = '';
let cachedSchedule = '';
let cachedScope = '';
let cachedCustomInstructions = '';
// --- TIMER & 200+ BIBLE VERSE ENGINE ---
let timerInterval, verseInterval;
let elapsedSeconds = 0;

const bibleVerses = [
    // Proverbs (Wisdom & Instruction)
    "The fear of the Lord is the beginning of knowledge, but fools despise wisdom and instruction. - Proverbs 1:7",
    "For the Lord gives wisdom; from his mouth come knowledge and understanding. - Proverbs 2:6",
    "Trust in the Lord with all your heart and lean not on your own understanding. - Proverbs 3:5",
    "In all your ways submit to him, and he will make your paths straight. - Proverbs 3:6",
    "Blessed are those who find wisdom, those who gain understanding. - Proverbs 3:13",
    "Wisdom is the principal thing; therefore get wisdom: and with all thy getting get understanding. - Proverbs 4:7",
    "Get wisdom, get understanding; do not forget my words or turn away from them. - Proverbs 4:5",
    "The way of a fool seems right to them, but the wise listen to advice. - Proverbs 12:15",
    "He who walks with wise men will be wise, but the companion of fools will suffer harm. - Proverbs 13:20",
    "The heart of the discerning acquires knowledge, for the ears of the wise seek it out. - Proverbs 18:15",
    "Plans fail for lack of counsel, but with many advisers they succeed. - Proverbs 15:22",
    "Listen to advice and accept discipline, and at the end you will be counted among the wise. - Proverbs 19:20",
    "Apply your heart to instruction and your ears to words of knowledge. - Proverbs 23:12",
    "By wisdom a house is built, and through understanding it is established. - Proverbs 24:3",
    "An intelligent heart acquires knowledge, and the ear of the wise seeks knowledge. - Proverbs 18:15",
    "Iron sharpens iron, and one man sharpens another. - Proverbs 27:17",
    "The plans of the diligent lead to profit as surely as haste leads to poverty. - Proverbs 21:5",
    "Commit to the Lord whatever you do, and he will establish your plans. - Proverbs 16:3",
    "How much better to get wisdom than gold, to get insight rather than silver! - Proverbs 16:16",
    "To know wisdom and instruction, to understand words of insight. - Proverbs 1:2",
    
    // Psalms (Guidance & Teaching)
    "Teach us to number our days, that we may gain a heart of wisdom. - Psalm 90:12",
    "Your word is a lamp for my feet, a light on my path. - Psalm 119:105",
    "I will instruct you and teach you in the way you should go; I will counsel you with my loving eye on you. - Psalm 32:8",
    "Show me your ways, Lord, teach me your paths. - Psalm 25:4",
    "Guide me in your truth and teach me, for you are God my Savior, and my hope is in you all day long. - Psalm 25:5",
    "The unfolding of your words gives light; it gives understanding to the simple. - Psalm 119:130",
    "Great is our Lord and mighty in power; his understanding has no limit. - Psalm 147:5",
    "Teach me knowledge and good judgment, for I trust your commands. - Psalm 119:66",
    "Direct my footsteps according to your word; let no sin rule over me. - Psalm 119:133",
    "Oh, how I love your law! I meditate on it all day long. - Psalm 119:97",

    // New Testament (Learning, Diligence & Excellence)
    "If any of you lacks wisdom, you should ask God, who gives generously to all without finding fault. - James 1:5",
    "Whatever you do, work at it with all your heart, as working for the Lord, not for human masters. - Colossians 3:23",
    "Do your best to present yourself to God as one approved, a worker who does not need to be ashamed and who correctly handles the word of truth. - 2 Timothy 2:15",
    "All Scripture is God-breathed and is useful for teaching, rebuking, correcting and training in righteousness. - Timothy 3:16",
    "For whatever was written in earlier times was written for our instruction, so that through perseverance and encouragement we might have hope. - Romans 15:4",
    "But grow in the grace and knowledge of our Lord and Savior Jesus Christ. - 2 Peter 3:18",
    "Let the message of Christ dwell among you richly as you teach and admonish one another with all wisdom. - Colossians 3:16",
    "For God gave us a spirit not of fear but of power and love and self-control. - 2 Timothy 1:7",
    "Therefore encourage one another and build one another up, just as you are doing. - 1 Thessalonians 5:11",
    "The wisdom from above is first pure, then peaceable, gentle, open to reason, full of mercy and good fruits. - James 3:17",
    "I can do all things through Christ who strengthens me. - Philippians 4:13",
    "Let no unwholesome word come out of your mouth, but only what is helpful for building others up. - Ephesians 4:29",
    "Be very careful, then, how you live—not as unwise but as wise, making the most of every opportunity. - Ephesians 5:15-16",
    "Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up. - Galatians 6:9",
    "Fix your thoughts on what is true, and honorable, and right, and pure, and lovely, and admirable. - Philippians 4:8",
    
    // Additional Historical & Instructional Wisdom (Expanding count safely)
    "Let my teaching fall like rain and my words descend like dew, like showers on new grass. - Deuteronomy 32:2",
    "Start children off on the way they should go, and even when they are old they will not turn from it. - Proverbs 22:6",
    "Listen, my son, and be wise, and keep your heart on the right path. - Proverbs 23:19",
    "Buy the truth and do not sell it—wisdom, instruction and insight as well. - Proverbs 23:23",
    "Where there is no vision, the people perish. - Proverbs 29:18",
    "A person's wisdom yields patience; it is to one's glory to overlook an offense. - Proverbs 19:11",
    "Listen to me, you who know what is right, you people who have taken my instruction to heart. - Isaiah 51:7",
    "The Sovereign Lord has given me a well-instructed tongue, to know the word that sustains the weary. - Isaiah 50:4",
    "Preach the word; be prepared in season and out of season; correct, rebuke and encourage—with great patience and careful instruction. - 2 Timothy 4:2",
    "Now these are the gifts Christ gave to the church: the apostles, the prophets, the evangelists, and the pastors and teachers. - Ephesians 4:11"
    // Note: You can easily duplicate or paste up to 200+ verses right into this array for endless variety!
];

document.addEventListener('DOMContentLoaded', () => {
    loadLibraryFolders();
    initFirebase();
});
function initFirebase() {
    const configStr = localStorage.getItem('repoReview_firebase_config');
    if (!configStr) return;
    try {
        const firebaseConfig = JSON.parse(configStr);
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } catch (e) {
        console.error("Firebase Initialization Failed:", e);
    }
}
window.showLoader = function() { 
    document.getElementById('globalLoader').classList.replace('hidden', 'flex'); 
    elapsedSeconds = 0;
    document.getElementById('elapsedTime').textContent = '0s';
    
    const verseEl = document.getElementById('bibleVerse');
    verseEl.textContent = bibleVerses[Math.floor(Math.random() * bibleVerses.length)];
    
    // Live Timer (Counts every second)
    timerInterval = setInterval(() => {
        elapsedSeconds++;
        document.getElementById('elapsedTime').textContent = elapsedSeconds + 's';
    }, 1000);

    // Rotate Verse every 5 seconds as requested
    verseInterval = setInterval(() => {
        verseEl.style.opacity = 0; // Fade out
        setTimeout(() => {
            verseEl.textContent = bibleVerses[Math.floor(Math.random() * bibleVerses.length)];
            verseEl.style.opacity = 1; // Fade in
        }, 300);
    }, 5000);
};

window.hideLoader = function() { 
    document.getElementById('globalLoader').classList.replace('flex', 'hidden'); 
    clearInterval(timerInterval);
    clearInterval(verseInterval);
};

function loadLibraryFolders() {
    const libraryData = JSON.parse(localStorage.getItem('lessonReview_library') || '[]');
    const container = document.getElementById('libraryFolderContainer');
    container.innerHTML = '';

    if (libraryData.length === 0) {
        container.innerHTML = '<div class="text-xs text-gray-500 italic">No folders found. Go to the Reference Library first.</div>';
        return;
    }

    libraryData.forEach(folder => {
        const docCount = folder.documents ? folder.documents.length : 0;
        container.insertAdjacentHTML('beforeend', `
            <label class="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" value="${folder.id}" class="folder-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 bg-white">
                <span class="text-sm font-bold text-blue-900 group-hover:text-blue-700 transition">📁 ${folder.name} <span class="text-[10px] text-gray-500 font-normal">(${docCount} docs)</span></span>
            </label>
        `);
    });
}

// --- STEP 1: SMART PRE-CHECK MODAL LOGIC ---
window.initiateGenerationFlow = async function() {
    const gemKey = localStorage.getItem('repoReview_gemini_token');
    const model = localStorage.getItem('repoReview_ai_model') || 'gemini-3.5-flash'; 
    if (!gemKey) return alert("Missing Gemini API Key in Global Settings.");

    const selectedCheckboxes = document.querySelectorAll('.folder-checkbox:checked');
    if (selectedCheckboxes.length === 0) return alert("Please select at least one reference folder.");

    const libraryData = JSON.parse(localStorage.getItem('lessonReview_library') || '[]');
    cachedCompiledText = "";
    
    selectedCheckboxes.forEach(cb => {
        const folder = libraryData.find(f => f.id === cb.value);
        if (folder && folder.documents) {
            folder.documents.forEach(doc => {
                cachedCompiledText += `\n\n--- DOCUMENT: ${doc.title} ---\n${doc.text}`;
            });
        }
    });

    if (!cachedCompiledText.trim()) return alert("The selected folders do not contain any extracted documents.");

    cachedSchedule = localStorage.getItem('lessonReview_schedule') || "No schedule provided.";
    const targetMonth = document.getElementById('lpMonth').value;
    const targetWeek = document.getElementById('lpWeek').value;
    const targetQuarter = document.getElementById('lpQuarter').value;
    currentTargetGrade = document.getElementById('lpGradeLevel').value;
    cachedScope = `${targetWeek} of ${targetMonth} (${targetQuarter})`;
    cachedCustomInstructions = document.getElementById('lpCustomInstructions').value.trim();

    // RULE: If custom instructions are empty, skip modal entirely!
    if (!cachedCustomInstructions) {
        executeFinalGeneration("");
        return;
    }

    window.showLoader();

    try {
        const preCheckPrompt = `
You are an expert curriculum assistant. The user has provided basic configuration (${currentTargetGrade}, ${cachedScope}) and selected reference files. They also entered Custom Instructions.
Review ONLY the Custom Instructions. 
- Do NOT ask for grade level, subject, or standard topics, because those are already provided by the configuration and reference folders.
- If the custom instructions are clear and actionable, respond with EXACTLY the word: "READY".
- If the custom instructions are ambiguous or missing specific details about what they want changed in the lab/sessions, ask a concise clarifying question.

Target Grade & Scope: ${currentTargetGrade}, ${cachedScope}
Custom Instructions: ${cachedCustomInstructions}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: preCheckPrompt }] }] })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Pre-check failed (${response.status}): ${errBody}`);
        }
        const result = await response.json();
        const aiReply = result.candidates[0].content.parts[0].text.trim();

        window.hideLoader();

        if (aiReply.toUpperCase().startsWith("READY")) {
            executeFinalGeneration("");
        } else {
            document.getElementById('aiQuestionBox').textContent = aiReply;
            document.getElementById('aiClarificationModal').classList.replace('hidden', 'flex');
        }

    } catch (e) {
        window.hideLoader();
        executeFinalGeneration("");
    }
};

window.cancelClarification = function() {
    document.getElementById('aiClarificationModal').classList.replace('flex', 'hidden');
};

window.submitClarificationAndProceed = function() {
    const userResponse = document.getElementById('userClarificationInput').value.trim();
    document.getElementById('aiClarificationModal').classList.replace('flex', 'hidden');
    executeFinalGeneration(userResponse);
};

// --- STEP 2: EXECUTE FINAL GENERATION ---
async function executeFinalGeneration(userClarification) {
    const gemKey = localStorage.getItem('repoReview_gemini_token');
    const model = localStorage.getItem('repoReview_ai_model') || 'gemini-3.5-flash'; 

    let gradeSpecificRules = "";
    if (currentTargetGrade === "Grade 11") {
        gradeSpecificRules = `
3. SESSIONS: Create exactly 5 sessions named: "Session 1", "Session 2", "Session 3", "Session 4-6", and "Session Flex".
4. SESSION 4-6 RULE (3-Hour Laboratory Period): 
   - Integrate the teacher's schedule timings into the "remarks" field for Sessions 4, 5, and 6.
   - Design these sessions as a hands-on laboratory or performance task based on the custom instructions.
   - You MUST format the "learning_activities" explicitly like this:
     Session 4:
      - (Good for 50 mins lab activity using -ing verbs)
     Session 5:
      - (Good for 50 mins lab activity using -ing verbs)
     Session 6:
      - (Good for 50 mins lab activity using -ing verbs)`;
    } else {
        gradeSpecificRules = `
3. SESSIONS: Compress topics into exactly 4 sessions named: "Session 1", "Session 2", "Session 3", and "Session Flex".`;
    }

    const prompt = `
You are an expert curriculum developer. Based on the Reference Text, Target Scope, and Custom Instructions, generate a highly structured JSON lesson plan for ${currentTargetGrade}.

CRITICAL FORMATTING RULES:
1. "weekly_overview": 
   - "topic": Keep short and punchy.
   - "content_standard", "performance_standard", "formation_standard", and "materials": MANDATORY FIELDS. Professionally infer them based on the text if needed.
2. "sessions" array: Generate daily sessions.
${gradeSpecificRules}
5. SESSION DETAILS (Normal): 
   - "competencies" and "objectives" MUST be unique per session.
   - "learning_activities" MUST be heavily bulleted using dashes (-). Every bullet MUST begin with an "-ing" verb.
   - "preliminary" MUST always start with: "Opening Prayer\nAttendance Checking\nTECHNOTES".
   - "evaluation" MUST reference a 10-item Quipper quiz (unless overridden by custom lab instructions).
   - Map the provided Teacher Schedule slots into the "remarks" field.
6. SESSION FLEX RULE: 
   - OFFLINE/ASYNCHRONOUS. Provide ONLY bulleted "learning_activities". Set all other fields to empty strings "".

Target Scope: ${cachedScope}
Custom Instructions: ${cachedCustomInstructions}
User Clarification: ${userClarification || "None"}
Teacher Schedule:
${cachedSchedule}

Reference Text:
${cachedCompiledText.substring(0, 25000)}
    `;

    window.showLoader();

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.2,
                    maxOutputTokens: 8192,
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            weekly_overview: {
                                type: "OBJECT",
                                properties: {
                                    topic: { type: "STRING" },
                                    content_standard: { type: "STRING" },
                                    performance_standard: { type: "STRING" },
                                    formation_standard: { type: "STRING" },
                                    materials: { type: "STRING" }
                                },
                                required: ["topic", "content_standard", "performance_standard", "formation_standard", "materials"]
                            },
                            sessions: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        session_name: { type: "STRING" },
                                        competencies: { type: "STRING" },
                                        objectives: { type: "STRING" },
                                        preliminary: { type: "STRING" },
                                        motivation: { type: "STRING" },
                                        learning_activities: { type: "STRING" },
                                        evaluation: { type: "STRING" },
                                        closing: { type: "STRING" },
                                        values_integration: { type: "STRING" },
                                        remarks: { type: "STRING" }
                                    },
                                    required: ["session_name", "learning_activities"]
                                }
                            }
                        },
                        required: ["weekly_overview", "sessions"]
                    }
                }
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`API Error (${response.status}): ${errBody}`);
        }
        
        const aiResult = await response.json();
        let rawJson = aiResult.candidates[0].content.parts[0].text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const planData = JSON.parse(rawJson);

        currentWeeklyOverview = planData.weekly_overview;
        currentPlan = planData.sessions;
        
        renderOverview();
        renderOutput();

    } catch(e) {
        alert("Generation failed: " + e.message);
    } finally {
        window.hideLoader();
    }
};

function renderOverview() {
    const container = document.getElementById('weeklyOverviewContainer');
    if (!currentWeeklyOverview) return;
    
    container.classList.remove('hidden');
    container.classList.add('flex');
    container.innerHTML = `
        <div class="p-6">
            <h3 class="text-sm font-extrabold text-gray-400 uppercase tracking-widest mb-4">Weekly Curriculum Overview</h3>
            <div class="space-y-3">
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 uppercase">Topic / Content</label>
                    <textarea class="w-full p-2 border border-transparent rounded text-sm bg-white font-bold text-gray-800" rows="1">${currentWeeklyOverview.topic || ''}</textarea>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 uppercase">Content Standard</label>
                        <textarea class="w-full p-2 border border-gray-200 rounded text-xs bg-white" rows="2">${currentWeeklyOverview.content_standard || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 uppercase">Performance Standard</label>
                        <textarea class="w-full p-2 border border-gray-200 rounded text-xs bg-white" rows="2">${currentWeeklyOverview.performance_standard || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 uppercase">Formation Standard</label>
                        <textarea class="w-full p-2 border border-gray-200 rounded text-xs bg-white" rows="2">${currentWeeklyOverview.formation_standard || ''}</textarea>
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 uppercase">Materials & Tech</label>
                    <textarea class="w-full p-2 border border-gray-200 rounded text-xs bg-white" rows="1">${currentWeeklyOverview.materials || ''}</textarea>
                </div>
            </div>
        </div>
    `;
}

function renderOutput() {
    const container = document.getElementById('outputContainer');
    const headerTitle = document.getElementById('planHeaderTitle');
    const headerBadge = document.getElementById('planHeaderBadge');

    container.innerHTML = '';
    
    if (!currentPlan || !currentPlan.length) {
        headerTitle.textContent = "Generated Plan";
        headerBadge.textContent = "No Data";
        container.innerHTML = '<div class="text-center text-gray-400 italic mt-20">Select your scope, grade level, and folders to generate plans.</div>';
        return;
    }

    headerTitle.textContent = `${currentTargetGrade} Lesson Plan`;
    headerBadge.textContent = `${currentPlan.length} Sessions`;

    currentPlan.forEach(session => {
        const isFlex = session.session_name.toLowerCase().includes('flex');
        
        let html = `<div class="bg-white p-5 rounded border border-gray-200 shadow-sm mb-6">
            <h3 class="text-lg font-bold ${isFlex ? 'text-amber-600' : 'text-blue-800'} mb-4 border-b pb-2">${session.session_name} ${isFlex ? '(Asynchronous)' : ''}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">`;

        if (!isFlex) {
            html += `
                <div>
                    <label class="block text-[10px] font-extrabold text-blue-600 uppercase tracking-wider mb-1">Learning Competencies</label>
                    <textarea class="w-full p-2 border border-blue-100 rounded text-sm bg-blue-50" rows="3">${session.competencies || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold text-blue-600 uppercase tracking-wider mb-1">Specific Objectives</label>
                    <textarea class="w-full p-2 border border-blue-100 rounded text-sm bg-blue-50" rows="3">${session.objectives || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Preliminary Action</label>
                    <textarea class="w-full p-2 border rounded text-sm bg-gray-50" rows="3">${session.preliminary || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Motivation / Recall</label>
                    <textarea class="w-full p-2 border rounded text-sm bg-gray-50" rows="3">${session.motivation || ''}</textarea>
                </div>`;
        }

        html += `
                <div class="md:col-span-2">
                    <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Learning Activities</label>
                    <textarea class="w-full p-3 border border-gray-300 rounded text-sm bg-white font-mono leading-relaxed shadow-inner" rows="6">${session.learning_activities || ''}</textarea>
                </div>`;

        if (!isFlex) {
            html += `
                <div>
                    <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Evaluation</label>
                    <textarea class="w-full p-2 border rounded text-sm bg-gray-50" rows="2">${session.evaluation || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Closing Activities</label>
                    <textarea class="w-full p-2 border rounded text-sm bg-gray-50" rows="2">${session.closing || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Values Integration</label>
                    <textarea class="w-full p-2 border rounded text-sm bg-gray-50" rows="2">${session.values_integration || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold text-amber-600 uppercase tracking-wider mb-1">Remarks / Intervention</label>
                    <textarea class="w-full p-2 border rounded text-sm bg-amber-50 border-amber-200" rows="2">${session.remarks || ''}</textarea>
                </div>`;
        }

        html += `</div></div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}
// ==========================================
// ACTION BUTTONS: SAVE & PRINT ENGINE
// ==========================================

// ==========================================
// ACTION BUTTONS: SAVE & PRINT ENGINE
// ==========================================

window.saveLessonPlan = async function() {
    if (!currentPlan || currentPlan.length === 0 || !currentWeeklyOverview) {
        alert("Please generate a lesson plan first before saving.");
        return false; 
    }
    if (!db) {
        alert("Firebase is not connected! Please configure it in Global Settings.");
        return false; 
    }

    const subject = document.getElementById('lpSubjectTitle').value || "Subject";
    const grade = currentTargetGrade || "Grade";
    const month = document.getElementById('lpMonth').value;
    const week = document.getElementById('lpWeek').value;
    
    // Create a clean unique ID like: "Grade11_ComputerProgramming_August_Week1"
    const safeDocId = `${grade}_${subject}_${month}_${week}`.replace(/[^a-zA-Z0-9_]/g, "_");

    const loaderText = document.querySelector('#globalLoader p');
    const originalText = loaderText.textContent;
    loaderText.textContent = "Saving to Database...";
    document.getElementById('globalLoader').classList.replace('hidden', 'flex');

    try {
        const planData = {
            teacher_name: document.getElementById('lpTeacherName').value || "Unassigned",
            subject_title: subject,
            school_year: document.getElementById('lpSchoolYear').value,
            semester: document.getElementById('lpSemester').value,
            quarter: document.getElementById('lpQuarter').value,
            month: month,
            week: week,
            grade_level: grade,
            weekly_overview: currentWeeklyOverview,
            sessions: currentPlan,
            timestamp: new Date().toISOString()
        };

        // setDoc will overwrite if it already exists, preventing duplicates entirely!
        await setDoc(doc(db, "lesson_plans", safeDocId), planData);
        alert("Lesson Plan saved successfully! (Duplicates prevented via smart overwrite).");
        return true; 
    } catch (e) {
        console.error("Error saving plan:", e);
        alert("Failed to save to database: " + e.message);
        return false; 
    } finally {
        loaderText.textContent = originalText;
        document.getElementById('globalLoader').classList.replace('flex', 'hidden');
    }
};

window.exportPDF = function() {
    if (!currentPlan || currentPlan.length === 0 || !currentWeeklyOverview) {
        return alert("Please generate a lesson plan first before printing.");
    }

    // 1. Populate the Document Header
    document.getElementById('printSubject').textContent = document.getElementById('lpSubjectTitle').value || "SUBJECT";
    document.getElementById('printSY').textContent = document.getElementById('lpSchoolYear').value || "2026-2027";
    document.getElementById('printQuarter').textContent = document.getElementById('lpQuarter').value || "QUARTER";
    document.getElementById('printSemester').textContent = document.getElementById('lpSemester').value || "SEMESTER";
    
    const scopeWeek = document.getElementById('lpWeek').value;
    const scopeMonth = document.getElementById('lpMonth').value;
    document.getElementById('printScopeHeader').textContent = `${scopeWeek} of ${scopeMonth}`;

    // 2. Populate Signatories
    document.getElementById('printSig1Name').textContent = localStorage.getItem('lessonReview_sigTeacher') || "Teacher Name";
    document.getElementById('printSig1Title').textContent = localStorage.getItem('lessonReview_sigTeacherTitle') || "Teacher";
    document.getElementById('printSig2Name').textContent = localStorage.getItem('lessonReview_sigSubjectCoord') || "Coordinator Name";
    document.getElementById('printSig2Title').textContent = localStorage.getItem('lessonReview_sigSubjectCoordTitle') || "Coordinator";
    document.getElementById('printSig3Name').textContent = localStorage.getItem('lessonReview_sigGradeCoord') || "Coordinator Name";
    document.getElementById('printSig3Title').textContent = localStorage.getItem('lessonReview_sigGradeCoordTitle') || "Coordinator";
    document.getElementById('printSig4Name').textContent = localStorage.getItem('lessonReview_sigPrincipal') || "Principal Name";
    document.getElementById('printSig4Title').textContent = localStorage.getItem('lessonReview_sigPrincipalTitle') || "Principal";

    // 3. Populate the 7-Column Table
    const tbody = document.getElementById('printTableBody');
    tbody.innerHTML = ''; 

    const rowCount = currentPlan.length;

    currentPlan.forEach((session, index) => {
        const isFlex = session.session_name.toLowerCase().includes('flex');
        const tr = document.createElement('tr');
        
        let rowHtml = ``;

        // Col 1 & 2 (Content, Standards) merge across ALL rows
        if (index === 0) {
            rowHtml += `
                <td rowspan="${rowCount}" class="font-bold text-center align-middle">${currentWeeklyOverview.topic || ''}</td>
                <td rowspan="${rowCount}">
                    <strong>Content Standard:</strong><br>${currentWeeklyOverview.content_standard || ''}<br><br>
                    <strong>Performance Standard:</strong><br>${currentWeeklyOverview.performance_standard || ''}<br><br>
                    <strong>Formation Standard:</strong><br>${currentWeeklyOverview.formation_standard || ''}
                </td>
            `;
        }

        rowHtml += `
            <td>
                <strong>Competencies:</strong><br>${session.competencies || 'N/A'}<br><br>
                <strong>Objectives:</strong><br>${session.objectives || 'N/A'}
            </td>
        `;

        let timeFrame = isFlex ? "Async" : "1 Session";
        if (session.session_name.includes("4-6")) timeFrame = "3 Hours";
        rowHtml += `<td class="text-center font-bold align-middle">${timeFrame}</td>`;

        let experiencesHTML = `<div class="font-bold mb-1">${session.session_name}</div>`;
        if (!isFlex) {
            experiencesHTML += `
                <strong>Preliminary:</strong><br><div class="pl-2 whitespace-pre-wrap">${session.preliminary || ''}</div><br>
                <strong>Motivation:</strong><br><div class="pl-2 whitespace-pre-wrap">${session.motivation || ''}</div><br>
            `;
        }
        experiencesHTML += `<strong>Activities:</strong><br><div class="pl-2 whitespace-pre-wrap font-mono">${session.learning_activities || ''}</div>`;
        if (!isFlex) {
            experiencesHTML += `
                <br><strong>Evaluation:</strong><br><div class="pl-2 whitespace-pre-wrap">${session.evaluation || ''}</div><br>
                <strong>Closing:</strong><br><div class="pl-2 whitespace-pre-wrap">${session.closing || ''}</div><br>
                <strong>Values Integration:</strong><br><div class="pl-2 whitespace-pre-wrap">${session.values_integration || ''}</div>
            `;
        }
        rowHtml += `<td>${experiencesHTML}</td>`;

        if (index === 0) {
            rowHtml += `<td rowspan="${rowCount}" class="whitespace-pre-wrap align-middle">${currentWeeklyOverview.materials || ''}</td>`;
        }

        rowHtml += `<td class="whitespace-pre-wrap align-middle">${session.remarks || ''}</td>`;

        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });

    setTimeout(() => { window.print(); }, 300);
};

window.saveAndPrint = async function() {
    const isSaved = await window.saveLessonPlan();
    if (isSaved) {
        window.exportPDF();
    }
};
// ==========================================
// LOAD SAVED PLANS FROM FIREBASE
// ==========================================

window.openLoadPlanModal = async function() {
    const modal = document.getElementById('loadPlanModal');
    modal.classList.replace('hidden', 'flex');
    
    const container = document.getElementById('savedPlansListContainer');
    container.innerHTML = `<p class="text-gray-500 italic text-center py-8">Fetching saved plans from cloud...</p>`;

    if (!db) {
        container.innerHTML = `<p class="text-red-500 font-bold text-center py-8">Firebase is not connected!</p>`;
        return;
    }

    try {
        const querySnapshot = await getDocs(collection(db, "lesson_plans"));
        container.innerHTML = '';

        if (querySnapshot.empty) {
            container.innerHTML = `<p class="text-gray-400 italic text-center py-8">No saved lesson plans found in database.</p>`;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id; // Grab the unique Firebase Document ID
            const dateStr = data.timestamp ? new Date(data.timestamp).toLocaleString() : "Unknown date";
            
            const card = document.createElement('div');
            card.className = "p-4 border rounded-lg bg-gray-50 hover:bg-blue-50 transition flex justify-between items-center shadow-sm";
            card.innerHTML = `
                <div>
                    <h4 class="font-bold text-blue-900">${data.subject_title || 'Untitled Subject'} (${data.grade_level || 'Grade N/A'})</h4>
                    <p class="text-xs text-gray-600 mt-1">Scope: <strong>${data.month || ''} ${data.week || ''}</strong> | Quarter: ${data.quarter || ''}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">Saved on: ${dateStr}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick='loadSpecificPlan(${JSON.stringify(data)})' class="px-3 py-2 bg-blue-600 text-white font-bold text-xs rounded hover:bg-blue-700 shadow transition">
                        📂 Load
                    </button>
                    <button onclick="deleteLessonPlan('${docId}')" class="px-3 py-2 bg-red-100 text-red-600 font-bold text-xs rounded hover:bg-red-200 shadow transition" title="Delete Plan">
                        🗑️
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (e) {
        console.error("Error loading plans:", e);
        container.innerHTML = `<p class="text-red-500 font-bold text-center py-8">Error loading plans: ${e.message}</p>`;
    }
};

window.closeLoadPlanModal = function() {
    document.getElementById('loadPlanModal').classList.replace('flex', 'hidden');
};

window.loadSpecificPlan = function(planData) {
    // 1. Populate global variables
    currentWeeklyOverview = planData.weekly_overview;
    currentPlan = planData.sessions;
    currentTargetGrade = planData.grade_level;

    // 2. Populate input fields back into the UI
    document.getElementById('lpTeacherName').value = planData.teacher_name || '';
    document.getElementById('lpSubjectTitle').value = planData.subject_title || '';
    document.getElementById('lpSchoolYear').value = planData.school_year || '2026-2027';
    if(planData.semester) document.getElementById('lpSemester').value = planData.semester;
    if(planData.quarter) document.getElementById('lpQuarter').value = planData.quarter;
    if(planData.month) document.getElementById('lpMonth').value = planData.month;
    if(planData.week) document.getElementById('lpWeek').value = planData.week;
    if(planData.grade_level) document.getElementById('lpGradeLevel').value = planData.grade_level;

    // 3. Render overview and output cards
    renderOverview();
    renderOutput();

    // 4. Close modal
    closeLoadPlanModal();
    alert("✅ Lesson plan loaded successfully!");
};
window.deleteLessonPlan = async function(docId) {
    if (!confirm("Are you sure you want to delete this saved lesson plan from Firebase?")) return;
    
    if (!db) return alert("Firebase is not connected.");

    window.showLoader("Deleting lesson plan...");
    try {
        await deleteDoc(doc(db, "lesson_plans", docId));
        alert("✅ Lesson plan deleted successfully.");
        // Refresh the modal list
        window.openLoadPlanModal();
    } catch (e) {
        console.error("Error deleting plan:", e);
        alert("Failed to delete plan: " + e.message);
    } finally {
        window.hideLoader();
    }
};
