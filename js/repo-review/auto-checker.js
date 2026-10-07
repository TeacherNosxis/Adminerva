import { db } from "../core/firebase-core.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(
    /[&<>"']/g,
    (match) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[match],
  );
}

function wildcardToRegex(wildcardPath) {
  if (
    !wildcardPath ||
    wildcardPath.trim() === "" ||
    wildcardPath.trim() === "*"
  ) {
    return new RegExp(".*");
  }
  let path = wildcardPath.trim();

  // If the path doesn't point to a specific file, assume we want files INSIDE it
  if (!path.match(/\.[a-zA-Z0-9]+$/)) {
    path = path.replace(/\/$/, "") + "/*";
  }

  let escaped = path.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

  // UNANCHORED REGEX: Notice there is no "^" and no "$" here!
  // This allows it to ignore the "app/" wrapper folder completely.
  const regexStr = escaped.replace(/\\\*/g, ".*");
  return new RegExp(regexStr, "i");
}

// NOTE: Added 'currentSha' to the parameters
window.startAutoCheck = async function (
  studentId,
  owner,
  repo,
  taskId,
  currentSha,
) {
  const ghToken = localStorage.getItem("Adminerva_github_token");
  const geminiKey = localStorage.getItem("Adminerva_gemini_token");

  if (!ghToken || !geminiKey) {
    alert(
      "Missing API Keys! Please configure GitHub and Gemini tokens in your settings.",
    );
    return;
  }

  const cardId = `task-card-${studentId}-${taskId}`;
  const taskCard = document.getElementById(cardId);
  if (!taskCard) return;

  const actionArea = taskCard.querySelector(".grade-action-area");
  if (!actionArea) return;

  const updateStatus = (message) => {
    actionArea.innerHTML = `<span class="text-xs font-bold text-blue-500 flex items-center gap-2"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div> ${message}</span>`;
  };

  try {
    updateStatus("Fetching Rules...");
    const taskSnap = await getDoc(doc(db, "assessments", taskId));
    if (!taskSnap.exists()) throw new Error("Blueprint missing in database.");
    const taskData = taskSnap.data();

    updateStatus("Scanning Repo...");
    let targetFilePath = taskData.targetPath || "";
    let fileRawText = "";
    let displayPathText = targetFilePath || "Entire Repository";

    const repoRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: { Authorization: `Bearer ${ghToken}` } },
    );
    if (!repoRes.ok) throw new Error("Repo inaccessible. Might be private.");
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch;
    if (!defaultBranch) throw new Error("Repository is empty.");

    if (
      targetFilePath === "" ||
      targetFilePath.includes("*") ||
      !targetFilePath.match(/\.[a-zA-Z0-9]+$/)
    ) {
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
        { headers: { Authorization: `Bearer ${ghToken}` } },
      );
      const treeData = await treeRes.json();
      const matcher = wildcardToRegex(targetFilePath);
      const allowedExts =
        /\.(java|xml|kt|dart|cs|js|ts|html|css|txt|json|sql|gradle|properties)$/i;
      const matchedFiles = (treeData.tree || []).filter(
        (f) =>
          f.type === "blob" && matcher.test(f.path) && allowedExts.test(f.path),
      );

      if (matchedFiles.length === 0)
        throw new Error(
          `No code files found in path: ${targetFilePath || "repository"}`,
        );

      const filesToProcess = matchedFiles.slice(0, 40);
      updateStatus(`Reading ${filesToProcess.length} File(s)...`);

      let combinedCode = "";
      let pathsFound = [];

      const filePromises = filesToProcess.map(async (file) => {
        const fileRes = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${file.path}`,
          { headers: { Authorization: `Bearer ${ghToken}` } },
        );
        if (fileRes.ok) {
          const text = await fileRes.text();
          return { path: file.path, text: text };
        }
        return null;
      });

      const fetchedFiles = await Promise.all(filePromises);
      fetchedFiles.forEach((fileObj) => {
        if (fileObj && fileObj.text.trim()) {
          combinedCode += `\n\n--- FILE: ${fileObj.path} ---\n${fileObj.text}`;
          pathsFound.push(fileObj.path.split("/").pop());
        }
      });

      if (!combinedCode.trim())
        throw new Error("Files found, but contents were empty or unreadable.");
      fileRawText = combinedCode;

      if (pathsFound.length > 1) {
        displayPathText = `${pathsFound[0]} (+${pathsFound.length - 1} files)`;
      } else if (pathsFound.length === 1) {
        displayPathText = pathsFound[0];
      }
    } else {
      updateStatus("Reading Code...");
      const fileRes = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${targetFilePath}`,
        { headers: { Authorization: `Bearer ${ghToken}` } },
      );
      if (!fileRes.ok) throw new Error("Could not read file contents.");
      const text = await fileRes.text();
      fileRawText = `\n\n--- FILE: ${targetFilePath} ---\n${text || ""}`;
      displayPathText = targetFilePath.split("/").pop();
    }

    updateStatus("Applying Filters...");
    let objectiveViolations = [];
    const rules = taskData.rules || [];
    rules.forEach((rule) => {
      const hasString = fileRawText.includes(rule.value);
      if (rule.type === "Banned" && hasString) {
        objectiveViolations.push(`Used banned code: ${rule.value}`);
      } else if (rule.type === "Required" && !hasString) {
        objectiveViolations.push(`Missing required code: ${rule.value}`);
      }
    });

    let finalScore = 0;
    let finalFeedback = "";

    if (
      objectiveViolations.length > 0 &&
      rules.some((r) => r.type === "Banned" && fileRawText.includes(r.value))
    ) {
      finalScore = 0;
      finalFeedback =
        "Objective Check Failed: " + objectiveViolations.join(", ");
    } else {
      updateStatus("Evaluating...");
      const prompt = `
            ${taskData.systemPersona || "You are a strict code evaluator."}
            
            Task Context: ${taskData.taskContext || "Evaluate general code quality."}
            Rubric: ${taskData.evalCriteria || "Score based on correctness and structure."}
            
            Objective Checks Log:
            ${objectiveViolations.length > 0 ? "Minor Violations: " + objectiveViolations.join(", ") : "All objective checks passed."}
            
            Student Code Collection:
            \`\`\`
            ${fileRawText.substring(0, 80000)} 
            \`\`\`
            
            Evaluate the provided code strictly based on the rubric. 
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
            },
          }),
        },
      );

      if (!aiRes.ok) throw new Error("Automated engine failed to respond.");
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

    updateStatus("Saving Grade...");
    const gradeDocId = `${studentId}_${taskId}`;
    await setDoc(
      doc(db, "student_grades", gradeDocId),
      {
        studentId,
        taskId,
        score: finalScore,
        feedback: finalFeedback,
        targetPath: displayPathText,
        gradedSha: currentSha, // NOTE: Saves the exact commit it checked!
        gradedAt: serverTimestamp(),
      },
      { merge: true },
    );

    renderGradeResult(
      actionArea,
      finalScore,
      finalFeedback,
      displayPathText,
      studentId,
      owner,
      repo,
      taskId,
      currentSha,
    );
  } catch (error) {
    console.error("[Auto-Check] Failed:", error);
    actionArea.innerHTML = `
        <div class="text-right flex flex-col items-end">
            <span class="text-xs font-bold text-red-500">Check Failed</span>
            <p class="text-[9px] text-gray-500 max-w-[200px] truncate" title="${escapeHTML(error.message)}">${escapeHTML(error.message)}</p>
            <button onclick="window.startAutoCheck('${studentId}', '${owner}', '${repo}', '${taskId}', '${currentSha}')" class="mt-0.5 text-[10px] font-bold text-blue-500 hover:underline">Retry Check</button>
        </div>
    `;
  }
};

function renderGradeResult(
  container,
  score,
  feedback,
  exactPath,
  studentId,
  owner,
  repo,
  taskId,
  currentSha,
) {
  let scoreColor = "text-green-600";
  if (score < 75) scoreColor = "text-red-600";
  if (score >= 75 && score < 90) scoreColor = "text-yellow-600";

  container.innerHTML = `
        <div class="flex items-center justify-end gap-3 bg-gray-50 p-2 rounded border border-gray-200 w-full sm:w-[320px] shadow-inner">
            <div class="text-2xl font-bold ${scoreColor} leading-none ml-2 w-10 text-center">${score}</div>
            <div class="flex-1 min-w-0 border-l border-gray-200 pl-3 ml-1">
                <p class="text-[9px] font-mono text-gray-400 truncate mb-0.5" title="${escapeHTML(exactPath)}">File(s): ${escapeHTML(exactPath)}</p>
                <p class="text-[10px] text-gray-700 leading-tight line-clamp-2" title="${escapeHTML(feedback)}">${escapeHTML(feedback)}</p>
            </div>
            <button onclick="window.startAutoCheck('${studentId}', '${owner}', '${repo}', '${taskId}', '${currentSha}')" class="text-gray-400 hover:text-blue-500 transition px-1" title="Force Re-evaluate">🔄</button>
        </div>
    `;
}
