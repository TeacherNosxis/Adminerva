import { db } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

window.runRepoFetch = async function () {
  const ghToken = localStorage.getItem("Adminerva_github_token");
  const geminiKey = localStorage.getItem("Adminerva_gemini_token");

  if (!ghToken || !geminiKey)
    return alert(
      "Missing GitHub PAT or Gemini API Key in your global settings.",
    );

  const tbody = document.getElementById("fetchTableBody");
  tbody.innerHTML = "";
  window.showSubtleLoader("Fetching Grade 11/12 Students from Database...");

  try {
    const stuSnap = await getDocs(collection(db, "students"));
    const students = [];
    stuSnap.forEach((d) => students.push({ id: d.id, ...d.data() }));

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-gray-500">No students found in database.</td></tr>`;
      return window.hideSubtleLoader();
    }

    for (let student of students) {
      if (!student.repoUrl) continue;

      // Parse owner and repo cleanly from URL
      let owner, repo;
      try {
        const urlParts = student.repoUrl
          .replace(/\/$/, "")
          .replace(".git", "")
          .split("/");
        repo = urlParts.pop();
        owner = urlParts.pop();
      } catch (err) {
        continue;
      }

      window.showSubtleLoader(`Analyzing repository for ${student.name}...`);

      // 1. Get Default Branch Tree (Objective Phase)
      const repoRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: { Authorization: `Bearer ${ghToken}` },
        },
      );
      if (!repoRes.ok) continue;
      const repoData = await repoRes.json();

      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`,
        {
          headers: { Authorization: `Bearer ${ghToken}` },
        },
      );
      const treeData = await treeRes.json();

      // Look for the Q2 test directory structure
      const targetFile = treeData.tree
        ? treeData.tree.find(
            (f) =>
              f.path.toLowerCase().includes("test/quarter2") &&
              f.path.endsWith(".java"),
          )
        : null;

      let objectiveScore = 0;
      let objectiveFeedback = "Missing test/quarter2 structure.";
      let aiFeedback = "N/A - Objective criteria failed.";

      if (targetFile) {
        objectiveScore = 10;
        objectiveFeedback = "Perfect Structure: " + targetFile.path;

        // 2. Fetch Raw File Content for AI Phase
        const fileRes = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${repoData.default_branch}/${targetFile.path}`,
          {
            headers: { Authorization: `Bearer ${ghToken}` },
          },
        );
        const codeText = await fileRes.text();

        // Objective Regex Rule Check (PETA 3 Ban on Scanner)
        if (codeText.includes("new Scanner(System.in)")) {
          objectiveScore = 0;
          objectiveFeedback = "FAILED: Illegal use of new Scanner(System.in).";
        } else {
          // 3. Subjective AI Phase (Gemini API)
          const prompt = `
            You are a strict Java high school programming teacher grading a student's code. 
            Evaluate if they successfully implemented basic variables, string concatenation, or control loops based on the requirements.
            Code:\n${codeText.substring(0, 5000)}
            
            Return ONLY a valid JSON object: {"score": <number out of 10>, "feedback": "<1 short direct sentence>"}`;

          const aiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" },
              }),
            },
          );

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const cleanJson = aiData.candidates[0].content.parts[0].text
              .replace(/^```json\s*/i, "")
              .replace(/\s*```$/i, "")
              .trim();
            const parsed = JSON.parse(cleanJson);
            aiFeedback = `<strong class="text-purple-600">${parsed.score}/10</strong><br><span class="text-xs text-gray-600">${parsed.feedback}</span>`;
          } else {
            aiFeedback =
              "<span class='text-red-500'>AI API Connection Error</span>";
          }
        }
      }

      // Append row to the UI table
      tbody.insertAdjacentHTML(
        "beforeend",
        `
        <tr class="border-b hover:bg-gray-50">
          <td class="py-3 px-4 text-sm font-bold text-gray-800">${student.name}</td>
          <td class="py-3 px-4 text-xs font-mono text-gray-500">${targetFile ? targetFile.path : "<span class='text-red-400'>Not Found</span>"}</td>
          <td class="py-3 px-4 text-center">
            <span class="font-bold ${objectiveScore === 10 ? "text-green-600" : "text-red-500"}">${objectiveScore}/10</span>
            <div class="text-[10px] text-gray-500 mt-0.5">${objectiveFeedback}</div>
          </td>
          <td class="py-3 px-4 text-sm">${aiFeedback}</td>
        </tr>
      `,
      );
    }
  } catch (e) {
    alert("Execution Error: " + e.message);
  } finally {
    window.hideSubtleLoader();
  }
};
