let currentGrade11Plan = [];
let currentGrade12Plan = [];
let currentWeeklyOverview = null;
let activeTab = 'g11';
let loaderInterval;

const loaderMessages = [
    "AI Architecting Syllabus...",
    "Analyzing DepEd & TESDA standards...",
    "Cross-referencing your Master Schedule...",
    "Structuring Grade 11 & 12 sessions...",
    "Formatting activities for the RepoReview System...",
    "Finalizing lesson plan JSON..."
];

document.addEventListener('DOMContentLoaded', () => {
    loadLibraryFolders();
});

window.showLoader = function() { 
    document.getElementById('globalLoader').classList.replace('hidden', 'flex'); 
    let msgIndex = 0;
    const msgElement = document.getElementById('loaderDynamicText');
    msgElement.textContent = loaderMessages[0];
    
    loaderInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % loaderMessages.length;
        msgElement.style.opacity = 0; // Fade out effect
        setTimeout(() => {
            msgElement.textContent = loaderMessages[msgIndex];
            msgElement.style.opacity = 1; // Fade in effect
        }, 300); // 300ms transition
    }, 4000);
};

window.hideLoader = function() { 
    document.getElementById('globalLoader').classList.replace('flex', 'hidden'); 
    clearInterval(loaderInterval);
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
    const model = localStorage.getItem('repoReview_ai_model') || 'gemini-3.5-flash'; 
    if (!gemKey) return alert("Missing Gemini API Key in Global Settings.");

    // Compile Context
    const masterContext = document.getElementById('lpContent').value;
    const selectedCheckboxes = document.querySelectorAll('.folder-checkbox:checked');
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

    if (!masterContext.trim() && !compiledReferenceText.trim()) {
        return alert("Please provide Master Context text or select a Reference Folder.");
    }

    const rawSchedule = localStorage.getItem('lessonReview_schedule') || "No schedule provided. Leave schedule fields generic.";
    const targetMonth = document.getElementById('lpMonth').value;
    const targetWeek = document.getElementById('lpWeek').value;
    const weekScope = `${targetWeek} of ${targetMonth}`;

    const prompt = `
You are an expert curriculum developer. Based on the provided "Master Context" AND "Reference Text", generate a highly structured JSON lesson plan.

CRITICAL FORMATTING RULES:
1. "weekly_overview": Extract the overarching topic, content standard, performance standard, formation standard, and materials. You MUST actively extract these from the "Master Context" text provided. If not explicitly stated, infer them professionally based on the topic.
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
7. SESSION FLEX RULE (Grade 11 & 12): 
   - This is OFFLINE/ASYNCHRONOUS. 
   - Provide ONLY bulleted "learning_activities" (e.g. assignments, modules to read). 
   - You MUST set preliminary, motivation, evaluation, closing, values_integration, remarks, competencies, and objectives to an empty string "". Do NOT put "N/A", just leave them completely empty.

Target Scope: ${weekScope}
Master Context (DepEd/TESDA Specs): ${masterContext}
Teacher Schedule:
${rawSchedule}

Reference Text (Library Folders):
${compiledReferenceText.substring(0, 25000)}
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

        if (!response.ok) throw new Error("API Error: " + response.statusText);
        
        const aiResult = await response.json();
        let rawJson = aiResult.candidates[0].content.parts[0].text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const planData = JSON.parse(rawJson);

        currentWeeklyOverview = planData.weekly_overview;
        currentGrade11Plan = planData.grade_11;
        currentGrade12Plan = planData.grade_12;
        
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