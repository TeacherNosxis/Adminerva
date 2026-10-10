import { db } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
}

let allStudents = [];
let allAssessments = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadFilters();
  document.getElementById("gbSection").addEventListener("change", loadGrid);
  document.getElementById("gbAssessment").addEventListener("change", loadGrid);
});

async function loadFilters() {
  window.showSubtleLoader("Initializing Gradebook...");
  try {
    const [stuSnap, assSnap] = await Promise.all([
      getDocs(collection(db, "students")),
      getDocs(collection(db, "assessments")),
    ]);

    let sections = new Set();
    stuSnap.forEach((d) => {
      const data = d.data();
      allStudents.push({ id: d.id, ...data });
      if (data.section) sections.add(data.section);
    });

    const secSelect = document.getElementById("gbSection");
    secSelect.innerHTML =
      "<option value='' disabled selected>Select a section...</option>";
    [...sections]
      .sort()
      .forEach((s) =>
        secSelect.insertAdjacentHTML(
          "beforeend",
          `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`,
        ),
      );

    const assSelect = document.getElementById("gbAssessment");
    assSelect.innerHTML =
      "<option value='' disabled selected>Select an assessment...</option>";
    assSnap.forEach((d) => {
      allAssessments.push({ id: d.id, ...d.data() });
      assSelect.insertAdjacentHTML(
        "beforeend",
        `<option value="${d.id}">${escapeHTML(d.data().title)} (${escapeHTML(d.data().type)})</option>`,
      );
    });
  } catch (e) {
    console.error("Gradebook Load Error", e);
  } finally {
    window.hideSubtleLoader();
  }
}

async function loadGrid() {
  const section = document.getElementById("gbSection").value;
  const taskId = document.getElementById("gbAssessment").value;
  const tbody = document.getElementById("gbTableBody");

  if (!section || !taskId) return;

  tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center"><div class="animate-spin inline-block rounded-full h-6 w-6 border-b-2 border-indigo-600 mb-2"></div><p class="text-slate-400 font-bold text-sm">Crunching data...</p></td></tr>`;

  try {
    // Fetch ALL grades for this specific task
    const gradesSnap = await getDocs(
      query(collection(db, "student_grades"), where("taskId", "==", taskId)),
    );
    const gradeMap = {};
    gradesSnap.forEach((d) => (gradeMap[d.data().studentId] = d.data()));

    // Filter the students down to just the selected section
    const classStudents = allStudents
      .filter((s) => s.section === section)
      .sort((a, b) => a.name.localeCompare(b.name));

    tbody.innerHTML = "";

    classStudents.forEach((student) => {
      const grade = gradeMap[student.id];

      // 1. Repository Link Format
      let repoStatus = `<span class="text-[10px] bg-rose-50 text-rose-600 font-bold px-2 py-1 rounded border border-rose-200">No Repo Linked</span>`;
      if (student.repoUrl && student.repoUrl !== "unassigned") {
        repoStatus = `<a href="${escapeHTML(student.repoUrl)}" target="_blank" class="text-blue-500 hover:text-blue-700 hover:underline text-xs font-mono bg-blue-50 px-2 py-1 rounded border border-blue-100 transition">View Repository</a>`;
      }

      // 2. Score Badge Format
      let scoreBadge = `<span class="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">Needs Grading</span>`;
      let pubToggle = `<span class="text-slate-300 text-xs italic font-medium">Awaiting Score</span>`;

      if (grade) {
        let sColor =
          grade.score < 15
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : grade.score < 18
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200";
        scoreBadge = `
                    <div class="flex flex-col gap-1 w-64">
                        <span class="${sColor} px-2 py-0.5 rounded text-lg font-extrabold border inline-block w-12 text-center shadow-sm">${grade.score}</span>
                        <p class="text-[10px] text-slate-500 whitespace-normal leading-tight line-clamp-2" title="${escapeHTML(grade.feedback)}">${escapeHTML(grade.feedback)}</p>
                    </div>
                `;

        // 3. Publish Toggle Switch
        const isPub = grade.published || false;
        pubToggle = `
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer" ${isPub ? "checked" : ""} onchange="window.matrixTogglePub('${student.id}', '${taskId}', this)">
                        <div class="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                        <span class="ml-3 text-[10px] font-extrabold uppercase tracking-wider ${isPub ? "text-indigo-600" : "text-slate-400"}">${isPub ? "Visible" : "Hidden"}</span>
                    </label>
                `;
      }

      // Render Row
      tbody.insertAdjacentHTML(
        "beforeend",
        `
                <tr class="hover:bg-indigo-50/50 transition">
                    <td class="px-6 py-4">
                        <div class="font-extrabold text-slate-800 text-base">${escapeHTML(student.name)}</div>
                        <div class="text-[10px] text-slate-400 font-mono mt-0.5">@${escapeHTML(student.githubUsername || "unlinked")}</div>
                    </td>
                    <td class="px-6 py-4">${repoStatus}</td>
                    <td class="px-6 py-4">${scoreBadge}</td>
                    <td class="px-6 py-4">${pubToggle}</td>
                </tr>
            `,
      );
    });

    if (classStudents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-slate-400 font-medium italic">No students found in this section.</td></tr>`;
    }
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-red-500 font-bold border border-red-200 bg-red-50">Failed to load matrix. Check permissions.</td></tr>`;
  }
}

// Database Toggle Engine
window.matrixTogglePub = async function (studentId, taskId, checkbox) {
  try {
    await setDoc(
      doc(db, "student_grades", `${studentId}_${taskId}`),
      { published: checkbox.checked },
      { merge: true },
    );
    const span = checkbox.nextElementSibling.nextElementSibling;
    span.textContent = checkbox.checked ? "Visible" : "Hidden";
    span.className = `ml-3 text-[10px] font-extrabold uppercase tracking-wider ${checkbox.checked ? "text-indigo-600" : "text-slate-400"}`;
  } catch (e) {
    alert("Failed to update visibility");
    checkbox.checked = !checkbox.checked; // Revert switch if database fails
  }
};
