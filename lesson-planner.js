let currentPlan = [];
let currentWeeklyOverview = null;
let currentTargetGrade = '';
let cachedCompiledText = '';
let cachedSchedule = '';
let cachedScope = '';
let cachedCustomInstructions = '';

document.addEventListener('DOMContentLoaded', () => {
    loadLibraryFolders();
});

window.showLoader = function() { document.getElementById('globalLoader').classList.replace('hidden', 'flex'); };
window.hideLoader = function() { document.getElementById('globalLoader').classList.replace('flex', 'hidden'); };

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

// --- STEP 1: INITIATE FLOW & CHECK FOR AI QUESTIONS ---
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

    window.showLoader();

    try {
        const preCheckPrompt = `
You are an expert curriculum assistant. Review the user's custom instructions and target scope. 
If the custom instructions are completely clear and actionable, respond with EXACTLY the word: "READY".
If the custom instructions are ambiguous, conflicting, or missing crucial details needed to build a professional lesson plan, respond with a clear, polite question asking the user for clarification.

Target Scope: ${cachedScope}
Custom Instructions: ${cachedCustomInstructions || "None provided."}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: preCheckPrompt }] }] })
        });

        if (!response.ok) throw new Error("Pre-check failed.");
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

        if (!response.ok) throw new Error("API Error: " + response.statusText);
        
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