import { db } from "../core/firebase-core.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Utility: Convert a wildcard path (src/*/Main.java) into a valid Regular Expression
function wildcardToRegex(wildcardPath) {
  const escaped = wildcardPath.replace(/[.+?^${}()|[\]\\]/g, "\\$&"); // Escape regex chars
  const regexStr = "^" + escaped.replace(/\*/g, "[^/]+") + "$"; // Replace * with "any folder name"
  return new RegExp(regexStr, "i");
}

window.startAutoCheck = async function (studentId, owner, repo, taskId) {
  const ghToken = localStorage.getItem("Adminerva_github_token");
  const geminiKey = localStorage.getItem("Adminerva_gemini_token");

  if (!ghToken || !geminiKey) {
    alert("Missing API Keys (GitHub or Gemini) in global settings.");
    return;
  }

  // 1. Update UI to show loading state
  const actionArea = document.querySelector(
    `#task-card-${studentId}-${taskId} .grade-action-area`,
  );
  if (!actionArea) return;

  const originalBtn = actionArea.innerHTML;
  actionArea.innerHTML = `<span class="text-xs font-bold text-blue-500 flex items-center gap-2"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div> Checking...</span>`;

  try {
    // 2. Fetch the Blueprint Rules from Database
    const taskSnap = await getDoc(doc(db, "assessments", taskId));
    if (!taskSnap.exists()) throw new Error("Assessment Blueprint missing.");
    const taskData = taskSnap.data();

    // 3. Locate the Target File in GitHub (Handling Wildcards)
    let targetFilePath = taskData.targetPath || "";
    let fileRawText = "";

    // Get Default Branch
    const repoRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: { Authorization: `Bearer ${ghToken}` },
      },
    );
    if (!repoRes.ok) throw new Error("Could not access repository.");
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch;

    if (targetFilePath.includes("*")) {
      // Complex Search: Fetch full tree to resolve wildcard
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
        {
          headers: { Authorization: `Bearer ${ghToken}` },
        },
      );
      const treeData = await treeRes.json();
      const matcher = wildcardToRegex(targetFilePath);

      const matchedFile = treeData.tree
        ? treeData.tree.find((f) => matcher.test(f.path))
        : null;
      if (!matchedFile) throw new Error("Target file not found in repository.");
      targetFilePath = matchedFile.path;
    }

    // Fetch the raw code
    const fileRes = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${targetFilePath}`,
      {
        headers: { Authorization: `Bearer ${ghToken}` },
      },
    );
    if (!fileRes.ok) throw new Error("File found but could not read contents.");
    fileRawText = await fileRes.text();

    // 4. Run Objective Filters Locally (Banned / Required)
    let objectiveViolations = [];
    let objectivePassed = [];
    const rules = taskData.rules || [];

    rules.forEach((rule) => {
      const hasString = fileRawText.includes(rule.value);
      if (rule.type === "Banned" && hasString) {
        objectiveViolations.push(`Used banned string: ${rule.value}`);
      } else if (rule.type === "Required" && !hasString) {
        objectiveViolations.push(`Missing required string: ${rule.value}`);
      } else {
        objectivePassed.push(`${rule.type} check passed: ${rule.value}`);
      }
    });

    // 5. Construct AI Prompt
    let finalScore = 0;
    let finalFeedback = "";

    // Auto-Fail if major objective violations exist (Optional, but strict)
    if (
      objectiveViolations.length > 0 &&
      rules.some((r) => r.type === "Banned" && fileRawText.includes(r.value))
    ) {
      finalScore = 0;
      finalFeedback =
        "Objective Check Failed: " + objectiveViolations.join(", ");
    } else {
      // Proceed to Gemini for Subjective Checking
      const prompt = `
            ${taskData.systemPersona}
            
            Task Context: ${taskData.taskContext}
            Rubric: ${taskData.evalCriteria}
            
            Objective Checks Log:
            ${objectiveViolations.length > 0 ? "Violations: " + objectiveViolations.join(", ") : "All objective checks passed."}
            
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
              temperature: 0.2,
            }, // Low temp for strict grading
          }),
        },
      );

      if (!aiRes.ok) throw new Error("Automated Checking API failed.");
      const aiData = await aiRes.json();

      // Clean markdown artifacts from JSON
      let cleanJson = aiData.candidates[0].content.parts[0].text;
      cleanJson = cleanJson
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const parsed = JSON.parse(cleanJson);

      finalScore = parsed.score;
      finalFeedback = parsed.feedback;
    }

    // Append objective violations to feedback if any exist
    if (objectiveViolations.length > 0 && finalScore > 0) {
      finalFeedback =
        `[Notes: ${objectiveViolations.join(", ")}] ` + finalFeedback;
    }

    // 6. Save to Database
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

    // 7. Update UI with Success
    renderGradeResult(actionArea, finalScore, finalFeedback);
  } catch (error) {
    console.error("Auto-Check Error:", error);

    // Show failure in UI
    actionArea.innerHTML = `
            <div class="text-right">
                <span class="text-xs font-bold text-red-500">Check Failed</span>
                <p class="text-[10px] text-gray-500 max-w-[200px] truncate" title="${error.message}">${error.message}</p>
                <button onclick="window.startAutoCheck('${studentId}', '${owner}', '${repo}', '${taskId}')" class="mt-1 text-[10px] text-blue-500 hover:underline">Retry</button>
            </div>
        `;
  }
};

// Utility to swap the button with the final grade UI
function renderGradeResult(container, score, feedback) {
  let scoreColor = "text-green-600";
  if (score < 75) scoreColor = "text-red-600";
  if (score >= 75 && score < 90) scoreColor = "text-yellow-600";

  container.innerHTML = `
        <div class="flex items-center gap-3 bg-gray-50 p-2 rounded border border-gray-200 w-[280px]">
            <div class="text-2xl font-bold ${scoreColor} leading-none">${score}</div>
            <div class="flex-1 min-w-0">
                <p class="text-[10px] text-gray-600 leading-tight line-clamp-2" title="${escapeHTML(feedback)}">${escapeHTML(feedback)}</p>
            </div>
            <button class="text-gray-400 hover:text-blue-500 transition" title="Re-evaluate">🔄</button>
        </div>
    `;
}
