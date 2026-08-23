let currentGrade11Plan = [];
let currentGrade12Plan = [];
let currentWeeklyOverview = null;
let activeTab = 'g11';

// --- TIMER & BIBLE VERSE ENGINE ---
let timerInterval;
let verseInterval;
let elapsedSeconds = 0;

const bibleVerses = [
    "The fear of the Lord is the beginning of knowledge, but fools despise wisdom and instruction. - Proverbs 1:7",
    "For the Lord gives wisdom; from his mouth come knowledge and understanding. - Proverbs 2:6",
    "Trust in the Lord with all your heart and lean not on your own understanding. - Proverbs 3:5",
    "Instruct the wise and they will be wiser still; teach the righteous and they will add to their learning. - Proverbs 9:9",
    "Apply your heart to instruction and your ears to words of knowledge. - Proverbs 23:12",
    "Let the wise hear and increase in learning, and the one who understands obtain guidance. - Proverbs 1:5",
    "Do not conform to the pattern of this world, but be transformed by the renewing of your mind. - Romans 12:2",
    "If any of you lacks wisdom, you should ask God, who gives generously to all without finding fault. - James 1:5",
    "Commit your work to the Lord, and your plans will be established. - Proverbs 16:3",
    "Show me your ways, Lord, teach me your paths. - Psalm 25:4",
    "Whatever you do, work at it with all your heart, as working for the Lord, not for human masters. - Colossians 3:23",
    "An intelligent heart acquires knowledge, and the ear of the wise seeks knowledge. - Proverbs 18:15",
    "The heart of the discerning acquires knowledge, for the ears of the wise seek it out. - Proverbs 18:15",
    "Let my teaching fall like rain and my words descend like dew, like showers on new grass. - Deuteronomy 32:2",
    "I will instruct you and teach you in the way you should go; I will counsel you with my loving eye on you. - Psalm 32:8",
    "For everything that was written in the past was written to teach us, so that through the endurance taught in the Scriptures and the encouragement they provide we might have hope. - Romans 15:4",
    "The unfolding of your words gives light; it gives understanding to the simple. - Psalm 119:130",
    "Listen to advice and accept discipline, and at the end you will be counted among the wise. - Proverbs 19:20",
    "Blessed is the one who finds wisdom, and the one who gets understanding. - Proverbs 3:13",
    "Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth. - 2 Timothy 2:15"
    // You can paste up to 200 more verses directly into this array!
];

document.addEventListener('DOMContentLoaded', () => {
    loadLibraryFolders();
});

window.showLoader = function() { 
    document.getElementById('globalLoader').classList.replace('hidden', 'flex'); 
    elapsedSeconds = 0;
    document.getElementById('elapsedTime').textContent = '0s';
    
    const verseEl = document.getElementById('bibleVerse');
    verseEl.textContent = bibleVerses[Math.floor(Math.random() * bibleVerses.length)];
    
    // Timer
    timerInterval = setInterval(() => {
        elapsedSeconds++;
        document.getElementById('elapsedTime').textContent = elapsedSeconds + 's';
    }, 1000);

    // Rotate Verse every 8 seconds
    verseInterval = setInterval(() => {
        verseEl.style.opacity = 0; // fade out
        setTimeout(() => {
            verseEl.textContent = bibleVerses[Math.floor(Math.random() * bibleVerses.length)];
            verseEl.style.opacity = 1; // fade in
        }, 500);
    }, 8000);
};

window.hideLoader = function() { 
    document.getElementById('globalLoader').classList.replace('flex', 'hidden'); 
    clearInterval(timerInterval);
    clearInterval(verseInterval);
};

window.switchTab = function(tab) {
    activeTab = tab;
    document.getElementById('tab-g11').className = tab === 'g11' 
        ? "flex-1 py-3 text-sm font-bold border-b-2 border-blue-600 text-blue-700 transition" 
        : "flex-1 py-3 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition";
    
    document.getElementById('tab-g12').className = tab === 'g12' 
        ? "flex-1 py-3 text-sm font-bold border-b-2 border-blue-600 text-blue-700 transition" 
        : "flex-1 py-3 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition";
        
    renderOutput();
};

function loadLibraryFolders() {
    const libraryData = JSON.parse(localStorage.getItem('lessonReview_library') || '[]');
    const container = document.getElementById('libraryFolderContainer');
    container.innerHTML = '';

    if (libraryData.length === 0) {
        container.innerHTML = '<div class="text-xs text-gray-500 italic">No folders found. Go to the Reference Library to extract your PDFs first.</div>';
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

window.generateLessonPlan = async function() {
    const gemKey = localStorage.getItem('repoReview_gemini_token');
    // Using your requested working model
    const model = localStorage.getItem('repoReview_ai_model') || 'gemini-3.5-flash'; 
    if (!gemKey) return alert("Missing Gemini API Key in Global Settings.");

    const masterContext = document.getElementById('lpContent').value;
    const selectedCheckboxes = document.querySelectorAll('.folder-checkbox:checked');
    
    if (selectedCheckboxes.length === 0 && !masterContext.trim()) {
        return alert("Please paste Master Context OR select a reference folder.");
    }

    const libraryData = JSON.parse(localStorage.getItem('lessonReview_library') || '[]');
    let compiledReferenceText = "";
    
    selectedCheckboxes.forEach(cb => {
        const folder = libraryData.find(f => f.id === cb.value);
        if (folder && folder.documents) {
            folder.documents.forEach(doc => {
                compiledReferenceText += `\n\n--- DOCUMENT: ${doc.title} ---\n${doc.text}`;
            });
        }
    });

    const rawSchedule = localStorage.getItem('lessonReview_schedule') || "No schedule provided. Leave schedule fields generic.";
    const targetMonth = document.getElementById('lpMonth').value;
    const targetWeek = document.getElementById('lpWeek').value;
    const weekScope = `${targetWeek} of ${targetMonth}`;

    const prompt = `
You are an expert curriculum developer. Based on the provided Master Context, Reference Text, and Target Scope, generate a highly structured JSON lesson plan.

CRITICAL FORMATTING RULES:
1. "weekly_overview": Generate the overarching topic, content standard, performance standard, formation standard, and required materials for the whole week based on the Reference Text and Master Context.
2. "grade_11" & "grade_12" arrays: Generate the daily sessions.
3. GRADE 11 SESSIONS: Create exactly 5 sessions named: "Session 1", "Session 2", "Session 3", "Session 4-6", and "Session Flex".
4. GRADE 12 SESSIONS: Compress topics into exactly 4 sessions named: "Session 1", "Session 2", "Session 3", and "Session Flex".
5. SESSION DETAILS (Normal): 
   - "competencies" and "objectives" MUST be unique per session.
   - "learning_activities" MUST be heavily bulleted using standard dashes (-). Every bullet MUST begin with an "-ing" verb.
   - "preliminary" MUST always start with: "Opening Prayer\nAttendance Checking\nTECHNOTES".
   - "evaluation" MUST reference a 10-item Quipper quiz.
   - Map the provided Teacher Schedule into the "remarks" field.
6. SESSION 4-6 RULE (Grade 11 ONLY): 
   - This is a 3-hour period. Share the same objectives/competencies.
   - You MUST format the "learning_activities" explicitly like this:
     Session 4:
      - (Good for 50 mins activity using -ing verbs)
     Session 5:
      - (Good for 50 mins activity using -ing verbs)
     Session 6:
      - (Good for 50 mins activity using -ing verbs)
7. SESSION FLEX RULE: 
   - This is OFFLINE/ASYNCHRONOUS. 
   - Provide ONLY bulleted "learning_activities". 
   - You MUST set preliminary, motivation, evaluation, closing, values_integration, remarks, competencies, and objectives to an empty string "". Do NOT put "N/A", just leave them completely empty.

Target Scope: ${weekScope}
Master Context (DepEd/TESDA Specs): ${masterContext}
Teacher Schedule:
${rawSchedule}

Reference Text:
${compiledReferenceText.substring(0, 25000)}
    `;

    window.showLoader();

    // 90-Second Timeout & Rate Limit Shield
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); 

    try {
        const response = await fetch(`[https://generativelanguage.googleapis.com/v1beta/models/$](https://generativelanguage.googleapis.com/v1beta/models/$){model}:generateContent?key=${gemKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.2,
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
                                }
                            },
                            grade_11: {
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
                            },
                            grade_12: {
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
                        required: ["weekly_overview", "grade_11", "grade_12"]
                    }
                }
            })
        });

        clearTimeout(timeoutId);

        // Error Catching Shield
        if (response.status === 429) {
            throw new Error("Rate limit exceeded (429). The AI is receiving too many requests. Please wait a minute and try again.");
        }
        if (!response.ok) throw new Error(`API Error ${response.status}: ${response.statusText}`);
        
        const aiResult = await response.json();
        let rawJson = aiResult.candidates[0].content.parts[0].text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const planData = JSON.parse(rawJson);

        currentWeeklyOverview = planData.weekly_overview;
        currentGrade11Plan = planData.grade_11;
        currentGrade12Plan = planData.grade_12;
        
        renderOverview();
        renderOutput();

    } catch(e) {
        if (e.name === 'AbortError') {
            alert("The generation timed out after 90 seconds. The AI might be overloaded, or the selected folders are too large.");
        } else {
            alert("Generation failed: " + e.message);
        }
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
    container.innerHTML = '';
    
    const activePlan = activeTab === 'g11' ? currentGrade11Plan : currentGrade12Plan;

    if (!activePlan || !activePlan.length) {
        container.innerHTML = '<div class="text-center text-gray-400 italic mt-20">No data generated yet.</div>';
        return;
    }

    activePlan.forEach(session => {
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