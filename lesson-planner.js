let currentGrade11Plan = [];
let currentGrade12Plan = [];
let activeTab = 'g11';

window.showLoader = function() { document.getElementById('globalLoader').classList.replace('hidden', 'flex'); };
window.hideLoader = function() { document.getElementById('globalLoader').classList.replace('flex', 'hidden'); };

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

window.generateLessonPlan = async function() {
    const gemKey = localStorage.getItem('repoReview_gemini_token');
    const model = localStorage.getItem('repoReview_ai_model') || 'gemini-3.5-flash';
    if (!gemKey) return alert("Missing Gemini API Key in Global Settings.");

    const fileInput = document.getElementById('lpReferenceFile');
    if (!fileInput.files.length) return alert("Please upload a reference document (.txt or .md) for context.");

    // Retrieve the teacher schedule (We will build the page for this next)
    const rawSchedule = localStorage.getItem('lessonReview_schedule') || "No schedule provided. Leave schedule fields generic.";

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        const referenceText = e.target.result;
        
        // Grab form inputs for context
        const topic = document.getElementById('lpContent').value;
        const objectives = document.getElementById('lpObjectives').value;

        const prompt = `
You are an expert curriculum developer. Based on the provided Reference Text, Topic, and Objectives, generate a highly structured JSON lesson plan.

CRITICAL FORMATTING RULES:
1. You MUST generate two distinct arrays in your JSON response: "grade_11" and "grade_12".
2. GRADE 11 RULE: Create exactly 5 sessions named: "Session 1", "Session 2", "Session 3", "Session 4-6", and "Session Flex".
3. GRADE 12 RULE: Compress the topics into exactly 4 sessions named: "Session 1", "Session 2", "Session 3", and "Session Flex". (Do NOT include a 4-6 Lab).
4. PRELIMINARY RULE: "preliminary" MUST always start with: "Opening Prayer\nAttendance Checking\nTECHNOTES".
5. MOTIVATION RULE: "motivation" MUST contain a mini-game, warm-up, or recall activity.
6. ACTIVITIES RULE: Every sentence in "learning_activities" MUST begin with an "-ing" verb (e.g., "Discussing...", "Creating...").
7. EVALUATION RULE: "evaluation" MUST reference a 10-item Quipper quiz.
8. REMARKS RULE: Map the provided Teacher Schedule into the "remarks" field for the corresponding sessions.

Topic: ${topic}
Objectives: ${objectives}
Teacher Schedule:
${rawSchedule}

Reference Text:
${referenceText.substring(0, 15000)}
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
                                grade_11: {
                                    type: "ARRAY",
                                    items: {
                                        type: "OBJECT",
                                        properties: {
                                            session_name: { type: "STRING" },
                                            preliminary: { type: "STRING" },
                                            motivation: { type: "STRING" },
                                            learning_activities: { type: "STRING", description: "Use -ing verbs." },
                                            evaluation: { type: "STRING", description: "Include 10-item Quipper quiz." },
                                            closing: { type: "STRING" },
                                            values_integration: { type: "STRING" },
                                            remarks: { type: "STRING" }
                                        },
                                        required: ["session_name", "preliminary", "motivation", "learning_activities", "evaluation", "closing", "values_integration", "remarks"]
                                    }
                                },
                                grade_12: {
                                    type: "ARRAY",
                                    items: {
                                        type: "OBJECT",
                                        properties: {
                                            session_name: { type: "STRING" },
                                            preliminary: { type: "STRING" },
                                            motivation: { type: "STRING" },
                                            learning_activities: { type: "STRING" },
                                            evaluation: { type: "STRING" },
                                            closing: { type: "STRING" },
                                            values_integration: { type: "STRING" },
                                            remarks: { type: "STRING" }
                                        },
                                        required: ["session_name", "preliminary", "motivation", "learning_activities", "evaluation", "closing", "values_integration", "remarks"]
                                    }
                                }
                            },
                            required: ["grade_11", "grade_12"]
                        }
                    }
                })
            });

            if (!response.ok) throw new Error("API Error: " + response.statusText);
            
            const aiResult = await response.json();
            let rawJson = aiResult.candidates[0].content.parts[0].text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
            const planData = JSON.parse(rawJson);

            currentGrade11Plan = planData.grade_11;
            currentGrade12Plan = planData.grade_12;
            renderOutput();

        } catch(e) {
            alert("Generation failed: " + e.message);
        } finally {
            window.hideLoader();
        }
    };
    reader.readAsText(file);
};

function renderOutput() {
    const container = document.getElementById('outputContainer');
    container.innerHTML = '';
    
    const activePlan = activeTab === 'g11' ? currentGrade11Plan : currentGrade12Plan;

    if (!activePlan.length) {
        container.innerHTML = '<div class="text-center text-gray-400 italic mt-20">No data generated yet.</div>';
        return;
    }

    activePlan.forEach((session, index) => {
        container.insertAdjacentHTML('beforeend', `
            <div class="bg-white p-5 rounded border border-gray-200 shadow-sm mb-6">
                <h3 class="text-lg font-bold text-blue-800 mb-4 border-b pb-2">${session.session_name}</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Preliminary Action</label>
                        <textarea class="w-full p-2 border rounded text-sm bg-gray-50" rows="3">${session.preliminary}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Motivation / Recall</label>
                        <textarea class="w-full p-2 border rounded text-sm bg-gray-50" rows="3">${session.motivation}</textarea>
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Learning Activities</label>
                        <textarea class="w-full p-2 border rounded text-sm bg-gray-50" rows="4">${session.learning_activities}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Evaluation</label>
                        <textarea class="w-full p-2 border rounded text-sm bg-gray-50" rows="2">${session.evaluation}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Closing Activities</label>
                        <textarea class="w-full p-2 border rounded text-sm bg-gray-50" rows="2">${session.closing}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">Values Integration</label>
                        <textarea class="w-full p-2 border rounded text-sm bg-gray-50" rows="2">${session.values_integration}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-extrabold text-blue-600 uppercase tracking-wider mb-1">Remarks / Intervention</label>
                        <textarea class="w-full p-2 border rounded text-sm bg-blue-50 border-blue-200" rows="2">${session.remarks}</textarea>
                    </div>
                </div>
            </div>
        `);
    });
}