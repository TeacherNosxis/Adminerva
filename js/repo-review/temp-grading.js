import { db } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  query,
  where,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let currentStudents = [];
let commitDataMap = {};
let firestoreGradesMap = {};
let activeStartDateStr = "";
let activeEndDateStr = "";

window.showLoader = function (msg, subMsg = "") {
  if (typeof window.showSubtleLoader === "function") {
    window.showSubtleLoader(subMsg ? `${msg} -${subMsg}` : msg);
  }
};
window.hideLoader = function () {
  if (typeof window.hideSubtleLoader === "function") window.hideSubtleLoader();
};

function getQuarter(monthStr) {
  const m = parseInt(monthStr);
  if (m >= 7 && m <= 9) return "Q1";
  if ((m >= 10 && m <= 11) || m === 0) return "Q2";
  if (m >= 1 && m <= 3) return "Q3";
  return "Q4";
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!db) {
    document.getElementById("gradingTableBody").innerHTML =
      `<tr><td colspan="5" class="py-8 text-center text-red-500 font-bold">Firebase not configured.</td></tr>`;
    return;
  }
  loadSections();
  initDateSelects();
});

function initDateSelects() {
  const currentYear = new Date().getFullYear();
  const yearSelect = document.getElementById("yearSelect");
  for (let i = currentYear - 2; i <= currentYear + 1; i++) {
    yearSelect.insertAdjacentHTML(
      "beforeend",
      `<option value="${i}" ${i === currentYear ? "selected" : ""}>${i}</option>`,
    );
  }
  const today = new Date();
  document.getElementById("monthSelect").value = today.getMonth();
  const day = today.getDate();
  document.getElementById("weekSelect").value =
    day <= 7 ? "1" : day <= 14 ? "2" : day <= 21 ? "3" : "4";
  updateDateScope();
}

window.updateDateScope = function () {
  const y = parseInt(document.getElementById("yearSelect").value);
  const m = parseInt(document.getElementById("monthSelect").value);
  const w = parseInt(document.getElementById("weekSelect").value);

  let startDay = 1,
    endDay = 7;
  if (w === 2) {
    startDay = 8;
    endDay = 14;
  }
  if (w === 3) {
    startDay = 15;
    endDay = 21;
  }
  if (w === 4) {
    startDay = 22;
    endDay = new Date(y, m + 1, 0).getDate();
  }

  const sDate = new Date(y, m, startDay, 0, 0, 0);
  const eDate = new Date(y, m, endDay, 23, 59, 59);
  activeStartDateStr = sDate.toISOString();
  activeEndDateStr = eDate.toISOString();

  const opts = { month: "short", day: "numeric", year: "numeric" };
  document.getElementById("dateScopeDisplay").textContent =
    `${sDate.toLocaleDateString("en-US", opts)} - ${new Date(y, m, endDay).toLocaleDateString("en-US", opts)}`;
  document.getElementById("gradingTableBody").innerHTML =
    `<tr><td colspan="5" class="py-8 text-center text-gray-400 italic">Date changed. Please fetch commits again.</td></tr>`;
};

async function loadSections() {
  try {
    const snap = await getDocs(collection(db, "students"));
    const select = document.getElementById("sectionSelect");
    select.innerHTML = "";
    let uniqueSections = new Set();
    snap.forEach((d) => {
      if (d.data().section) uniqueSections.add(d.data().section);
    });
    [...uniqueSections]
      .sort()
      .forEach((sec) =>
        select.insertAdjacentHTML(
          "beforeend",
          `<option value="${sec}">${sec}</option>`,
        ),
      );
  } catch (e) {
    console.error(e);
  }
}

window.fetchSectionCommits = async function () {
  const ghToken = localStorage.getItem("Adminerva_github_token");
  if (!ghToken) return alert("Missing GitHub PAT.");
  const section = document.getElementById("sectionSelect").value;
  const year = parseInt(document.getElementById("yearSelect").value);
  const month = parseInt(document.getElementById("monthSelect").value);
  const week = parseInt(document.getElementById("weekSelect").value);

  window.showLoader(`Fetching students in ${section}...`);
  try {
    const qStudents = query(
      collection(db, "students"),
      where("section", "==", section),
    );
    const stuSnap = await getDocs(qStudents);
    currentStudents = [];
    stuSnap.forEach((d) => currentStudents.push({ id: d.id, ...d.data() }));

    firestoreGradesMap = {};
    const qGrades = query(
      collection(db, "grades"),
      where("section", "==", section),
      where("year", "==", year),
      where("month", "==", month),
      where("week", "==", week),
    );
    const gradeSnap = await getDocs(qGrades);
    gradeSnap.forEach((d) => {
      firestoreGradesMap[d.data().studentId] = { docId: d.id, ...d.data() };
    });

    commitDataMap = {};
    for (let student of currentStudents) {
      commitDataMap[student.id] = {
        count: 0,
        additions: 0,
        deletions: 0,
        latestMsg: "No commits",
        patches: "",
        commitSha: null,
        error: null,
      };
      if (!student.repoUrl) {
        commitDataMap[student.id].error = "Missing Repo URL";
        continue;
      }

      try {
        const urlParts = student.repoUrl
          .replace(/\/$/, "")
          .replace(".git", "")
          .split("/");
        const repo = urlParts.pop();
        const owner = urlParts.pop();

        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits?since=${activeStartDateStr}&until=${activeEndDateStr}`,
          {
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: "application/vnd.github+json",
            },
          },
        );

        if (!response.ok) {
          commitDataMap[student.id].error =
            response.status === 409 ? "Empty Repo" : `Error ${response.status}`;
          continue;
        }

        let commits = await response.json();
        const ghUsername = (student.githubUsername || "").toLowerCase().trim();
        commits = commits.filter(
          (c) => (c.author?.login || "").toLowerCase() === ghUsername,
        );

        commitDataMap[student.id].count = commits.length;
        if (commits.length > 0) {
          commitDataMap[student.id].commitSha = commits[0]?.sha || null;
          commitDataMap[student.id].latestMsg =
            commits[0]?.commit?.message || "No commit message";
          commitDataMap[student.id].allMsgs = commits.map(
            (c) => c?.commit?.message,
          );

          for (let i = 0; i < Math.min(commits.length, 10); i++) {
            const detailRes = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/commits/${commits[i].sha}`,
              { headers: { Authorization: `Bearer ${ghToken}` } },
            );
            if (detailRes.ok) {
              const detail = await detailRes.json();
              if (detail.stats) {
                commitDataMap[student.id].additions += detail.stats.additions;
                commitDataMap[student.id].deletions += detail.stats.deletions;
              }
              commitDataMap[student.id].patches +=
                `\n\n### MSG: "${commits[i]?.commit?.message}"\n`;
              if (detail.files)
                detail.files.forEach((file) => {
                  if (file.patch)
                    commitDataMap[student.id].patches +=
                      `--- ${file.filename} ---\n${file.patch}\n`;
                });
            }
          }
        }
      } catch (err) {
        commitDataMap[student.id].error = "Network Error";
      }
    }
    renderGradingTable();
  } catch (e) {
    alert(e.message);
  } finally {
    window.hideLoader();
  }
};

function renderGradingTable() {
  const tbody = document.getElementById("gradingTableBody");
  tbody.innerHTML = "";

  currentStudents.forEach((student) => {
    const ghData = commitDataMap[student.id];
    const dbGrade = firestoreGradesMap[student.id];
    const currentScore = dbGrade ? dbGrade.score : "";

    let commitDisplay = ghData.error
      ? `<span class="text-red-500 text-[10px] font-bold block">${ghData.error}</span>`
      : `<span class="${ghData.count === 0 ? "text-red-500" : "text-green-600"} font-bold text-sm">${ghData.count}</span>
         <div class="text-[10px] font-mono"><span class="text-green-600">+${ghData.additions}</span> <span class="text-red-500">-${ghData.deletions}</span></div>`;

    let reviewBtn =
      ghData.count > 0
        ? `<button onclick="openDetails('${student.id}')" class="bg-gray-100 border border-gray-300 font-semibold px-3 py-1.5 rounded text-xs hover:bg-gray-200 shadow-sm">📄 View Code</button>`
        : `<span class="text-gray-400 text-xs italic">No code to view</span>`;

    const tr = `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 px-2 align-middle">
                <div class="font-bold text-gray-800 text-sm">${student.name}</div>
                <a href="${student.repoUrl}" target="_blank" class="text-[10px] text-blue-600 hover:underline truncate w-40 block">${student.repoUrl}</a>
            </td>
            <td class="py-3 px-2 text-center align-middle">${commitDisplay}</td>
            <td class="py-3 px-2 text-xs text-gray-600 align-middle">
                <div class="max-h-16 overflow-y-auto leading-snug">${ghData.latestMsg}</div>
            </td>
            <td class="py-3 px-2 text-center align-middle">${reviewBtn}</td>
            <td class="py-3 px-2 align-middle">
                <div class="flex items-center justify-center gap-2">
                    <input type="number" id="score_${student.id}" value="${currentScore}" class="w-16 p-1.5 border rounded text-center font-bold focus:ring-blue-500 ${currentScore !== "" ? "bg-green-50 border-green-300" : ""}" placeholder="0">
                    <button onclick="saveManualGrade('${student.id}')" class="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 shadow-sm">Save</button>
                </div>
            </td>
        </tr>
    `;
    tbody.insertAdjacentHTML("beforeend", tr);
  });
}

window.saveManualGrade = async function (studentId) {
  const scoreInput = document.getElementById(`score_${studentId}`).value;
  if (scoreInput === "") return alert("Please enter a valid score.");

  const score = parseInt(scoreInput);
  const student = currentStudents.find((s) => s.id === studentId);
  const data = commitDataMap[studentId];

  const y = parseInt(document.getElementById("yearSelect").value);
  const m = parseInt(document.getElementById("monthSelect").value);
  const w = parseInt(document.getElementById("weekSelect").value);
  const gradeDocId = `${student.id}_${y}_m${m}_w${w}`;

  window.showLoader(`Saving score for ${student.name}...`);
  try {
    const dbEntry = {
      studentId: student.id,
      section: student.section,
      githubUsername: student.githubUsername,
      year: y,
      month: m,
      week: w,
      quarter: getQuarter(m),
      score: score,
      maxScore: 100, // Assuming 100 for manual entry; adjust if necessary
      feedback: `<div class="text-sm text-gray-700 italic">Graded manually via Temp Checker.</div>`,
      commitSha: data.commitSha,
      isManual: true,
    };

    await setDoc(doc(db, "grades", gradeDocId), dbEntry, { merge: true });
    firestoreGradesMap[student.id] = { docId: gradeDocId, ...dbEntry };

    // Provide visual success feedback on the input field
    const inputField = document.getElementById(`score_${studentId}`);
    inputField.classList.add("bg-green-50", "border-green-300");
  } catch (err) {
    alert("Database save failed: " + err.message);
  } finally {
    window.hideLoader();
  }
};

window.openDetails = function (studentId) {
  const student = currentStudents.find((s) => s.id === studentId);
  const data = commitDataMap[studentId];
  if (!student || !data) return;

  document.getElementById("detailsTitle").textContent =
    `${student.name}'s Code`;
  document.getElementById("detCommits").textContent = data.count;
  document.getElementById("detAdded").textContent = "+" + data.additions;
  document.getElementById("detDeleted").textContent = "-" + data.deletions;
  document.getElementById("detCommitList").innerHTML = data.allMsgs
    ? data.allMsgs.map((m) => `<li>${m}</li>`).join("")
    : "";
  document.getElementById("detCodeBlock").textContent =
    data.patches || "No readable code changes recorded.";
  document.getElementById("detailsModal").classList.remove("hidden");
};

window.closeDetailsModal = function () {
  document.getElementById("detailsModal").classList.add("hidden");
};
