import { db } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// State Variables
let allSections = [];
let objectiveRules = [];
let assessments = [];

// Trackers for modals
let currentAssessmentId = null;
let assignSelectedSections = []; // used for the assign modal

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

function getTypeStyle(type) {
  if (type === "Mini PETA")
    return "bg-purple-500/20 text-purple-600 border-purple-500/30";
  if (type === "Practical Exam")
    return "bg-red-500/20 text-red-600 border-red-500/30";
  if (type === "Formative")
    return "bg-green-500/20 text-green-600 border-green-500/30";
  return "bg-blue-500/20 text-blue-600 border-blue-500/30"; // Written Work
}

function renderAssessmentGrid() {
  const grid = document.getElementById("assessmentGrid");
  grid.innerHTML = "";

  if (assessments.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-12 text-center text-gray-400 italic border-2 border-dashed border-gray-300 rounded-lg">No assessments created yet. Click "+ New Blueprint" to start.</div>`;
    return;
  }

  assessments.forEach((item) => {
    const sectionsHtml = (item.targetSections || [])
      .map(
        (sec) =>
          `<span class="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-full font-bold shadow-sm">${escapeHTML(sec)}</span>`,
      )
      .join("");

    const typeColor = getTypeStyle(item.type);

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
                        <div class="text-[10px] font-bold text-gray-400 uppercase mb-1 flex justify-between">
                            <span>Assigned Sections</span>
                            <span class="text-blue-500">${(item.targetSections || []).length} Active</span>
                        </div>
                        <div class="flex flex-wrap gap-1">
                            ${sectionsHtml || `<span class="text-xs text-gray-400 italic">Unassigned - Template Only</span>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    grid.insertAdjacentHTML("beforeend", card);
  });
}

// ==========================================
// VIEW, CREATE & EDIT MODALS
// ==========================================
window.openCreateModal = function () {
  currentAssessmentId = null; // We are creating, not editing

  document.getElementById("createModalTitle").textContent =
    "Create Assessment Blueprint";
  document.getElementById("saveAssessmentBtn").textContent = "Save Blueprint";

  document.getElementById("assessTitle").value = "";
  document.getElementById("assessType").value = "Mini PETA";
  document.getElementById("assessPath").value = "";
  document.getElementById("aiPersona").value =
    "You are a strict Java high school programming teacher grading a student's code.";
  document.getElementById("taskContext").value = "";
  document.getElementById("evalCriteria").value = "";

  objectiveRules = [];
  renderRules();

  document.getElementById("createModal").classList.remove("hidden");
};

window.openEditModal = function () {
  const item = assessments.find((a) => a.id === currentAssessmentId);
  if (!item) return;

  document.getElementById("createModalTitle").textContent = "Edit Blueprint";
  document.getElementById("saveAssessmentBtn").textContent = "Update Blueprint";

  document.getElementById("assessTitle").value = item.title || "";
  document.getElementById("assessType").value = item.type || "Mini PETA";
  document.getElementById("assessPath").value = item.targetPath || "";
  document.getElementById("aiPersona").value = item.aiPersona || "";
  document.getElementById("taskContext").value = item.taskContext || "";
  document.getElementById("evalCriteria").value = item.evalCriteria || "";

  objectiveRules = [...(item.rules || [])];
  renderRules();

  document.getElementById("viewModal").classList.add("hidden");
  document.getElementById("createModal").classList.remove("hidden");
};

window.openViewModal = function (id) {
  const item = assessments.find((a) => a.id === id);
  if (!item) return;

  currentAssessmentId = id;

  // Inject data into view modal
  document.getElementById("viewTitle").textContent = item.title || "Untitled";
  document.getElementById("viewTargetPath").textContent = item.targetPath
    ? `Target: ${item.targetPath}`
    : "Target: No specific path set";
  document.getElementById("viewTaskContext").textContent =
    item.taskContext || "No context provided.";
  document.getElementById("viewEvalCriteria").textContent =
    item.evalCriteria || "No rubric provided.";
  document.getElementById("viewAIPersona").textContent =
    item.aiPersona || "No persona set.";

  // Style Badge
  const badge = document.getElementById("viewTypeBadge");
  badge.textContent = item.type || "Unknown";
  badge.className = `text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider inline-block ${getTypeStyle(item.type)}`;

  // Inject Rules
  const rulesList = document.getElementById("viewObjectiveRules");
  rulesList.innerHTML = "";
  if (item.rules && item.rules.length > 0) {
    item.rules.forEach((rule) => {
      const color =
        rule.type === "Banned"
          ? "text-red-500 bg-red-50"
          : "text-green-600 bg-green-50";
      rulesList.insertAdjacentHTML(
        "beforeend",
        `<li><span class="font-mono ${color} px-1 rounded">${escapeHTML(rule.type)}: ${escapeHTML(rule.value)}</span></li>`,
      );
    });
  } else {
    rulesList.innerHTML = `<li class="text-gray-400 italic text-xs">No objective filters set.</li>`;
  }

  document.getElementById("viewModal").classList.remove("hidden");
};

window.closeModals = function () {
  document.getElementById("createModal").classList.add("hidden");
  document.getElementById("viewModal").classList.add("hidden");
  document.getElementById("assignModal").classList.add("hidden");
};

// ==========================================
// DATABASE OPERATIONS
// ==========================================
window.saveAssessment = async function () {
  const title = document.getElementById("assessTitle").value.trim();
  if (!title) return alert("Please enter an Assessment Title.");

  const payload = {
    title: title,
    type: document.getElementById("assessType").value,
    targetPath: document.getElementById("assessPath").value.trim(),
    aiPersona: document.getElementById("aiPersona").value.trim(),
    taskContext: document.getElementById("taskContext").value.trim(),
    evalCriteria: document.getElementById("evalCriteria").value.trim(),
    rules: objectiveRules,
  };

  window.showSubtleLoader("Saving Blueprint...");

  try {
    if (currentAssessmentId) {
      // Update existing
      await updateDoc(doc(db, "assessments", currentAssessmentId), payload);
    } else {
      // Create new (initialize targetSections as empty array)
      payload.targetSections = [];
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "assessments"), payload);
    }
    window.closeModals();
    await loadAssessments();
  } catch (e) {
    alert("Failed to save: " + e.message);
  } finally {
    window.hideSubtleLoader();
  }
};

window.deleteAssessment = async function () {
  if (!currentAssessmentId) return;

  if (
    confirm(
      "Are you sure you want to permanently delete this Assessment Blueprint? It will be removed from all assigned sections.",
    )
  ) {
    window.showSubtleLoader("Deleting...");
    try {
      await deleteDoc(doc(db, "assessments", currentAssessmentId));
      window.closeModals();
      await loadAssessments();
    } catch (e) {
      alert("Error deleting: " + e.message);
    } finally {
      window.hideSubtleLoader();
    }
  }
};

// ==========================================
// DYNAMIC RULES BUILDER
// ==========================================
window.addObjectiveRule = function () {
  const type = document.getElementById("newRuleType").value;
  const value = document.getElementById("newRuleValue").value.trim();
  if (!value) return;

  objectiveRules.push({ type, value });
  document.getElementById("newRuleValue").value = "";
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
    container.insertAdjacentHTML(
      "beforeend",
      `
            <div class="flex justify-between items-center p-2 rounded border ${colorClass} text-sm font-mono shadow-sm">
                <div><span class="font-bold text-[10px] uppercase tracking-wider">${rule.type}:</span> ${escapeHTML(rule.value)}</div>
                <button onclick="window.removeObjectiveRule(${index})" class="text-gray-400 hover:text-red-600 font-bold">&times;</button>
            </div>
        `,
    );
  });
}

// ==========================================
// SECTION ASSIGNMENT LOGIC
// ==========================================
window.openAssignModal = function () {
  const item = assessments.find((a) => a.id === currentAssessmentId);
  if (!item) return;

  assignSelectedSections = [...(item.targetSections || [])];
  renderAssignChips();
  updateAssignDropdown();

  document.getElementById("assignModal").classList.remove("hidden");
};

function updateAssignDropdown() {
  const selector = document.getElementById("assignSelector");
  selector.innerHTML = `<option value="" disabled selected>+ Select a section to assign...</option>`;

  const available = allSections.filter(
    (sec) => !assignSelectedSections.includes(sec),
  );
  available.forEach((sec) => {
    selector.insertAdjacentHTML(
      "beforeend",
      `<option value="${escapeHTML(sec)}">${escapeHTML(sec)}</option>`,
    );
  });
}

function renderAssignChips() {
  const container = document.getElementById("assignChipsContainer");
  container.innerHTML = "";
  if (assignSelectedSections.length === 0) {
    container.innerHTML = `<span class="text-xs text-gray-400 italic py-1">No active sections.</span>`;
    return;
  }
  assignSelectedSections.forEach((sec) => {
    container.insertAdjacentHTML(
      "beforeend",
      `
            <span class="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-blue-200 shadow-sm">
                ${escapeHTML(sec)} <button onclick="window.removeAssignChip('${escapeHTML(sec)}')" class="hover:text-red-500 ml-1 focus:outline-none">&times;</button>
            </span>
        `,
    );
  });
}

window.addAssignChip = function (section) {
  if (!section || assignSelectedSections.includes(section)) return;
  assignSelectedSections.push(section);
  document.getElementById("assignSelector").value = "";
  renderAssignChips();
  updateAssignDropdown();
};

window.removeAssignChip = function (section) {
  assignSelectedSections = assignSelectedSections.filter((s) => s !== section);
  renderAssignChips();
  updateAssignDropdown();
};

window.saveAssignments = async function () {
  if (!currentAssessmentId) return;
  window.showSubtleLoader("Deploying assignments...");

  try {
    await updateDoc(doc(db, "assessments", currentAssessmentId), {
      targetSections: assignSelectedSections,
    });
    document.getElementById("assignModal").classList.add("hidden");
    await loadAssessments(); // Refresh cards to show new assignment count
    window.openViewModal(currentAssessmentId); // Refresh view modal state
  } catch (e) {
    alert("Failed to assign: " + e.message);
  } finally {
    window.hideSubtleLoader();
  }
};
