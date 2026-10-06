import { db } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- State Variables ---
let allSections = [];
let selectedSections = [];
let objectiveRules = [];
let assessments = [];

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

document.addEventListener("DOMContentLoaded", async () => {
  if (!db) return;
  window.showSubtleLoader("Loading Assessment Studio...");

  await fetchSectionsFromStudents();
  await loadAssessments();

  window.hideSubtleLoader();
});

// ==========================================
// DATA FETCHING & RENDERING
// ==========================================

async function fetchSectionsFromStudents() {
  try {
    const snap = await getDocs(collection(db, "students"));
    let uniqueSections = new Set();
    snap.forEach((d) => {
      if (d.data().section) uniqueSections.add(d.data().section);
    });
    allSections = [...uniqueSections].sort();
    updateSectionDropdown();
  } catch (e) {
    console.error("Error fetching sections: ", e);
  }
}

async function loadAssessments() {
  try {
    const q = query(
      collection(db, "assessments"),
      orderBy("createdAt", "desc"),
    );
    const snap = await getDocs(q);
    assessments = [];
    snap.forEach((doc) => assessments.push({ id: doc.id, ...doc.data() }));
    renderAssessmentGrid();
  } catch (e) {
    console.error("Error loading assessments: ", e);
  }
}

function renderAssessmentGrid() {
  const grid = document.getElementById("assessmentGrid");
  grid.innerHTML = "";

  if (assessments.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-12 text-center text-gray-400 italic border-2 border-dashed border-gray-300 rounded-lg">No assessments created yet. Click "+ New Assessment" to start.</div>`;
    return;
  }

  assessments.forEach((item) => {
    const sectionsHtml = (item.targetSections || [])
      .map(
        (sec) =>
          `<span class="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-full font-bold">${escapeHTML(sec)}</span>`,
      )
      .join("");

    const typeColor =
      item.type === "PETA"
        ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
        : item.type === "Formative"
          ? "bg-green-500/20 text-green-300 border-green-500/30"
          : "bg-blue-500/20 text-blue-300 border-blue-500/30";

    const card = `
            <div class="bg-white border rounded-xl shadow-sm hover:shadow-md transition cursor-pointer flex flex-col overflow-hidden" onclick="window.openViewModal('${item.id}')">
                <div class="bg-slate-800 p-4 border-b border-slate-700">
                    <div class="flex justify-between items-start mb-2">
                        <span class="${typeColor} text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider">${escapeHTML(item.type)}</span>
                        <span class="text-slate-400 hover:text-white transition">⋮</span>
                    </div>
                    <h3 class="font-bold text-white text-lg truncate" title="${escapeHTML(item.title)}">${escapeHTML(item.title)}</h3>
                </div>
                <div class="p-4 flex-1 flex flex-col">
                    <p class="text-sm text-gray-600 line-clamp-2 mb-4">${escapeHTML(item.taskContext || "No context provided.")}</p>
                    <div class="mt-auto">
                        <div class="text-[10px] font-bold text-gray-400 uppercase mb-1">Assigned To</div>
                        <div class="flex flex-wrap gap-1">
                            ${sectionsHtml || `<span class="text-xs text-gray-400 italic">Unassigned</span>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    grid.insertAdjacentHTML("beforeend", card);
  });
}

// ==========================================
// CHIP LOGIC (SECTION SELECTOR)
// ==========================================

function updateSectionDropdown() {
  const selector = document.getElementById("sectionSelector");
  selector.innerHTML = `<option value="" disabled selected>Select a section to add...</option>`;

  // Only show sections that haven't been selected yet
  const available = allSections.filter(
    (sec) => !selectedSections.includes(sec),
  );

  available.forEach((sec) => {
    selector.insertAdjacentHTML(
      "beforeend",
      `<option value="${escapeHTML(sec)}">${escapeHTML(sec)}</option>`,
    );
  });
}

function renderSectionChips() {
  const container = document.getElementById("selectedSectionsContainer");
  container.innerHTML = "";

  if (selectedSections.length === 0) {
    container.innerHTML = `<span class="text-xs text-gray-400 italic py-1">No sections assigned yet.</span>`;
    return;
  }

  selectedSections.forEach((sec) => {
    const chip = `
            <span class="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-blue-200 shadow-sm">
                ${escapeHTML(sec)} 
                <button onclick="window.removeSectionChip('${escapeHTML(sec)}')" class="hover:text-red-500 ml-1 focus:outline-none">&times;</button>
            </span>
        `;
    container.insertAdjacentHTML("beforeend", chip);
  });
}

window.addSectionChip = function (section) {
  if (!section || selectedSections.includes(section)) return;
  selectedSections.push(section);

  // Reset dropdown to default option
  document.getElementById("sectionSelector").value = "";

  renderSectionChips();
  updateSectionDropdown();
};

window.removeSectionChip = function (section) {
  selectedSections = selectedSections.filter((s) => s !== section);
  renderSectionChips();
  updateSectionDropdown();
};

// ==========================================
// DYNAMIC OBJECTIVE RULES
// ==========================================

window.addObjectiveRule = function () {
  const type = document.getElementById("newRuleType").value;
  const value = document.getElementById("newRuleValue").value.trim();

  if (!value) return;

  objectiveRules.push({ type, value });
  document.getElementById("newRuleValue").value = ""; // Clear input
  renderRules();
};

window.removeObjectiveRule = function (index) {
  objectiveRules.splice(index, 1);
  renderRules();
};

function renderRules() {
  const container = document.getElementById("rulesContainer");
  container.innerHTML = "";

  if (objectiveRules.length === 0) {
    container.innerHTML = `<div class="text-xs text-gray-400 italic">No objective rules added.</div>`;
    return;
  }

  objectiveRules.forEach((rule, index) => {
    const colorClass =
      rule.type === "Banned"
        ? "text-red-600 bg-red-50 border-red-200"
        : "text-green-600 bg-green-50 border-green-200";
    const ruleHtml = `
            <div class="flex justify-between items-center p-2 rounded border ${colorClass} text-sm font-mono shadow-sm">
                <div><span class="font-bold text-[10px] uppercase tracking-wider">${rule.type}:</span> ${escapeHTML(rule.value)}</div>
                <button onclick="window.removeObjectiveRule(${index})" class="text-gray-400 hover:text-red-600 font-bold">&times;</button>
            </div>
        `;
    container.insertAdjacentHTML("beforeend", ruleHtml);
  });
}

// ==========================================
// MODAL & DATABASE LOGIC
// ==========================================

window.openCreateModal = function () {
  // Reset Form State
  document.getElementById("assessTitle").value = "";
  document.getElementById("assessType").value = "PETA";
  document.getElementById("assessPath").value = "";
  document.getElementById("aiPersona").value =
    "You are a strict Java high school programming teacher grading a student's code.";
  document.getElementById("taskContext").value = "";
  document.getElementById("evalCriteria").value = "";

  selectedSections = [];
  objectiveRules = [];

  renderSectionChips();
  updateSectionDropdown();
  renderRules();

  document.getElementById("createModal").classList.remove("hidden");
};

window.closeModals = function () {
  document.getElementById("createModal").classList.add("hidden");
  document.getElementById("viewModal").classList.add("hidden");
};

window.saveAssessment = async function () {
  const title = document.getElementById("assessTitle").value.trim();
  const type = document.getElementById("assessType").value;
  const path = document.getElementById("assessPath").value.trim();

  if (!title) return alert("Please enter an Assessment Title.");

  const payload = {
    title: title,
    type: type,
    targetPath: path,
    targetSections: selectedSections,
    aiPersona: document.getElementById("aiPersona").value.trim(),
    taskContext: document.getElementById("taskContext").value.trim(),
    evalCriteria: document.getElementById("evalCriteria").value.trim(),
    rules: objectiveRules,
    createdAt: serverTimestamp(),
  };

  window.showSubtleLoader("Saving Blueprint...");

  try {
    await addDoc(collection(db, "assessments"), payload);
    window.closeModals();
    await loadAssessments(); // Refresh the grid
  } catch (e) {
    alert("Failed to save: " + e.message);
  } finally {
    window.hideSubtleLoader();
  }
};

window.openViewModal = function (id) {
  const item = assessments.find((a) => a.id === id);
  if (!item) return;

  // We will populate the view modal in the next step, for now it just opens it.
  document.getElementById("viewModal").classList.remove("hidden");
};
