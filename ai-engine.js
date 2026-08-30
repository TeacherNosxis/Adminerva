window.initiateGenerationFlow = async function() {
    const gemKey = localStorage.getItem('repoReview_gemini_token');
    const model = localStorage.getItem('repoReview_ai_model') || 'gemini-1.5-flash'; 
    if (!gemKey) return alert("Missing Gemini API Key in Global Settings.");

    const customInstructionsText = document.getElementById('lpCustomInstructions').value.trim();
    const selectedCheckboxes = document.querySelectorAll('.folder-checkbox:checked');

    if (selectedCheckboxes.length === 0 && !customInstructionsText) {
        return alert("Please select at least one reference folder OR provide Custom Instructions to generate a plan.");
    }
    
    const libraryData = JSON.parse(localStorage.getItem('lessonReview_library') || '[]');
    window.cachedCompiledText = "";

    if (selectedCheckboxes.length > 0) {
        selectedCheckboxes.forEach(cb => {
            const folder = libraryData.find(f => f.id === cb.value);
            if (folder && folder.documents) {
                folder.documents.forEach(doc => {
                    window.cachedCompiledText += `\n\n--- DOCUMENT: ${doc.title} ---\n${doc.text}`;
                });
            }
        });

        if (!window.cachedCompiledText.trim() && !customInstructionsText) {
            return alert("The selected folders are empty. Please provide Custom Instructions or select a folder with documents.");
        }
    }

    // 🚀 EXACT SETTINGS DATA MAP
    const subject = localStorage.getItem('lessonReview_defaultSubject') || "Subject";
    window.cachedSchedule = localStorage.getItem('lessonReview_schedule') || "No schedule provided.";

    // 🚀 EXACT 5-COLUMN UI MAP
    const academicTerm = document.getElementById('lpAcademicTerm').value;
    const courseWeek = document.getElementById('lpCourseWeek').value;
    const dateRange = document.getElementById('lpDateRange').value || "No Dates Provided";

    window.currentTargetGrade = document.getElementById('lpGradeLevel').value;
    
    // Format scope nicely for the AI Prompt
    window.cachedScope = `${courseWeek}: ${dateRange} (${academicTerm})`;
    window.cachedCustomInstructions = document.getElementById('lpCustomInstructions').value.trim();

    // Look back for suspension/catch-up data using the new Term/Week strings
    window.cachedPreviousPlan = await window.fetchPreviousPlan(window.currentTargetGrade, subject, academicTerm, courseWeek);

    if (!window.cachedCustomInstructions) {
        window.executeFinalGeneration("");
        return;
    }

    window.showLoader();

    try {
        const preCheckPrompt = `
You are an expert curriculum assistant. Review ONLY the Custom Instructions. 
- Do NOT ask for grade level or subject topics, as those are handled automatically.
- If the custom instructions are clear and actionable (like noting suspensions or exams), respond with EXACTLY the word: "READY".
- If the instructions are ambiguous, ask a concise clarifying question.

Target Grade & Scope: ${window.currentTargetGrade}, ${window.cachedScope}
Custom Instructions: ${window.cachedCustomInstructions}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: preCheckPrompt }] }] })
        });

        if (!response.ok) throw new Error(`Pre-check failed (${response.status})`);

        const result = await response.json();
        const aiReply = result.candidates[0].content.parts[0].text.trim();

        if (aiReply.toUpperCase().startsWith("READY")) {
            window.executeFinalGeneration(""); 
        } else {
            window.hideLoader(); 
            document.getElementById('aiQuestionBox').textContent = aiReply;
            document.getElementById('aiClarificationModal').classList.replace('hidden', 'flex');
        }
    } catch (e) {
        window.executeFinalGeneration(""); 
    }
};

window.cancelClarification = function() {
    document.getElementById('aiClarificationModal').classList.replace('flex', 'hidden');
};

window.submitClarificationAndProceed = function() {
    const userResponse = document.getElementById('userClarificationInput').value.trim();
    document.getElementById('aiClarificationModal').classList.replace('flex', 'hidden');
    window.executeFinalGeneration(userResponse);
};

window.executeFinalGeneration = async function(userClarification) {
    const gemKey = localStorage.getItem('repoReview_gemini_token');
    const model = localStorage.getItem('repoReview_ai_model') || 'gemini-1.5-flash'; 
    const schoolYear = document.getElementById('lpSchoolYear').value || "2026-2027";
    
    // 🚀 DYNAMICALLY PULL THE SUBJECT SO IT NEVER HARDCODES
    const subject = localStorage.getItem('lessonReview_defaultSubject') || "Subject";

    let gradeSpecificRules = "";
    if (window.currentTargetGrade === "Grade 11") {
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
    if (window.cachedPreviousPlan) {
        lookbackContext = `
7. CATCH-UP & SUSPENSION RULE (CRITICAL):
   - Review "Last Week's Curriculum State" provided below.
   - Look specifically at the "remarks" field for each session.
   - If any session from last week was marked as suspended, interrupted, unfinished, or missed, you MUST make the early sessions of THIS week a catch-up/continuation for that missing content BEFORE introducing new topics.
   - Explicitly mention in the new session's remarks that it is a catch-up from last week.

LAST WEEK'S CURRICULUM STATE:
${JSON.stringify(window.cachedPreviousPlan.sessions.map(s => ({name: s.session_name, activities: s.learning_activities, remarks: s.remarks})), null, 2)}
        `;
    }

    const prompt = `
You are an expert curriculum developer. Based on the Reference Text, Target Scope, and Custom Instructions, generate a highly structured JSON lesson plan for ${window.currentTargetGrade}.

CRITICAL FORMATTING RULES:
1. "weekly_overview": 
   - "topic": Keep short and punchy.
   - "content_standard", "performance_standard", "formation_standard", and "materials": MANDATORY FIELDS. Professionally infer them based on the text if needed.
   - MATERIALS FORMAT: You MUST format the "materials" field as a heavily bulleted list using dashes (-). Do NOT output a single comma-separated paragraph. Ensure each item is on its own line.
   - FALLBACK KNOWLEDGE: If no Reference Text is provided, or if this is a Tech-Voc/TVL subject, you MUST utilize standard DepEd (Department of Education) and TESDA curriculum guides to formulate standards and content accurately.
2. "sessions" array: Generate daily sessions.
${gradeSpecificRules}
5. SESSION DETAILS (Normal): 
   - "competencies": Provide 1 to 2 clear learning competencies.
   - "objectives": Provide strictly 3 to 4 detailed behavioral objectives based on Bloom’s Taxonomy, explicitly covering cognitive, psychomotor, and affective domains where applicable.
   - "preliminary" MUST always start with: "Opening Prayer\nAttendance Checking\nTECHNOTES".
   - "motivation": Briefly describe the activity AND explicitly state the specific teaching strategy used.
   - "learning_activities": Heavily bulleted using dashes (-). Every bullet MUST begin with an "-ing" verb AND you must explicitly integrate the teaching strategies utilized.
   - "evaluation": Suggest diverse and appropriate formative or summative assessments based on the topic. Do NOT default to a Quipper quiz.
   - "values_integration": Output ONLY core value keywords, optionally followed by a short phrase or definition connecting it to the lesson.

   - TIME FRAME MAPPING (CRITICAL LINE-BY-LINE ALIGNMENT): 
     In the time frame column, do NOT just write a generic label. You must provide a line-by-line minute breakdown that visually matches the vertical layout of the "Learning Experiences" or specific activity lines. Format it with precise vertical spacing or line breaks so each minute allocation sits horizontally level with its corresponding activity part.

   - SCHEDULE MAPPING (CRITICAL MULTI-SECTION SCAN): Map the provided Teacher Schedule slots into the "remarks" field based on period length, NOT chronological days:
     * RULE A: Map any 3-hour continuous block in the schedule EXCLUSIVELY to "Session 4-6".
     * RULE B: Map the 1-hour blocks sequentially to "Session 1", "Session 2", and "Session 3" for remaining days.
     * RULE C: You MUST scan the ENTIRE provided Teacher Schedule. Identify EVERY section taking ${subject} for ${window.currentTargetGrade}. Do NOT stop at the first match.
     * RULE D: List the schedule for ALL matching sections for this specific session number. If there are multiple sections, separate them with a semicolon (;).
     * RULE E: Format the schedule strictly using pipes (|) for line breaks. Example: [Section A] | [Full Date] | [Time Slot]; [Section B] | [Full Date] | [Time Slot]
     * RULE F: After listing all sections, append any class suspensions, interruptions, or custom instructions requested by the user.

6. SESSION FLEX RULE: 
   - OFFLINE/ASYNCHRONOUS. Provide ONLY bulleted "learning_activities". Set all other fields to empty strings "".
${lookbackContext}

Target Scope: ${window.cachedScope}
School Year: ${schoolYear}
Custom Instructions: ${window.cachedCustomInstructions}
User Clarification: ${userClarification || "None"}
Teacher Schedule:
${window.cachedSchedule}

Reference Text:
${window.cachedCompiledText.substring(0, 25000)}
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

        window.currentWeeklyOverview = planData.weekly_overview;
        window.currentPlan = planData.sessions;

        window.renderOverview();
        window.renderOutput();

    } catch(e) {
        alert("Generation failed: " + e.message);
    } finally {
        window.hideLoader();
    }
};