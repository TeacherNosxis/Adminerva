import { db } from "../core/firebase-core.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Utility: Convert a wildcard path (src/*/Main.java) into a valid Regular Expression
function wildcardToRegex(wildcardPath) {
  if (!wildcardPath) return new RegExp(".*");
  const escaped = wildcardPath.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexStr = "^" + escaped.replace(/\*/g, "[^/]+") + "$";
  return new RegExp(regexStr, "i");
}

window.startAutoCheck = async function (studentId, owner, repo, taskId) {
  console.log(`[Auto-Check] Initiated for ${owner}/${repo} (Task: ${taskId})`);

  const ghToken = localStorage.getItem("Adminerva_github_token");
  const geminiKey = localStorage.getItem("Adminerva_gemini_token");

  if (!ghToken || !geminiKey) {
    alert(
      "Missing API Keys! Please configure GitHub and Gemini tokens in your settings.",
    );
    return;
  }

  // 1. Safely locate the UI element
  const cardId = `task-card-${studentId}-${taskId}`;
  const taskCard = document.getElementById(cardId);

  if (!taskCard) {
    console.error(
      `[Auto-Check] FATAL: Could not find HTML element with ID: ${cardId}`,
    );
    alert("UI Error: Cannot find the task card. Please refresh the page.");
    return;
  }

  const actionArea = taskCard.querySelector(".grade-action-area");
  if (!actionArea) {
    console.error(
      `[Auto-Check] FATAL: Could not find action area inside ${cardId}`,
    );
    return;
  }

  // Set Loading State
  actionArea.innerHTML = `<span class="text-xs font-bold text-blue-500 flex items-center gap-2"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div> Checking...</span>`;

  try {
    // 2. Fetch the Blueprint Rules from Database
    console.log(`[Auto-Check] Fetching blueprint rules for Task: ${taskId}`);
    const taskSnap = await getDoc(doc(db, "assessments", taskId));
    if (!taskSnap.exists())
      throw new Error("Assessment Blueprint missing in database.");
    const taskData = taskSnap.data();

    // 3. Locate the Target File in GitHub
    let targetFilePath = taskData.targetPath || "";
    let fileRawText = "";

    console.log(`[Auto-Check] Fetching repository info from GitHub...`);
    const repoRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: { Authorization: `Bearer ${ghToken}` } },
    );

    if (!repoRes.ok)
      throw new Error(
        "Could not access repository. It may be private or deleted.",
      );
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch;

    if (!defaultBranch)
      throw new Error("Repository appears to be completely empty.");

    if (targetFilePath.includes("*")) {
      console.log(`[Auto-Check] Resolving wildcard path: ${targetFilePath}`);
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
        { headers: { Authorization: `Bearer ${ghToken}` } },
      );

      const treeData = await treeRes.json();
      const matcher = wildcardToRegex(targetFilePath);

      const matchedFile = (treeData.tree || []).find((f) =>
        matcher.test(f.path),
      );
      if (!matchedFile)
        throw new Error(
          `Could not find any file matching path: ${targetFilePath}`,
        );

      targetFilePath = matchedFile.path;
      console.log(
        `[Auto-Check] Wildcard resolved to exact path: ${targetFilePath}`,
      );
    }

    // Fetch the actual raw code
    console.log(`[Auto-Check] Fetching raw code from: ${targetFilePath}`);
    const fileRes = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${targetFilePath}`,
      { headers: { Authorization: `Bearer ${ghToken}` } },
    );

    if (!fileRes.ok)
      throw new Error(
        "File found in repository but its contents could not be read.",
      );
    fileRawText = await fileRes.text();
    fileRawText = fileRawText || ""; // Fallback for empty files

    // 4. Run Objective Filters Locally (Banned / Required)
    console.log(`[Auto-Check] Running local objective filters...`);
    let objectiveViolations = [];
    const rules = taskData.rules || [];

    rules.forEach((rule) => {
      const hasString = fileRawText.includes(rule.value);
      if (rule.type === "Banned" && hasString) {
        objectiveViolations.push(`Used banned string: ${rule.value}`);
      } else if (rule.type === "Required" && !hasString) {
        objectiveViolations.push(`Missing required string: ${rule.value}`);
      }
    });

    // 5. Construct AI Prompt
    let finalScore = 0;
    let finalFeedback = "";

    // Auto-Fail if major objective violations exist
    if (
      objectiveViolations.length > 0 &&
      rules.some((r) => r.type === "Banned" && fileRawText.includes(r.value))
    ) {
      console.log(`[Auto-Check] Objective check failed. Bypassing Gemini API.`);
      finalScore = 0;
      finalFeedback =
        "Objective Check Failed: " + objectiveViolations.join(", ");
    } else {
      console.log(`[Auto-Check] Forwarding code to Grading API...`);
      const prompt = `
            ${taskData.systemPersona || "You are a strict code evaluator."}
            
            Task Context: ${taskData.taskContext || "Evaluate general code quality."}
            Rubric: ${taskData.evalCriteria || "Score based on correctness and structure."}
            
            Objective Checks Log:
            ${objectiveViolations.length > 0 ? "Minor Violations: " + objectiveViolations.join(", ") : "All objective checks passed."}
            
            Student Code (${targetFilePath}):
            \`\`\`
            ${fileRawText.substring(0, 8000)} 
            \`\`\`
            
            Evaluate the code strictly based on the rubric. 
            Return ONLY a valid JSON object matching this exact format:
            {"score": <number 0-100>, "feedback": "<1 to 2 short sentences explaining the score>"}
      `;

      const aiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              response_mime_type: "application/json",
              temperature: 0.2, // Low temp for strict grading
            },
          }),
        },
      );

      if (!aiRes.ok)
        throw new Error("Automated Grading API failed to respond.");
      const aiData = await aiRes.json();

      let cleanJson = aiData.candidates[0].content.parts[0].text;
      cleanJson = cleanJson
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const parsed = JSON.parse(cleanJson);

      finalScore = parsed.score || 0;
      finalFeedback = parsed.feedback || "No feedback generated.";
    }

    if (objectiveViolations.length > 0 && finalScore > 0) {
      finalFeedback =
        `[Notes: ${objectiveViolations.join(", ")}] ` + finalFeedback;
    }

    // 6. Save to Database
    console.log(
      `[Auto-Check] Saving final score (${finalScore}) to database...`,
    );
    const gradeDocId = `${studentId}_${taskId}`;
    await setDoc(
      doc(db, "student_grades", gradeDocId),
      {
        studentId,
        taskId,
        score: finalScore,
        feedback: finalFeedback,
        targetPath: targetFilePath,
        gradedAt: serverTimestamp(),
      },
      { merge: true },
    );

    // 7. Update UI
    renderGradeResult(actionArea, finalScore, finalFeedback);
    console.log(`[Auto-Check] Complete!`);
  } catch (error) {
    console.error("[Auto-Check] Process Failed:", error);

    actionArea.innerHTML = `
        <div class="text-right">
            <span class="text-xs font-bold text-red-500">Check Failed</span>
            <p class="text-[10px] text-gray-500 max-w-[200px] truncate" title="${escapeHTML(error.message)}">${escapeHTML(error.message)}</p>
            <button onclick="window.startAutoCheck('${studentId}', '${owner}', '${repo}', '${taskId}')" class="mt-1 text-[10px] text-blue-500 hover:underline">Retry</button>
        </div>
    `;
  }
};

function renderGradeResult(container, score, feedback) {
  let scoreColor = "text-green-600";
  if (score < 75) scoreColor = "text-red-600";
  if (score >= 75 && score < 90) scoreColor = "text-yellow-600";

  container.innerHTML = `
        <div class="flex items-center justify-end gap-3 bg-gray-50 p-2 rounded border border-gray-200 w-full sm:w-[320px]">
            <div class="text-2xl font-bold ${scoreColor} leading-none ml-2">${score}</div>
            <div class="flex-1 min-w-0 border-l border-gray-200 pl-3 ml-1">
                <p class="text-[10px] text-gray-600 leading-tight line-clamp-2" title="${escapeHTML(feedback)}">${escapeHTML(feedback)}</p>
            </div>
            <button class="text-gray-400 hover:text-blue-500 transition px-1" title="Force Re-evaluate">🔄</button>
        </div>
    `;
}
