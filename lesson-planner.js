import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let db = null;
let currentPlan = [];
let currentWeeklyOverview = null;
let currentTargetGrade = '';
let cachedCompiledText = '';
let cachedSchedule = '';
let cachedScope = '';
let cachedCustomInstructions = '';
let cachedPreviousPlan = null;

// --- TIMER & BIBLE VERSE ENGINE ---
let timerInterval, verseInterval;
let elapsedSeconds = 0;

const bibleVerses = [
    "The fear of the Lord is the beginning of knowledge, but fools despise wisdom and instruction. - Proverbs 1:7",
    "For the Lord gives wisdom; from his mouth come knowledge and understanding. - Proverbs 2:6",
    "Trust in the Lord with all your heart and lean not on your own understanding. - Proverbs 3:5",
    "In all your ways submit to him, and he will make your paths straight. - Proverbs 3:6",
    "Blessed are those who find wisdom, those who gain understanding. - Proverbs 3:13",
    "Wisdom is the principal thing; therefore get wisdom: and with all thy getting get understanding. - Proverbs 4:7",
    "The way of a fool seems right to them, but the wise listen to advice. - Proverbs 12:15",
    "Plans fail for lack of counsel, but with many advisers they succeed. - Proverbs 15:22",
    "Commit to the Lord whatever you do, and he will establish your plans. - Proverbs 16:3",
    "Your word is a lamp for my feet, a light on my path. - Psalm 119:105",
    "Whatever you do, work at it with all your heart, as working for the Lord, not for human masters. - Colossians 3:23"
];

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    setupDateCalculator();
});

function initFirebase() {
    const configStr = localStorage.getItem('repoReview_firebase_config');
    if (!configStr) return;
    try {
        const firebaseConfig = JSON.parse(configStr);
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        
        loadLibraryFolders(); // Fetch cloud folders once DB is ready
    } catch (e) {
        console.error("Firebase Initialization Failed:", e);
    }
}

// ==========================================
// UI & CALENDAR HELPERS
// ==========================================
window.showLoader = function() { 
    document.getElementById('globalLoader').classList.replace('hidden', 'flex'); 
    elapsedSeconds = 0;
    const timeEl = document.getElementById('elapsedTime');
    if (timeEl) timeEl.textContent = '0s';
    
    const verseEl = document.getElementById('bibleVerse');
    if (verseEl) verseEl.textContent = bibleVerses[Math.floor(Math.random() * bibleVerses.length)];
    
    timerInterval = setInterval(() => {
        elapsedSeconds++;
        if (timeEl) timeEl.textContent = elapsedSeconds + 's';
    }, 1000);

    verseInterval = setInterval(() => {
        if (!verseEl) return;
        verseEl.style.opacity = 0;
        setTimeout(() => {
            verseEl.textContent = bibleVerses[Math.floor(Math.random() * bibleVerses.length)];
            verseEl.style.opacity = 1;
        }, 300);
    }, 5000);
};

window.hideLoader = function() { 
    document.getElementById('globalLoader').classList.replace('flex', 'hidden'); 
    clearInterval(timerInterval);
    clearInterval(verseInterval);
};

function setupDateCalculator() {
    const syInput = document.getElementById('lpSchoolYear');
    const monthSelect = document.getElementById('lpMonth');
    const weekSelect = document.getElementById('lpWeek');
    const dateRangeInput = document.getElementById('lpDateRange');

    if (!syInput || !monthSelect || !weekSelect || !dateRangeInput) return;

    function calculateDateRange() {
        const sy = syInput.value.trim(); 
        const monthName = monthSelect.value;
        const weekNum = parseInt(weekSelect.value.replace("Week ", "")) - 1;

        if (!sy.includes("-")) return;
        const startYear = parseInt(sy.split('-')[0]);
        const endYear = parseInt(sy.split('-')[1]);

        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthIdx = months.indexOf(monthName);

        const year = (monthIdx >= 0 && monthIdx <= 6) ? endYear : startYear;

        const firstDayOfMonth = new Date(year, monthIdx, 1);
        const dayOfWeek = firstDayOfMonth.getDay(); 
        const diff = (dayOfWeek === 0 || dayOfWeek === 6) ? (dayOfWeek === 0 ? 1 : 2) : (1 - dayOfWeek);
        
        const firstMonday = new Date(year, monthIdx, 1 + diff);
        const targetMonday = new Date(firstMonday);
        targetMonday.setDate(firstMonday.getDate() + (weekNum * 7));
        
        const targetFriday = new Date(targetMonday);
        targetFriday.setDate(targetMonday.getDate() + 4);

        const formatOpts = { month: 'short', day: 'numeric' };
        dateRangeInput.value = `${targetMonday.toLocaleDateString('en-US', formatOpts)} - ${targetFriday.toLocaleDateString('en-US', formatOpts)}`;
    }

    syInput.addEventListener('input', calculateDateRange);
    monthSelect.addEventListener('change', calculateDateRange);
    weekSelect.addEventListener('change', calculateDateRange);
    calculateDateRange();
}

// ==========================================
// CLOUD LIBRARY FETCHING
// ==========================================
async function loadLibraryFolders() {
    const container = document.getElementById('libraryFolderContainer');
    if(!container) return;

    if (!db) {
        container.innerHTML = '<div class="text-xs text-red-500 italic">Firebase not ready.</div>';
        return;
    }

    container.innerHTML = '<div class="text-xs text-gray-500 italic">Fetching folders from cloud...</div>';

    try {
        const snap = await getDocs(collection(db, "reference_folders"));
        const libraryData = [];
        snap.forEach(d => libraryData.push({ id: d.id, ...d.data() }));
        
        localStorage.setItem('lessonReview_library', JSON.stringify(libraryData)); 
        
        container.innerHTML = '';
        if (libraryData.length === 0) {
            container.innerHTML = '<div class="text-xs text-gray-500 italic">No folders found in Firebase.</div>';
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
    } catch (e) {
        container.innerHTML = `<div class="text-xs text-red-500 italic">Failed to load library: ${e.message}</div>`;
    }
}

// ==========================================
// LOOK-BACK ENGINE (Time Traveler)
// ==========================================
async function fetchPreviousPlan(grade, subject, currentMonth, currentWeek) {
    if(!db) return null;
    const months = ["August", "September", "October", "November", "December", "January", "February", "March", "April", "May"];
    let mIdx = months.indexOf(currentMonth);
    let prevMonth = currentMonth;
    let prevWeek = "";
    
    if (currentWeek === "Week 1") {
        if (mIdx <= 0) return null; 
        prevMonth = months[mIdx - 1];
    } else {
        let wNum = parseInt(currentWeek.replace("Week ", ""));
        prevWeek = `Week ${wNum - 1}`;
    }

    const tryFetch = async (m, w) => {
        const id = `${grade}_${subject}_${m}_${w}`.replace(/[^a-zA-Z0-9_]/g, "");
        const docRef = doc(db, "lesson_plans", id);
        try {
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? docSnap.data() : null;
        } catch(e) { return null; }
    };

    if (currentWeek === "Week 1" && mIdx > 0) {
        let plan = await tryFetch(prevMonth, "Week 5");
        if (!plan) plan = await tryFetch(prevMonth, "Week 4");
        return plan;
    } else {
        return await tryFetch(prevMonth, prevWeek);
    }
}

// ==========================================
// AI GENERATOR WORKFLOW
// ==========================================
window.initiateGenerationFlow = async function() {
    const gemKey = localStorage.getItem('repoReview_gemini_token');
    const model = localStorage.getItem('repoReview_ai_model') || 'gemini-1.5-flash'; 
    if (!gemKey) return alert("Missing Gemini API Key in Global Settings.");

    // 1. Grab Custom Instructions FIRST
    const customInstructionsText = document.getElementById('lpCustomInstructions').value.trim();
    const selectedCheckboxes = document.querySelectorAll('.folder-checkbox:checked');
    
    // 2. The "Either/Or" Validation Rule
    if (selectedCheckboxes.length === 0 && !customInstructionsText) {
        return alert("Please select at least one reference folder OR provide Custom Instructions to generate a plan.");
    }
    const libraryData = JSON.parse(localStorage.getItem('lessonReview_library') || '[]');
    cachedCompiledText = "";
    
    // 3. Only extract folder text if checkboxes were actually selected
    if (selectedCheckboxes.length > 0) {
        selectedCheckboxes.forEach(cb => {
            const folder = libraryData.find(f => f.id === cb.value);
            if (folder && folder.documents) {
                folder.documents.forEach(doc => {
                    cachedCompiledText += `\n\n--- DOCUMENT: ${doc.title} ---\n${doc.text}`;
                });
            }
        });
        
        // If they checked a folder but it had zero documents inside, AND they have no custom instructions
        if (!cachedCompiledText.trim() && !customInstructionsText) {
            return alert("The selected folders are empty. Please provide Custom Instructions or select a folder with documents.");
        }
    }
    const subject = document.getElementById('lpSubjectTitle').value || "Subject";
    cachedSchedule = localStorage.getItem('lessonReview_schedule') || "No schedule provided.";
    
    const targetMonth = document.getElementById('lpMonth').value;
    const targetWeek = document.getElementById('lpWeek').value;
    const targetQuarter = document.getElementById('lpQuarter').value;
    const dateRangeEl = document.getElementById('lpDateRange');
    const dateRange = dateRangeEl ? dateRangeEl.value : "";
    
    currentTargetGrade = document.getElementById('lpGradeLevel').value;
    cachedScope = `${targetWeek} of ${targetMonth} (${dateRange}) - ${targetQuarter}`;
    cachedCustomInstructions = document.getElementById('lpCustomInstructions').value.trim();

    // Fetch last week's plan for AI context
    cachedPreviousPlan = await fetchPreviousPlan(currentTargetGrade, subject, targetMonth, targetWeek);

    if (!cachedCustomInstructions) {
        executeFinalGeneration("");
        return;
    }

    window.showLoader();

    try {
        const preCheckPrompt = `
You are an expert curriculum assistant. Review ONLY the Custom Instructions. 
- Do NOT ask for grade level or subject topics, as those are handled automatically.
- If the custom instructions are clear and actionable (like noting suspensions or exams), respond with EXACTLY the word: "READY".
- If the instructions are ambiguous, ask a concise clarifying question.

Target Grade & Scope: ${currentTargetGrade}, ${cachedScope}
Custom Instructions: ${cachedCustomInstructions}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: preCheckPrompt }] }] })
        });

        if (!response.ok) throw new Error(`Pre-check failed (${response.status})`);
        
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
        executeFinalGeneration(""); // Force proceed if pre-check fails
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

async function executeFinalGeneration(userClarification) {
    const gemKey = localStorage.getItem('repoReview_gemini_token');
    const model = localStorage.getItem('repoReview_ai_model') || 'gemini-1.5-flash'; 
    const schoolYear = document.getElementById('lpSchoolYear').value || "2026-2027";

    let gradeSpecificRules = "";
    if (currentTargetGrade === "Grade 11") {
        gradeSpecificRules = `
3. SESSIONS: Create exactly 5 sessions named: "Session 1", "Session 2", "Session 3", "Session 4-6", and "Session Flex".
4. SESSION 4-6 RULE (3-Hour Laboratory Period / 150 mins total): 
   - Design these sessions as a hands-on laboratory or performance task based on custom instructions.
   - You MUST format the "learning_activities" with dynamic minute allocations in parentheses for each phase (e.g., Prelims [X mins], Motivation [X mins], Session 4/Coding [X mins], Session 5/Testing [X mins], Session 6/Debugging [X mins], Evaluation [X mins], Closing [X mins]), ensuring the total equals exactly 150 minutes.
   - You must use -ing verbs at the start of each bullet in the "learning_activities" section for these sessions.
`;} else {
        gradeSpecificRules = `
3. SESSIONS: Compress topics into exactly 4 sessions named: "Session 1", "Session 2", "Session 3", and "Session Flex".`;
    }

    let lookbackContext = "";
    if (cachedPreviousPlan) {
        lookbackContext = `
7. CATCH-UP & SUSPENSION RULE (CRITICAL):
   - Review "Last Week's Curriculum State" provided below.
   - Look specifically at the "remarks" field for each session.
   - If any session from last week was marked as suspended, interrupted, unfinished, or missed, you MUST make the early sessions of THIS week a catch-up/continuation for that missing content BEFORE introducing new topics.
   - Explicitly mention in the new session's remarks that it is a catch-up from last week.

LAST WEEK'S CURRICULUM STATE:
${JSON.stringify(cachedPreviousPlan.sessions.map(s => ({name: s.session_name, activities: s.learning_activities, remarks: s.remarks})), null, 2)}
        `;
    }

    const prompt = `
You are an expert curriculum developer. Based on the Reference Text, Target Scope, and Custom Instructions, generate a highly structured JSON lesson plan for ${currentTargetGrade}.

CRITICAL FORMATTING RULES:
1. "weekly_overview": 
   - "topic": Keep short and punchy.
   - "content_standard", "performance_standard", "formation_standard", and "materials": MANDATORY FIELDS. Professionally infer them based on the text if needed.
   - FALLBACK KNOWLEDGE: If no Reference Text is provided, or if this is a Tech-Voc/TVL subject, you MUST utilize standard DepEd (Department of Education) and TESDA curriculum guides to formulate standards and content accurately.
2. "sessions" array: Generate daily sessions.
${gradeSpecificRules}
5. SESSION DETAILS (Normal): 
   - "competencies": Provide 1 to 2 clear learning competencies.
   - "objectives": Provide strictly 3 to 4 detailed behavioral objectives based on Bloom’s Taxonomy, explicitly covering cognitive, psychomotor, and affective domains where applicable.
   - "preliminary" MUST always start with: "Opening Prayer\nAttendance Checking\nTECHNOTES".
   - "motivation": Briefly describe the activity AND explicitly state the specific teaching strategy used (e.g., "Guessing the parts of the computer with the use of Picture Analysis").
   - "learning_activities": Heavily bulleted using dashes (-). Every bullet MUST begin with an "-ing" verb AND you must explicitly integrate the teaching strategies utilized (e.g., "Discussing different types of computers using the Think-Pair-Share strategy").
   - "evaluation": Suggest diverse and appropriate formative or summative assessments based on the topic (e.g., Venn diagram, performance task, short quiz, oral recitation). Do NOT default to a Quipper quiz.
   - "values_integration": Output ONLY core value keywords, optionally followed by a short phrase or definition connecting it to the lesson (e.g., "Resilience - debugging code without giving up").
   
   - TIME FRAME MAPPING (CRITICAL LINE-BY-LINE ALIGNMENT): 
     In the time frame column, do NOT just write a generic label. You must provide a line-by-line minute breakdown that visually matches the vertical layout of the "Learning Experiences" (preliminary, motivation, activities, evaluation, closing) or specific activity lines (such as Session 4, Session 5, Session 6 lines). Format it with precise vertical spacing or line breaks so each minute allocation sits horizontally level with its corresponding activity part.
     
   - SCHEDULE MAPPING: Map the provided Teacher Schedule slots into the "remarks" field based on period length, NOT chronological days:
     * RULE A: Map any 3-hour continuous block in the schedule EXCLUSIVELY to "Session 4-6".
     * RULE B: Map the 1-hour blocks sequentially to "Session 1", "Session 2", and "Session 3" for remaining days.
     * RULE C: Format the remarks EXACTLY like this for every section:
       [Section Name]
       [Session Name/Number]
       [Full Date, e.g., August 31, 2026]
       [Time Slot]
       [Specific Suspension/Interruption Dates if applicable]

6. SESSION FLEX RULE: 
   - OFFLINE/ASYNCHRONOUS. Provide ONLY bulleted "learning_activities". Set all other fields to empty strings "".
${lookbackContext}

Target Scope: ${cachedScope}
School Year: ${schoolYear}
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
}

// ==========================================
// RENDER UI
// ==========================================
function renderOverview() {
    const container = document.getElementById('weeklyOverviewContainer');
    if (!currentWeeklyOverview || !container) return;
    
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
    if(!container) return;

    container.innerHTML = '';
    
    if (!currentPlan || !currentPlan.length) {
        if(headerTitle) headerTitle.textContent = "Generated Plan";
        if(headerBadge) headerBadge.textContent = "No Data";
        container.innerHTML = '<div class="text-center text-gray-400 italic mt-20">Select your scope, grade level, and folders to generate plans.</div>';
        return;
    }

    if(headerTitle) headerTitle.textContent = `${currentTargetGrade} Lesson Plan`;
    if(headerBadge) headerBadge.textContent = `${currentPlan.length} Sessions`;

    currentPlan.forEach((session, index) => {
        const isFlex = session.session_name.toLowerCase().includes('flex');
        
        let html = `<div class="bg-white p-5 rounded border border-gray-200 shadow-sm mb-6">
            <h3 class="text-lg font-bold ${isFlex ? 'text-amber-600' : 'text-blue-800'} mb-4 border-b pb-2">${session.session_name} ${isFlex ? '(Asynchronous)' : ''}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">`;

        if (!isFlex) {
            html += `
                <div>
                    <label class="block text-[10px] font-extrabold text-blue-600 uppercase tracking-wider mb-1">Learning Competencies</label>
                    <textarea class="session-input w-full p-2 border border-blue-100 rounded text-sm bg-blue-50" rows="3" data-idx="${index}" data-key="competencies">${session.competencies || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold text-blue-600 uppercase tracking-wider mb-1">Specific Objectives</label>
                    <textarea class="session-input w-full p-2 border border-blue-100 rounded text-sm bg-blue-50" rows="3" data-idx="${index}" data-key="objectives">${session.objectives || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Preliminary Action</label>
                    <textarea class="session-input w-full p-2 border rounded text-sm bg-gray-50" rows="3" data-idx="${index}" data-key="preliminary">${session.preliminary || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Motivation / Recall</label>
                    <textarea class="session-input w-full p-2 border rounded text-sm bg-gray-50" rows="3" data-idx="${index}" data-key="motivation">${session.motivation || ''}</textarea>
                </div>`;
        }

        html += `
                <div class="md:col-span-2">
                    <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Learning Activities</label>
                    <textarea class="session-input w-full p-3 border border-gray-300 rounded text-sm bg-white font-mono leading-relaxed shadow-inner" rows="6" data-idx="${index}" data-key="learning_activities">${session.learning_activities || ''}</textarea>
                </div>`;

        if (!isFlex) {
            html += `
                <div>
                    <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Evaluation</label>
                    <textarea class="session-input w-full p-2 border rounded text-sm bg-gray-50" rows="2" data-idx="${index}" data-key="evaluation">${session.evaluation || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Closing Activities</label>
                    <textarea class="session-input w-full p-2 border rounded text-sm bg-gray-50" rows="2" data-idx="${index}" data-key="closing">${session.closing || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Values Integration</label>
                    <textarea class="session-input w-full p-2 border rounded text-sm bg-gray-50" rows="2" data-idx="${index}" data-key="values_integration">${session.values_integration || ''}</textarea>
                </div>
                <div>
                    <label class="block text-[10px] font-extrabold text-amber-600 uppercase tracking-wider mb-1">Remarks / Intervention</label>
                    <textarea class="session-input w-full p-2 border rounded text-sm bg-amber-50 border-amber-200" rows="2" data-idx="${index}" data-key="remarks">${session.remarks || ''}</textarea>
                </div>`;
        }

        html += `</div></div>`;
        container.insertAdjacentHTML('beforeend', html);
    });

    document.querySelectorAll('.session-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.getAttribute('data-idx');
            const key = e.target.getAttribute('data-key');
            currentPlan[idx][key] = e.target.value;
        });
    });
}

// ==========================================
// ACTION BUTTONS: SAVE, LOAD, DELETE & PRINT
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
    const dateRangeEl = document.getElementById('lpDateRange');
    
    const safeDocId = `${grade}_${subject}_${month}_${week}`.replace(/[^a-zA-Z0-9_]/g, "");

    const loaderText = document.querySelector('#globalLoader p');
    const originalText = loaderText ? loaderText.textContent : "Processing...";
    if(loaderText) loaderText.textContent = "Saving to Database...";
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
            date_range: dateRangeEl ? dateRangeEl.value : "",
            grade_level: grade,
            custom_instructions: document.getElementById('lpCustomInstructions').value.trim(),
            schedule: localStorage.getItem('lessonReview_schedule') || "",
            reference_folders: Array.from(document.querySelectorAll('.folder-checkbox:checked')).map(cb => cb.value),
            weekly_overview: currentWeeklyOverview,
            sessions: currentPlan,
            timestamp: new Date().toISOString()
        };

        await setDoc(doc(db, "lesson_plans", safeDocId), planData);
        alert("✅ Lesson Plan saved successfully!");
        return true; 
    } catch (e) {
        console.error("Error saving plan:", e);
        alert("Failed to save to database: " + e.message);
        return false; 
    } finally {
        if(loaderText) loaderText.textContent = originalText;
        document.getElementById('globalLoader').classList.replace('flex', 'hidden');
    }
};

window.openLoadPlanModal = async function() {
    const modal = document.getElementById('loadPlanModal');
    if (!modal) return alert("Modal HTML is missing!");
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
            const docId = docSnap.id; 
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
                    <button onclick='loadSpecificPlan(${JSON.stringify(data).replace(/'/g, "&#39;")})' class="px-3 py-2 bg-blue-600 text-white font-bold text-xs rounded hover:bg-blue-700 shadow transition">
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
    const modal = document.getElementById('loadPlanModal');
    if (modal) modal.classList.replace('flex', 'hidden');
};

window.deleteLessonPlan = async function(docId) {
    if (!confirm("Are you sure you want to delete this saved lesson plan?")) return;
    
    const loader = document.getElementById('globalLoader');
    if (loader) loader.classList.replace('hidden', 'flex');
    
    try {
        await deleteDoc(doc(db, "lesson_plans", docId));
        window.openLoadPlanModal(); 
    } catch (e) {
        alert("Failed to delete plan: " + e.message);
    } finally {
        if (loader) loader.classList.replace('flex', 'hidden');
    }
};

window.loadSpecificPlan = function(planData) {
    currentWeeklyOverview = planData.weekly_overview;
    currentPlan = planData.sessions;
    currentTargetGrade = planData.grade_level;

    document.getElementById('lpTeacherName').value = planData.teacher_name || '';
    document.getElementById('lpSubjectTitle').value = planData.subject_title || '';
    document.getElementById('lpSchoolYear').value = planData.school_year || '2026-2027';
    document.querySelectorAll('.folder-checkbox').forEach(cb => cb.checked = false);
    if (planData.reference_folders && Array.isArray(planData.reference_folders)) {
        planData.reference_folders.forEach(folderId => {
            const checkbox = document.querySelector(`.folder-checkbox[value="${folderId}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }
    if(planData.semester) document.getElementById('lpSemester').value = planData.semester;
    if(planData.quarter) document.getElementById('lpQuarter').value = planData.quarter;
    if(planData.month) document.getElementById('lpMonth').value = planData.month;
    if(planData.week) document.getElementById('lpWeek').value = planData.week;
    
    const dateRangeEl = document.getElementById('lpDateRange');
    if (dateRangeEl && planData.date_range) dateRangeEl.value = planData.date_range;
    const customInstructionsEl = document.getElementById('lpCustomInstructions');
    if(planData.grade_level) document.getElementById('lpGradeLevel').value = planData.grade_level;
    if (planData.schedule) {
        localStorage.setItem('lessonReview_schedule', planData.schedule);
    }
    renderOverview();
    renderOutput();
    closeLoadPlanModal();
    alert("✅ Lesson plan loaded successfully!");
};

// ==========================================
// FORMATTING HELPERS
// ==========================================
function formatObjectivesForPrint(text) {
    if (!text) return '';
    const items = text.split(/(?:^|\n)\s*(?:\d+[\.\)]|[-•*])\s*/).filter(Boolean);
    if (items.length <= 1) return text;
    let html = '<ol style="margin: 0; padding-left: 15px; list-style-type: decimal;">';
    items.forEach(item => { html += `<li style="margin-bottom: 3px;">${item.trim()}</li>`; });
    html += '</ol>';
    return html;
}

function formatMaterialsForPrint(text) {
    if (!text) return '';
    const items = text.split(/[-•]\s*/).filter(Boolean);
    if (items.length <= 1) return text;
    let html = '<ul style="margin: 0; padding-left: 15px; list-style-type: disc;">';
    items.forEach(item => { html += `<li style="margin-bottom: 3px;">${item.trim()}</li>`; });
    html += '</ul>';
    return html;
}

// NEW: Forces Preliminary Activities into a numbered list
function formatPreliminaryForPrint(text) {
    if (!text) return '';
    const items = text.split(/\n/).filter(item => item.trim() !== '');
    let html = '<ol style="margin: 0; padding-left: 15px; list-style-type: decimal;">';
    items.forEach(item => { 
        // Strips any existing dashes or numbers so we don't get double numbering
        let cleanItem = item.trim().replace(/^([-•*]|\d+[\.\)])\s*/, '');
        html += `<li style="margin-bottom: 3px;">${cleanItem}</li>`; 
    });
    html += '</ol>';
    return html;
}

// NEW: Forces Learning Activities into a numbered list
function formatLearningActivitiesForPrint(text) {
    if (!text) return '';
    // Split by dashes, bullets, or numbers at the start of a line
    let items = text.split(/(?:^|\n)\s*(?:[-•*]|\d+[\.\)])\s+/).filter(Boolean);
    
    // Fallback: if it didn't split well, just split by newlines
    if (items.length <= 1) {
        items = text.split(/\n/).filter(item => item.trim() !== '');
    }

    let html = '<ol style="margin: 0; padding-left: 15px; list-style-type: decimal;">';
    items.forEach(item => { 
        let cleanItem = item.trim().replace(/^[-•*]\s*/, '');
        html += `<li style="margin-bottom: 3px;">${cleanItem}</li>`; 
    });
    html += '</ol>';
    return html;
}

// ==========================================
// CORE LAYOUT BUILDER (Used by both Print & Word)
// ==========================================
function buildDocumentLayout() {
    if (!currentPlan || currentPlan.length === 0 || !currentWeeklyOverview) {
        alert("Please generate a lesson plan first before exporting.");
        return false;
    }

    // 1. Header Image
    const headerImgUrl = localStorage.getItem('lessonReview_headerImage');
    const headerImgEl = document.getElementById('printHeaderImage');
    const headerContainer = document.getElementById('printHeaderBannerContainer');
    if (headerImgUrl && headerImgEl) {
        headerImgEl.src = headerImgUrl;
        headerImgEl.classList.remove('hidden');
        if (headerContainer) headerContainer.classList.remove('hidden');
    }

    // 2. Updated Title & Metadata Formatting
    const rawSubject = document.getElementById('lpSubjectTitle').value || "SUBJECT";
    const rawSY = document.getElementById('lpSchoolYear').value || "2026-2027";
    
    document.getElementById('printMainTitle').textContent = `CURRICULUM MAP / LEARNING PLAN IN ${rawSubject.toUpperCase()}`;
    document.getElementById('printSYHeader').textContent = `SCHOOL YEAR ${rawSY}`;
    
    const textMap = {"1st": "First", "2nd": "Second", "3rd": "Third", "4th": "Fourth"};
    const formatOrdinal = (str) => str.replace(/1st|2nd|3rd|4th/g, match => textMap[match]);
    
    document.getElementById('printQuarter').textContent = formatOrdinal(document.getElementById('lpQuarter').value || "QUARTER");
    document.getElementById('printSemester').textContent = formatOrdinal(document.getElementById('lpSemester').value || "SEMESTER");
    
    const scopeWeek = document.getElementById('lpWeek').value;
    const scopeMonth = document.getElementById('lpMonth').value;
    const dateRangeEl = document.getElementById('lpDateRange');
    const dateRange = dateRangeEl ? dateRangeEl.value : "";
    document.getElementById('printScopeHeader').textContent = `${scopeWeek} of ${scopeMonth} ${dateRange ? '(' + dateRange + ')' : ''}`;

    // 3. Signatories
    document.getElementById('printSig1Name').textContent = localStorage.getItem('lessonReview_sigTeacher') || "";
    document.getElementById('printSig1Title').textContent = localStorage.getItem('lessonReview_sigTeacherTitle') || "";
    document.getElementById('printSig2Name').textContent = localStorage.getItem('lessonReview_sigSubjectCoord') || "";
    document.getElementById('printSig2Title').textContent = localStorage.getItem('lessonReview_sigSubjectCoordTitle') || "";
    document.getElementById('printSig3Name').textContent = localStorage.getItem('lessonReview_sigGradeCoord') || "";
    document.getElementById('printSig3Title').textContent = localStorage.getItem('lessonReview_sigGradeCoordTitle') || "";
    document.getElementById('printSig4Name').textContent = localStorage.getItem('lessonReview_sigPrincipal') || "";
    document.getElementById('printSig4Title').textContent = localStorage.getItem('lessonReview_sigPrincipalTitle') || "";

    // 4. Build Table Rows
    const tbody = document.getElementById('printTableBody');
    tbody.innerHTML = ''; 

    currentPlan.forEach((session, index) => {
        const isFlex = session.session_name.toLowerCase().includes('flex');
        const tr = document.createElement('tr');
        let rowHtml = ``;

        // Content Standards only print on the first row
        if (index === 0) {
            rowHtml += `
                <td style="font-weight: bold; text-align: center; vertical-align: middle;">${currentWeeklyOverview.topic || ''}</td>
                <td style="vertical-align: top;">
                    <strong>Content Standard:</strong><br>${currentWeeklyOverview.content_standard || ''}<br><br>
                    <strong>Performance Standard:</strong><br>${currentWeeklyOverview.performance_standard || ''}<br><br>
                    <strong>Formation Standard:</strong><br>${currentWeeklyOverview.formation_standard || ''}
                </td>
            `;
        } else {
            rowHtml += `<td></td><td></td>`;
        }

        // Apply all formatters to ensure strict list rendering
        const objText = formatObjectivesForPrint(session.objectives || 'N/A');
        const matText = formatMaterialsForPrint(currentWeeklyOverview.materials || '');
        const prelimText = formatPreliminaryForPrint(session.preliminary || '');
        const activitiesText = formatLearningActivitiesForPrint(session.learning_activities || '');

        rowHtml += `
            <td style="vertical-align: top;">
                <strong>Competencies:</strong><br>${session.competencies || 'N/A'}<br><br>
                <strong>Objectives:</strong><br>${objText}
            </td>
        `;

        let timeFrame = isFlex ? "Async" : "5 mins<br><br>5 mins<br><br>26 mins<br><br>10 mins<br><br>4 mins";
        if (session.session_name.includes("4-6")) {
            timeFrame = "10 mins<br><br>15 mins<br><br>40 mins<br><br>50 mins<br><br>25 mins<br><br>10 mins";
        }
        rowHtml += `<td style="text-align: center; font-weight: bold; vertical-align: middle; font-size: 10pt; line-height: 1.6;">${timeFrame}</td>`;

        // FULL LABELS RESTORED HERE
        let experiencesHTML = `<div style="font-weight: bold; margin-bottom: 4px;">${session.session_name}</div>`;
        if (!isFlex) {
            experiencesHTML += `
                <strong>Preliminary Activities:</strong><br><div style="padding-left: 8px;">${prelimText}</div><br>
                <strong>Motivation / Recall:</strong><br><div style="padding-left: 8px; white-space: pre-wrap;">${session.motivation || ''}</div><br>
            `;
        }
        
        experiencesHTML += `<strong>Learning Activities:</strong><br><div style="padding-left: 8px;">${activitiesText}</div>`;
        
        if (!isFlex) {
            experiencesHTML += `
                <br><strong>Evaluation:</strong><br><div style="padding-left: 8px; white-space: pre-wrap;">${session.evaluation || ''}</div><br>
                <strong>Closing Activities:</strong><br><div style="padding-left: 8px; white-space: pre-wrap;">${session.closing || ''}</div><br>
                <strong>Values Integration:</strong><br><div style="padding-left: 8px; white-space: pre-wrap;">${session.values_integration || ''}</div>
            `;
        }
        rowHtml += `<td style="vertical-align: top;">${experiencesHTML}</td>`;

        // PRINT MATERIALS ON EVERY ROW (Removed the index === 0 check)
        rowHtml += `<td style="white-space: pre-wrap; vertical-align: top;">${matText}</td>`;

        // REMARKS
        rowHtml += `<td style="white-space: pre-wrap; vertical-align: top;">${session.remarks || ''}</td>`;

        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });

    return true;
}

// ==========================================
// EXPORT TRIGGERS
// ==========================================
window.exportPDF = function() {
    if (buildDocumentLayout()) {
        setTimeout(() => { window.print(); }, 300);
    }
};

window.saveAndPrint = async function() {
    const isSaved = await window.saveLessonPlan();
    if (isSaved && buildDocumentLayout()) {
        setTimeout(() => { window.print(); }, 300);
    }
};
// ==========================================
// TRUE .DOCX EXPORTER (Landscape + Embedded Images)
// ==========================================
window.exportToWordDoc = function() {
    if (typeof htmlDocx === 'undefined') {
        alert("The Word Document generator is still loading. Please wait a second and try again.");
        return;
    }

    if (!buildDocumentLayout()) return;

    const printWrapper = document.getElementById('printDocumentWrapper');
    
    // Strip <thead> tags so headers DO NOT repeat on every page
let cleanHtml = printWrapper.innerHTML.replace(/<thead.*?>/gi, '').replace(/<\/thead>/gi, '');

// MS Word ignores CSS image sizing. Force the height directly onto the img tag!
cleanHtml = cleanHtml.replace(/<img /gi, '<img height="80" ');
    // Wrap in a pristine, standard HTML shell designed for the generator
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                /* WORD-SPECIFIC FOLIO LANDSCAPE OVERRIDE */
                @page WordSection1 { 
                    size: 13.0in 8.5in; 
                    mso-page-orientation: landscape; 
                    margin: 0.5in 0.5in 0.5in 0.5in; 
                }
                div.WordSection1 { page: WordSection1; }
                
                /* FORCE ARIAL NARROW AND 10PT GLOBALLY */
                body { font-family: 'Arial Narrow', Arial, sans-serif; font-size: 10pt; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #000; padding: 6px 8px; font-size: 10pt; vertical-align: top; }
                th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
                img { max-height: 80px; display: block; margin: 0 auto 10px auto; }
            </style>
        </head>
        <body>
            ${cleanHtml}
        </body>
        </html>
    `;

    // 🚀 THE MAGIC: Generate a REAL .docx file in Landscape mode with 0.5-inch margins
    const blob = htmlDocx.asBlob(htmlContent, { 
        orientation: 'landscape',
        margins: { top: 720, right: 720, bottom: 720, left: 720 } // 720 twips = 0.5 inches
    });
    
    // Download as a true .docx file
    const subjectTitle = document.getElementById('lpSubjectTitle')?.value || "Lesson_Plan";
    const filename = `${subjectTitle.replace(/[^a-zA-Z0-9]/g, "_")}_LessonPlan.docx`; 
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};