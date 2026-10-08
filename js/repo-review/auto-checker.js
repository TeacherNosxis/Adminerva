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

  if (!path.match(/\.[a-zA-Z0-9]+$/)) {
    path = path.replace(/\/$/, "") + "/*";
  }

  let escaped = path.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexStr = escaped.replace(/\\\*/g, ".*");
  return new RegExp(regexStr, "i");
}

window.startAutoCheck = async function (
  studentId,
  owner,
  repo,
  taskId,
  currentSha,
) {
  const ghToken = localStorage.getItem("Adminerva_github_token");
  const geminiKey = localStorage.getItem("Adminerva_gemini_token");
  const aiModel =
    localStorage.getItem("Adminerva_ai_model") || "gemini-1.5-flash-latest";

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
    updateStatus("Fetching Context...");

    // 1. Fetch BOTH the Task Rules and the specific Student's Info
    const taskSnap = await getDoc(doc(db, "assessments", taskId));
    const studentSnap = await getDoc(doc(db, "students", studentId));

    if (!taskSnap.exists()) throw new Error("Blueprint missing in database.");
    const taskData = taskSnap.data();

    // If the student doc doesn't exist for some reason, fallback to generic so it doesn't crash
    const studentData = studentSnap.exists()
      ? studentSnap.data()
      : { name: "Unknown Student", githubUsername: "Unknown" };

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
          `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${defaultBranch}`,
          {
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: "application/vnd.github.v3.raw",
            },
          },
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
        `https://api.github.com/repos/${owner}/${repo}/contents/${targetFilePath}?ref=${defaultBranch}`,
        {
          headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: "application/vnd.github.v3.raw",
          },
        },
      );
      if (!fileRes.ok) throw new Error("Could not read file contents.");
      const text = await fileRes.text();
      fileRawText = `\n\n--- FILE: ${targetFilePath} ---\n${text || ""}`;
      displayPathText = targetFilePath.split("/").pop();
    }

    // Pass the objective rules to the AI instead of hard-failing locally
    updateStatus("Evaluating Code...");
    let rulesText = "No strict objective string rules applied.";
    if (taskData.rules && taskData.rules.length > 0) {
      rulesText =
        "Objective String Filters (Deduct points if the Target Student violates these):\n";
      taskData.rules.forEach((r) => {
        rulesText += `- ${r.type}: "${r.value}"\n`;
      });
    }

    const prompt = `
          ${taskData.systemPersona || "You are a strict code evaluator."}
          
          Task Context: ${taskData.taskContext || "Evaluate general code quality."}
          Rubric: ${taskData.evalCriteria || "Score based on correctness and structure."}
          
          CRITICAL INSTRUCTION - TARGET STUDENT ISOLATION:
          You are grading ONLY the individual work of student: ${studentData.name} (GitHub username: @${studentData.githubUsername || "unlinked"}).
          The codebase below contains files from multiple group members. You MUST identify which files or code blocks belong to this specific student by checking file names (e.g. files named after them) or internal code comments. 
          DO NOT deduct points from ${studentData.name} for errors, bad logic, or missing requirements found in files clearly belonging to other students. Base your score and feedback strictly on ${studentData.name}'s specific contributions. If you cannot definitively tell which file is theirs, evaluate the general structure but assume they contributed positively.

          ${rulesText}
          
          Student Code Collection:
          \`\`\`
          ${fileRawText.substring(0, 80000)} 
          \`\`\`
          
          Evaluate the TARGET STUDENT'S code strictly based on the rubric provided. Calculate the total score carefully by adding up the points earned for each rubric criteria.
          Return ONLY a valid JSON object matching this exact format:
          {"score": <number representing the final calculated total score>, "feedback": "<2 to 4 sentences explaining the score breakdown and specific feedback for this student>"}
    `;

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${geminiKey}`,
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

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[Auto-Check] Gemini API Error Details:", errText);
      throw new Error(
        "Automated engine failed to respond. (Check console for API details)",
      );
    }
    const aiData = await aiRes.json();

    let cleanJson = aiData.candidates[0].content.parts[0].text;
    cleanJson = cleanJson
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleanJson);

    let finalScore = parsed.score || 0;
    let finalFeedback = parsed.feedback || "No feedback generated.";

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
        gradedSha: currentSha,
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
  if (score < 15) scoreColor = "text-red-600"; // Adjusted for typical 20pt rubrics
  if (score >= 15 && score < 18) scoreColor = "text-yellow-600";

  container.innerHTML = `
        <div class="flex items-center justify-end gap-3 bg-gray-50 p-2 rounded border border-gray-200 w-full sm:w-[320px] shadow-inner">
            <div class="text-2xl font-bold ${scoreColor} leading-none ml-2 w-10 text-center">${score}</div>
            <div class="flex-1 min-w-0 border-l border-gray-200 pl-3 ml-1">
                <p class="text-[9px] font-mono text-gray-400 truncate mb-1" title="${escapeHTML(exactPath)}">File(s): ${escapeHTML(exactPath)}</p>
                <div class="text-[10px] text-gray-700 leading-relaxed max-h-24 overflow-y-auto pr-1 whitespace-pre-wrap">${escapeHTML(feedback)}</div>
            </div>
            <button onclick="window.startAutoCheck('${studentId}', '${owner}', '${repo}', '${taskId}', '${currentSha}')" class="text-gray-400 hover:text-blue-500 transition px-1 shrink-0" title="Force Re-evaluate">🔄</button>
        </div>
    `;
}
