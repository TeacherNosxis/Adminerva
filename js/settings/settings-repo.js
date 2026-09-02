import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ==========================================
// STUDENT & SECTION MANAGEMENT
// ==========================================
window.allStudents = [];
window.allSections = [];

window.loadSectionsAndStudents = async function () {
  window.showLoader("Loading Database...");
  if (!window.db) return window.hideLoader();
  try {
    const [secSnap, stuSnap] = await Promise.all([
      getDocs(collection(window.db, "sections")),
      getDocs(collection(window.db, "students")),
    ]);

    window.allSections = [];
    secSnap.forEach((d) => window.allSections.push({ id: d.id, ...d.data() }));

    window.allStudents = [];
    stuSnap.forEach((d) => window.allStudents.push({ id: d.id, ...d.data() }));

    window.populateSectionDropdowns();
    window.filterStudentsTable();
  } catch (e) {
    console.error("Load failed:", e);
  } finally {
    window.hideLoader();
  }
};

window.populateSectionDropdowns = function () {
  const filterSelect = document.getElementById("sectionFilterSelect");
  if (filterSelect) {
    filterSelect.innerHTML = `<option value="ALL">All Sections</option>`;
    window.allSections.forEach((sec) => {
      filterSelect.insertAdjacentHTML(
        "beforeend",
        `<option value="${sec.name}">${sec.name}</option>`,
      );
    });
  }
  if (window.renderSectionsManagerTable) window.renderSectionsManagerTable();
};

window.renderSectionsManagerTable = function () {
  const tbody = document.getElementById("sectionsTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  window.allSections.forEach((sec) => {
    tbody.insertAdjacentHTML(
      "beforeend",
      `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-2 font-medium">${sec.name}</td>
                <td class="p-2 text-center"><button onclick="deleteSectionDoc('${sec.id}', '${sec.name}')" class="text-red-500 font-bold text-xs">🗑️</button></td>
            </tr>
        `,
    );
  });
};

window.filterStudentsTable = function () {
  const filter = document.getElementById("sectionFilterSelect")?.value || "ALL";
  const tbody = document.getElementById("studentTableBody");
  if (!tbody) return;

  const filtered =
    filter === "ALL"
      ? window.allStudents
      : window.allStudents.filter((s) => s.section === filter);
  tbody.innerHTML = "";

  if (filtered.length === 0)
    return (tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-400">No students found.</td></tr>`);

  filtered.forEach((data) => {
    tbody.insertAdjacentHTML(
      "beforeend",
      `
            <tr class="border-b hover:bg-gray-50">
                <td class="py-2.5 px-4 font-semibold text-purple-700">${data.section}</td>
                <td class="py-2.5 px-4">${data.name}</td>
                <td class="py-2.5 px-4 text-xs">${data.email}</td>
                <td class="py-2.5 px-4 text-xs">${data.githubUsername}</td>
                <td class="py-2.5 px-4 text-xs"><a href="${data.repoUrl}" target="_blank" class="text-blue-500 hover:underline">Link</a></td>
                <td class="py-2.5 px-4 text-center">
                    <button onclick="editStudent('${data.id}')" class="text-blue-500 text-xs font-bold mr-2">✏️</button>
                    <button onclick="deleteStudent('${data.id}')" class="text-red-400 text-xs font-bold">🗑️</button>
                </td>
            </tr>
        `,
    );
  });
};

window.openAddStudentModal = function () {
  document.getElementById("modalStudentDocId").value = "";
  document.getElementById("modalStudentName").value = "";
  document.getElementById("modalStudentEmail").value = "";
  document.getElementById("modalStudentGithub").value = "";
  document.getElementById("modalStudentRepo").value = "";
  document.getElementById("studentModal").classList.replace("hidden", "flex");
};

window.editStudent = function (id) {
  const s = window.allStudents.find((x) => x.id === id);
  if (!s) return;
  document.getElementById("modalStudentDocId").value = s.id;
  document.getElementById("modalStudentName").value = s.name;
  document.getElementById("modalStudentEmail").value = s.email;
  document.getElementById("modalStudentGithub").value = s.githubUsername;
  document.getElementById("modalStudentRepo").value = s.repoUrl;
  document.getElementById("studentModal").classList.replace("hidden", "flex");
};

window.saveStudentForm = async function (e) {
  e.preventDefault();
  if (!window.db) return alert("Firebase disconnected.");

  const id = document.getElementById("modalStudentDocId").value;
  const data = {
    name: document.getElementById("modalStudentName").value,
    email: document.getElementById("modalStudentEmail").value,
    section: document.getElementById("modalStudentSection")?.value || "Default",
    githubUsername: document.getElementById("modalStudentGithub").value,
    repoUrl: document.getElementById("modalStudentRepo").value,
  };

  window.showLoader();
  try {
    if (id) await updateDoc(doc(window.db, "students", id), data);
    else await addDoc(collection(window.db, "students"), data);

    await window.loadSectionsAndStudents();
    window.closeStudentModal();
  } catch (err) {
    alert("Save failed: " + err.message);
  } finally {
    window.hideLoader();
  }
};

window.deleteSectionDoc = async function (id, name) {
  if (confirm(`Delete section '${name}'?`)) {
    await deleteDoc(doc(window.db, "sections", id));
    window.loadSectionsAndStudents();
  }
};

window.deleteStudent = async function (id) {
  if (confirm("Remove student?")) {
    await deleteDoc(doc(window.db, "students", id));
    window.loadSectionsAndStudents();
  }
};

// ==========================================
// RUBRIC MANAGEMENT
// ==========================================
window.templates = [];
window.activeTemplateId = null;
window.editingTemplate = null;

const DEFAULT_TEMPLATES = [
  {
    id: "default_pct",
    name: "Standard Grading",
    scoringType: "percentage",
    generalPrompt: "",
    criteria: [{ name: "Logic", weight: 50, description: "Checks logic" }],
  },
];

window.initRubrics = function () {
  const stored = localStorage.getItem("repoReview_grading_templates");
  window.templates = stored
    ? JSON.parse(stored)
    : JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
  window.activeTemplateId =
    localStorage.getItem("repoReview_active_template_id") ||
    window.templates[0].id;
  window.editingTemplate = JSON.parse(
    JSON.stringify(
      window.templates.find((t) => t.id === window.activeTemplateId) ||
        window.templates[0],
    ),
  );

  window.renderTemplateDropdown();
  window.renderTemplateEditor();
  window.updateRubricEquippedUI();
};

window.renderTemplateDropdown = function () {
  const select = document.getElementById("templateSelect");
  if (!select) return;
  select.innerHTML = "";
  window.templates.forEach((t) => {
    select.insertAdjacentHTML(
      "beforeend",
      `<option value="${t.id}" ${t.id === window.editingTemplate.id ? "selected" : ""}>${t.id === window.activeTemplateId ? "⭐ " : ""}${t.name}</option>`,
    );
  });
};

window.updateRubricEquippedUI = function () {
  const banner = document.getElementById("activeEquippedBanner");
  if (banner)
    banner.textContent = (
      window.templates.find((t) => t.id === window.activeTemplateId) ||
      window.templates[0]
    ).name;
};

window.changeTemplate = function () {
  const target = window.templates.find(
    (t) => t.id === document.getElementById("templateSelect").value,
  );
  if (target) {
    window.editingTemplate = JSON.parse(JSON.stringify(target));
    window.renderTemplateEditor();
    window.updateRubricEquippedUI();
  }
};

window.renderTemplateEditor = function () {
  if (document.getElementById("tplName"))
    document.getElementById("tplName").value = window.editingTemplate.name;
  const container = document.getElementById("criteriaContainer");
  if (!container) return;
  container.innerHTML = "";
  window.editingTemplate.criteria.forEach((crit, index) => {
    container.insertAdjacentHTML(
      "beforeend",
      `
            <div class="criterion-row bg-white border border-gray-200 rounded p-3 flex gap-3 mb-2">
                <input type="text" class="crit-name w-1/4 p-1 border-b" value="${crit.name}" onchange="updateTemplatePreview()">
                <input type="number" class="crit-weight w-1/6 p-1 border-b" value="${crit.weight}" onchange="updateTemplatePreview()">
                <input type="text" class="crit-desc w-1/2 p-1 border-b" value="${crit.description}" onchange="updateTemplatePreview()">
                <button onclick="removeCriterion(${index})" class="text-red-400">🗑️</button>
            </div>
        `,
    );
  });
};

window.updateTemplatePreview = function () {
  window.editingTemplate.name =
    document.getElementById("tplName")?.value || "Unnamed";
  window.editingTemplate.criteria = Array.from(
    document.querySelectorAll(".criterion-row"),
  ).map((row) => ({
    name: row.querySelector(".crit-name").value,
    weight: Number(row.querySelector(".crit-weight").value),
    description: row.querySelector(".crit-desc").value,
  }));
};

window.addCriterion = function () {
  window.updateTemplatePreview();
  window.editingTemplate.criteria.push({
    name: "",
    weight: 10,
    description: "",
  });
  window.renderTemplateEditor();
};
window.removeCriterion = function (i) {
  window.updateTemplatePreview();
  window.editingTemplate.criteria.splice(i, 1);
  window.renderTemplateEditor();
};

window.saveRubrics = function () {
  window.updateTemplatePreview();
  const idx = window.templates.findIndex(
    (t) => t.id === window.editingTemplate.id,
  );
  if (idx >= 0) window.templates[idx] = window.editingTemplate;
  else window.templates.push(window.editingTemplate);
  localStorage.setItem(
    "repoReview_grading_templates",
    JSON.stringify(window.templates),
  );
  window.renderTemplateDropdown();
  alert("Saved.");
};
