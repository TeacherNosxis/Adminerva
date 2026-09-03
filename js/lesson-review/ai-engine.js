window.initiateGenerationFlow = async function () {
  const gemKey = localStorage.getItem("repoReview_gemini_token");
  const model =
    localStorage.getItem("repoReview_ai_model") || "gemini-1.5-flash";
  if (!gemKey) return alert("Missing Gemini API Key in Global Settings.");

  const customInstructionsText = document
    .getElementById("lpCustomInstructions")
    .value.trim();
  const selectedCheckboxes = document.querySelectorAll(
    ".folder-checkbox:checked",
  );

  if (selectedCheckboxes.length === 0 && !customInstructionsText) {
    return alert(
      "Please select at least one reference folder OR provide Custom Instructions to generate a plan.",
    );
  }

  const libraryData = JSON.parse(
    localStorage.getItem("lessonReview_library") || "[]",
  );
  window.cachedCompiledText = "";

  if (selectedCheckboxes.length > 0) {
    selectedCheckboxes.forEach((cb) => {
      const folder = libraryData.find((f) => f.id === cb.value);
      if (folder && folder.documents) {
        folder.documents.forEach((doc) => {
          window.cachedCompiledText += `\n\n--- DOCUMENT: ${doc.title} ---\n${doc.text}`;
        });
      }
    });

    if (!window.cachedCompiledText.trim() && !customInstructionsText) {
      return alert(
        "The selected folders are empty. Please provide Custom Instructions or select a folder with documents.",
      );
    }
  }

  // 🚀 EXACT SETTINGS DATA MAP
  const subject =
    localStorage.getItem("lessonReview_defaultSubject") || "Subject";
  window.cachedSchedule =
    localStorage.getItem("lessonReview_schedule") || "No schedule provided.";

  // 🚀 EXACT 5-COLUMN UI MAP
  const academicTerm = document.getElementById("lpAcademicTerm").value;
  const courseWeek = document.getElementById("lpCourseWeek").value;
  const dateRange =
    document.getElementById("lpDateRange").value || "No Dates Provided";

  window.currentTargetGrade = document.getElementById("lpGradeLevel").value;

  // Format scope nicely for the AI Prompt
  window.cachedScope = `${courseWeek}: ${dateRange} (${academicTerm})`;
  window.cachedCustomInstructions = document
    .getElementById("lpCustomInstructions")
    .value.trim();

  // Look back for suspension/catch-up data using the new Term/Week strings
  window.cachedPreviousPlan = await window.fetchPreviousPlan(
    window.currentTargetGrade,
    subject,
    academicTerm,
    courseWeek,
  );

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: preCheckPrompt }] }],
        }),
      },
    );

    if (!response.ok) throw new Error(`Pre-check failed (${response.status})`);

    const result = await response.json();
    const aiReply = result.candidates[0].content.parts[0].text.trim();

    if (aiReply.toUpperCase().startsWith("READY")) {
      window.executeFinalGeneration("");
    } else {
      window.hideLoader();
      document.getElementById("aiQuestionBox").textContent = aiReply;
      document
        .getElementById("aiClarificationModal")
        .classList.replace("hidden", "flex");
    }
  } catch (e) {
    window.executeFinalGeneration("");
  }
};

window.cancelClarification = function () {
  document
    .getElementById("aiClarificationModal")
    .classList.replace("flex", "hidden");
};

window.submitClarificationAndProceed = function () {
  const userResponse = document
    .getElementById("userClarificationInput")
    .value.trim();
  document
    .getElementById("aiClarificationModal")
    .classList.replace("flex", "hidden");
  window.executeFinalGeneration(userResponse);
};

window.executeFinalGeneration = async function (userClarification) {
  const gemKey = localStorage.getItem("repoReview_gemini_token");
  const model =
    localStorage.getItem("repoReview_ai_model") || "gemini-1.5-flash";
  const schoolYear =
    document.getElementById("lpSchoolYear").value || "2026-2027";
  const subject =
    localStorage.getItem("lessonReview_defaultSubject") || "Subject";

  let gradeSpecificRules = "";
  let scheduleRules = "";

  switch (window.currentTargetGrade) {
    case "Grade 11":
      gradeSpecificRules = `
3. SESSIONS: Create exactly 5 sessions named: "Session 1", "Session 2", "Session 3", "Session 4-6", and "Session Flex".
4. SESSION 4-6 RULE (3-Hour Laboratory Period / 150 mins total): 
   - Design these sessions as a hands-on laboratory or performance task based on custom instructions.
   - You MUST format the "learning_activities" with dynamic minute allocations in parentheses for each phase, ensuring the total equals exactly 150 minutes.
   - You must use -ing verbs at the start of each bullet in the "learning_activities" section.`;
      scheduleRules = `
     * RULE A: Map any 3-hour continuous block in the schedule EXCLUSIVELY to "Session 4-6".
     * RULE B: Map the 1-hour blocks sequentially to "Session 1", "Session 2", and "Session 3" for remaining days.`;
      break;

    case "Grade 12":
      gradeSpecificRules = `
3. SESSIONS: Compress topics into exactly 4 sessions named: "Session 1", "Session 2", "Session 3", and "Session Flex".`;
      scheduleRules = `
     * RULE A: Map the schedule blocks sequentially to "Session 1", "Session 2", and "Session 3".`;
      break;

    default:
      gradeSpecificRules = `
3. SESSIONS: Compress topics into exactly 3 sessions named: "Session 1", "Session 2", and "Session Flex".`;
      scheduleRules = `
     * RULE A: Map the schedule blocks sequentially to "Session 1" and "Session 2".`;
      break;
  }

  let lookbackContext = "";
  if (window.cachedPreviousPlan && window.cachedPreviousPlan.sessions) {
    const safeTextState = window.cachedPreviousPlan.sessions
      .map(
        (s) =>
          `[Session: ${s.session_name}]\nRemarks: ${s.remarks || "None"}\nOriginal Planned Activities: ${s.learning_activities || "None"}`,
      )
      .join("\n\n");

    lookbackContext = `
7. CATCH-UP & CURRICULUM SHIFT RULE (CRITICAL CONTINUITY):
   - Review "Last Week's Curriculum State" below. This specifically belongs to ${window.currentTargetGrade} - ${subject}.
   - If any session's 'Remarks' indicate it was suspended, interrupted, or handled passively by a substitute, the students did NOT learn that material.
   - You MUST extract the specific topics and 'Original Planned Activities' from those missed sessions and literally regenerate them as the primary "learning_activities" for the early sessions of THIS week.
   - DO NOT just write generic phrases like "Catch-up session" or "Review last week". You must output the actual academic content, competencies, and -ing verbs that were bumped.
   - Shift the entire week's schedule forward. Only introduce new topics from the Reference Text after all bumped content is completely covered.
   - 🚀 NEW RULE: If you shift bumped content into a new session, you MUST append a dynamic note to that session's 'remarks' field indicating exactly which session was missed. Example: "Note: Schedule utilized to cover last week's suspended Session 2."

LAST WEEK'S CURRICULUM STATE:
${safeTextState}
        `;
  }

  const prompt = `
You are an expert curriculum developer. Based on the Reference Text, Target Scope, and Custom Instructions, generate a highly structured JSON lesson plan for ${window.currentTargetGrade}.

CRITICAL FORMATTING RULES:
1. "weekly_overview": 
   - "topic": Keep short and punchy.
   - "content_standard", "performance_standard", and "materials": MANDATORY FIELDS. Professionally infer them based on the text if needed.
   - MATERIALS FORMAT: You MUST format the "materials" field as a heavily bulleted list using dashes (-). Do NOT output a single comma-separated paragraph. Ensure each item is on its own line.
   - FALLBACK KNOWLEDGE: If no Reference Text is provided, or if this is a Tech-Voc/TVL subject, you MUST utilize standard DepEd (Department of Education) and TESDA curriculum guides to formulate standards and content accurately.
2. "sessions" array: Generate daily sessions.
${gradeSpecificRules}
5. SESSION DETAILS (Normal): 
   - "competencies": Provide 1 to 2 clear learning competencies.
   - "objectives": Provide strictly 3 to 4 detailed behavioral objectives based on Bloom’s Taxonomy. DO NOT explicitly write the domain names (e.g., never output "(Cognitive)", "(Psychomotor)", or "(Affective)").
   - "preliminary" MUST always start with: "Opening Prayer\nAttendance Checking\nTECHNOTES".
   - 🚀 STUDENT P.O.V. & STRATEGY RULE: "motivation" and "learning_activities" MUST be written strictly from the Student's Point of View AND must explicitly state the specific teaching strategy used. Every bullet MUST begin with an "-ing" verb indicating what the STUDENT is actively doing, followed by the strategy (e.g., "Guessing the computer parts through the use of Picture Analysis").
   - "formation_standard": Extract or formulate a specific character formation goal for THIS specific session (e.g., perseverance for a lab, integrity for an exam) based on the uploaded Reference Text guides.
   - "evaluation": Suggest diverse and appropriate formative or summative assessments based on the topic. Do NOT default to a Quipper quiz.
   - "values_integration": Output ONLY core value keywords, followed by a short phrase. CRITICAL ALIGNMENT: This value MUST explicitly connect this session's "formation_standard" to the actual topic of this specific session.
   
   - TIME FRAME MAPPING (CRITICAL LINE-BY-LINE ALIGNMENT): 
     In the time frame column, do NOT just write a generic label. You must provide a line-by-line minute breakdown that visually matches the vertical layout of the "Learning Experiences" or specific activity lines. Format it with precise vertical spacing or line breaks so each minute allocation sits horizontally level with its corresponding activity part.

   - SCHEDULE MAPPING (CRITICAL MULTI-SECTION SCAN): Map the provided Teacher Schedule slots into the "remarks" field based on period length, NOT chronological days:
${scheduleRules}
     * RULE C: You MUST scan the ENTIRE provided Teacher Schedule. Identify EVERY section taking EXACTLY the subject "${subject}". The provided schedule does NOT explicitly state grade levels, so do NOT attempt to filter or guess based on "${window.currentTargetGrade}". Match strictly by the subject name. Do NOT stop at the first match. If no matching schedule is found, output "Schedule not found".
     * RULE D: List the schedule for ALL matching sections for this specific session number. If there are multiple sections, separate them with a semicolon (;).
     * RULE E: Format the schedule strictly using pipes (|) for line breaks. Example: [Section A] | [Full Date] | [Time Slot]
     * RULE F: After listing all sections, append any class suspensions, interruptions, or custom instructions requested by the user.

6. SESSION FLEX RULE: 
   - OFFLINE/ASYNCHRONOUS. Provide ONLY bulleted "learning_activities". Set all other fields to empty strings "".

8. STRICT JSON ESCAPING (CRITICAL): 
   - Your output MUST be completely valid JSON. 
   - Do NOT use raw line breaks inside string values. You MUST use the exact escaped characters "\\n" to denote a new line.
   - Properly escape all internal double quotes as \\".
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
                    materials: { type: "STRING" },
                  },
                  required: [
                    "topic",
                    "content_standard",
                    "performance_standard",
                    "materials",
                  ],
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
                      formation_standard: { type: "STRING" },
                      evaluation: { type: "STRING" },
                      closing: { type: "STRING" },
                      values_integration: { type: "STRING" },
                      remarks: { type: "STRING" },
                    },
                    required: ["session_name", "learning_activities"],
                  },
                },
              },
              required: ["weekly_overview", "sessions"],
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`API Error (${response.status}): ${errBody}`);
    }

    const aiResult = await response.json();
    let rawJson = aiResult.candidates[0].content.parts[0].text;
    rawJson = rawJson
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    rawJson = rawJson.replace(/[\u0000-\u0009\u000B-\u001F]+/g, "");

    const planData = JSON.parse(rawJson);

    const defaultPrelim =
      localStorage.getItem("lessonReview_defaultPrelim") ||
      "Opening Prayer\nAttendance Checking\nTECHNOTES";
    const defaultClosing =
      localStorage.getItem("lessonReview_defaultClosing") ||
      "Summary of the Lesson\nClosing Prayer";

    window.currentPlan = planData.sessions.map((session) => {
      if (!session.session_name.toLowerCase().includes("flex")) {
        session.preliminary = defaultPrelim;
        session.closing = defaultClosing;
      }
      return session;
    });

    window.currentWeeklyOverview = planData.weekly_overview;

    window.renderOverview();
    window.renderOutput();
  } catch (e) {
    alert("Generation failed: " + e.message);
  } finally {
    window.hideLoader();
  }
};
