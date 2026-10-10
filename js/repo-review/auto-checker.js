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
  )
    return new RegExp(".*");
  let path = wildcardPath.trim();
  if (!path.match(/\.[a-zA-Z0-9]+$/)) path = path.replace(/\/$/, "") + "/*";
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

  const actionArea = taskCard
    ? taskCard.querySelector(".grade-action-area")
    : null;

  const updateStatus = (message) => {
    if (actionArea)
      actionArea.innerHTML = `<span class="text-xs font-bold text-blue-500 flex items-center gap-2"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div> ${message}</span>`;
  };

  try {
    updateStatus("Fetching Context...");
    const taskSnap = await getDoc(doc(db, "assessments", taskId));
    const studentSnap = await getDoc(doc(db, "students", studentId));

    if (!taskSnap.exists()) throw new Error("Blueprint missing in database.");
    const taskData = taskSnap.data();
    const studentData = studentSnap.exists()
      ? studentSnap.data()
      : { name: "Unknown Student", githubUsername: "Unknown" };

    updateStatus("Scanning Repo...");
    let targetFilePath = taskData.targetPath || "";
    let fileRawText = "";
    let displayPathText = targetFilePath || "Entire Repository";

    // NEW: Triage & Fallback Tracking
    let autoPenalties = [];
    let forceFail = false;
    let failMessage = "";

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
      // WILDCARD / FOLDER SEARCH LOGIC
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${currentSha}?recursive=1`,
        { headers: { Authorization: `Bearer ${ghToken}` } },
      );
      const treeData = await treeRes.json();
      const matcher = wildcardToRegex(targetFilePath);
      const allowedExts =
        /\.(java|xml|kt|dart|cs|js|ts|html|css|txt|json|sql|gradle|properties|md|py|php|cpp)$/i;
      const matchedFiles = (treeData.tree || []).filter(
        (f) =>
          f.type === "blob" && matcher.test(f.path) && allowedExts.test(f.path),
      );

      if (matchedFiles.length === 0) {
        forceFail = true;
        failMessage = `No code files found in path: ${targetFilePath || "repository"}. Please ensure you committed your work.`;
        autoPenalties.push("Empty Submission");
      } else {
        const filesToProcess = matchedFiles.slice(0, 40);
        updateStatus(`Reading ${filesToProcess.length} File(s)...`);

        let combinedCode = "";
        let pathsFound = [];

        const filePromises = filesToProcess.map(async (file) => {
          const fileRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${currentSha}`,
            {
              headers: {
                Authorization: `Bearer ${ghToken}`,
                Accept: "application/vnd.github.v3.raw",
              },
            },
          );
          if (fileRes.ok)
            return { path: file.path, text: await fileRes.text() };
          return null;
        });

        const fetchedFiles = await Promise.all(filePromises);
        fetchedFiles.forEach((fileObj) => {
          if (fileObj && fileObj.text.trim()) {
            combinedCode += `\n\n--- FILE: ${fileObj.path} ---\n${fileObj.text}`;
            pathsFound.push(fileObj.path.split("/").pop());
          }
        });

        if (!combinedCode.trim()) {
          forceFail = true;
          failMessage = "Files found, but contents were empty or unreadable.";
          autoPenalties.push("Empty Submission");
        } else {
          fileRawText = combinedCode;
          if (pathsFound.length > 1)
            displayPathText = `${pathsFound[0]} (+${pathsFound.length - 1} files)`;
          else if (pathsFound.length === 1) displayPathText = pathsFound[0];
        }
      }
    } else {
      // EXACT TARGET PATH LOGIC (With Tier-2 Fallback)
      updateStatus("Reading Code...");
      const fileRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${targetFilePath}?ref=${currentSha}`,
        {
          headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: "application/vnd.github.v3.raw",
          },
        },
      );

      if (fileRes.ok) {
        fileRawText = `\n\n--- FILE: ${targetFilePath} ---\n${(await fileRes.text()) || ""}`;
        displayPathText = targetFilePath.split("/").pop();
      } else {
        // FALLBACK INITIATED: File not found at exact path
        updateStatus("File missing! Scanning repository...");

        const treeRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${currentSha}?recursive=1`,
          { headers: { Authorization: `Bearer ${ghToken}` } },
        );
        const treeData = await treeRes.json();

        const expectedFileName = targetFilePath.split("/").pop();
        const expectedBaseName = expectedFileName.replace(
          /\.[a-zA-Z0-9]+$/,
          "",
        );
        const expectedDir = targetFilePath
          .replace(expectedFileName, "")
          .replace(/\/$/, "");

        let bestMatch = null;
        for (let f of treeData.tree || []) {
          if (f.type !== "blob") continue;

          const fName = f.path.split("/").pop();
          const fBase = fName.replace(/\.[a-zA-Z0-9]+$/, "");
          const fDir = f.path.replace(fName, "").replace(/\/$/, "");

          // 1. Exact name, wrong folder
          if (fName === expectedFileName) {
            bestMatch = f;
            autoPenalties.push("Wrong Folder");
            break;
          }
          // 2. Missing extension (basename matches)
          if (fBase === expectedBaseName) {
            bestMatch = f;
            if (fDir === expectedDir) {
              autoPenalties.push("Missing Extension");
            } else {
              autoPenalties.push("Wrong Folder");
              autoPenalties.push("Missing Extension");
            }
            break;
          }
        }

        if (bestMatch) {
          const fallbackRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${bestMatch.path}?ref=${currentSha}`,
            {
              headers: {
                Authorization: `Bearer ${ghToken}`,
                Accept: "application/vnd.github.v3.raw",
              },
            },
          );
          fileRawText = `\n\n--- FILE: ${bestMatch.path} ---\n${(await fallbackRes.text()) || ""}`;
          displayPathText = bestMatch.path;
        } else {
          forceFail = true;
          failMessage =
            "No matching source code was found. Please ensure you committed your file with the correct name.";
          autoPenalties.push("Empty Submission");
        }
      }
    }

    let finalScore = 4;
    let finalFeedback = failMessage;
    let finalTags = autoPenalties;

    // TIER 3: LLM EVALUATION (If code was successfully located)
    if (!forceFail) {
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
            The codebase below contains files from multiple group members. You MUST identify which files or code blocks belong to this specific student. DO NOT deduct points for errors found in files clearly belonging to other students.

            MANDATORY PENALTY & TIERED DIAGNOSTIC RUBRIC:
            You are an automated grading script. Evaluate the code, calculate the score out of 20, and then apply deductions and tags based on these strict thresholds:
            ${autoPenalties.length > 0 ? `* Administrative Penalties: The system detected these errors: [${autoPenalties.join(", ")}]. Deduct 3 points for each.` : ""}
            
            * TIER 1 (Score 15-20 / Above 75%): Code is mostly functional. Penalty tags are optional for minor syntax issues.
            * TIER 2 (Score 10-14 / 50%-75%): The code has structural/logic issues. You MUST append specific diagnostic tags (e.g., "Syntax Error", "Missing Logic", "Incomplete Feature"). Combine feedback to explain what to fix.
            * TIER 3 (Score 4-9 / Below 50%): Critical failure. You MUST deeply analyze WHY it failed and apply severe tags:
                - If they submitted Android UI code instead of Console code (or vice-versa), assign "Paradigm Mismatch".
                - If the file is mostly empty or just an auto-generated scaffold, assign "Empty Submission" (Score = 4).
                - If logic is hardcoded to bypass requirements, assign "Logic Bypass" (Score = 4).
                Combine all feedback into a clear explanation of their fatal error.

            CRITICAL JSON OUTPUT FORMAT:
            You MUST return your evaluation strictly as a JSON object with NO markdown formatting. Format EXACTLY like this:
            {"score": <number>, "penalty_tags": ["<tag1>", "<tag2>"], "teacher_note": "<2 to 4 sentences addressed directly to the student explaining the score and penalties>"}
            
            ${rulesText}
            
            Student Code Collection:
            \`\`\`
            ${fileRawText.substring(0, 80000)} 
            \`\`\`
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

      if (!aiRes.ok)
        throw new Error(
          "Automated engine failed to respond. (Check console for API details)",
        );
      const aiData = await aiRes.json();

      let cleanJson = aiData.candidates[0].content.parts[0].text;
      cleanJson = cleanJson
        .replace(/^```(json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const parsed = JSON.parse(cleanJson);

      finalScore = parsed.score || 4;
      finalFeedback =
        parsed.teacher_note || parsed.feedback || "No feedback generated.";

      let aiTags = [];
      if (Array.isArray(parsed.penalty_tags)) aiTags = parsed.penalty_tags;
      else if (typeof parsed.penalty_tags === "string")
        aiTags = [parsed.penalty_tags];

      finalTags = [...new Set([...autoPenalties, ...aiTags])]; // Merge and deduplicate tags
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
        penaltyTags: finalTags,
        targetPath: displayPathText,
        gradedSha: currentSha,
        gradedAt: serverTimestamp(),
      },
      { merge: true },
    );

    if (actionArea) {
      renderGradeResult(
        actionArea,
        finalScore,
        finalFeedback,
        finalTags,
        displayPathText,
        studentId,
        owner,
        repo,
        taskId,
        currentSha,
      );
    }

    return { success: true };
  } catch (error) {
    console.error("[Auto-Check] Failed:", error);
    if (actionArea) {
      actionArea.innerHTML = `
          <div class="text-right flex flex-col items-end">
              <span class="text-xs font-bold text-red-500">Check Failed</span>
              <p class="text-[9px] text-gray-500 max-w-[200px] truncate" title="${escapeHTML(error.message)}">${escapeHTML(error.message)}</p>
              <button onclick="window.startAutoCheck('${studentId}', '${owner}', '${repo}', '${taskId}', '${currentSha}')" class="mt-0.5 text-[10px] font-bold text-blue-500 hover:underline">Retry Check</button>
          </div>
      `;
    }

    return { success: false, reason: error.message };
  }
};

function renderGradeResult(
  container,
  score,
  feedback,
  penaltyTags,
  exactPath,
  studentId,
  owner,
  repo,
  taskId,
  currentSha,
) {
  let scoreColor = "text-green-600";
  if (score < 15) scoreColor = "text-red-600";
  if (score >= 15 && score < 18) scoreColor = "text-yellow-600";

  let tagsHtml = "";
  if (penaltyTags && penaltyTags.length > 0) {
    tagsHtml = `<div class="flex flex-wrap gap-1 mb-1 mt-1">
          ${penaltyTags.map((t) => `<span class="bg-rose-50 text-rose-600 text-[8.5px] px-1.5 py-0.5 rounded border border-rose-200 font-extrabold uppercase tracking-wider shadow-sm">${escapeHTML(t)}</span>`).join("")}
      </div>`;
  }

  container.innerHTML = `
        <div class="flex items-center justify-end gap-3 bg-gray-50 p-2 rounded border border-gray-200 w-full sm:w-[360px] shadow-inner">
            <div class="text-2xl font-bold ${scoreColor} leading-none ml-2 w-10 text-center">${score}</div>
            <div class="flex-1 min-w-0 border-l border-gray-200 pl-3 ml-1">
                <p class="text-[9px] font-mono text-gray-400 truncate mb-1" title="${escapeHTML(exactPath)}">File(s): ${escapeHTML(exactPath)}</p>
                ${tagsHtml}
                <div class="text-[10px] text-gray-700 leading-relaxed max-h-24 overflow-y-auto pr-1 whitespace-pre-wrap">${escapeHTML(feedback)}</div>
            </div>
            <div class="flex flex-col items-center justify-center border-l border-gray-200 pl-2 shrink-0 w-12">
                <span id="pub-lbl-${taskId}" class="text-[7px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Hidden</span>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" class="sr-only peer" onchange="window.togglePublishGrade('${studentId}', '${taskId}', this)">
                  <div class="w-6 h-3.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
            </div>
            <button onclick="window.startAutoCheck('${studentId}', '${owner}', '${repo}', '${taskId}', '${currentSha}')" class="text-gray-400 hover:text-blue-500 transition px-1 shrink-0 border-l border-gray-200 pl-2 ml-1" title="Force Re-evaluate">🔄</button>
        </div>
    `;
}
