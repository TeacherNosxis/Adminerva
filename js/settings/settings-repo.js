import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc, // Add this
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
  const modalSelect = document.getElementById("modalStudentSection");

  if (filterSelect) {
    filterSelect.innerHTML = `<option value="ALL">All Sections</option>`;
    window.allSections.forEach((sec) => {
      filterSelect.insertAdjacentHTML(
        "beforeend",
        `<option value="${sec.name}">${sec.name}</option>`,
      );
    });
  }

  // NEW: Populate the Add/Edit Student Modal dropdown
  if (modalSelect) {
    modalSelect.innerHTML = "";
    if (window.allSections.length === 0) {
      modalSelect.innerHTML = `<option value="" disabled>No sections available. Add one first.</option>`;
    } else {
      window.allSections.forEach((sec) => {
        modalSelect.insertAdjacentHTML(
          "beforeend",
          `<option value="${sec.name}">${sec.name}</option>`,
        );
      });
    }
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

  // NEW: Reset the section selection to the first available option
  if (
    document.getElementById("modalStudentSection") &&
    window.allSections.length > 0
  ) {
    document.getElementById("modalStudentSection").value =
      window.allSections[0].name;
  }

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

  // NEW: Pull the student's assigned section into the dropdown
  if (document.getElementById("modalStudentSection")) {
    document.getElementById("modalStudentSection").value = s.section || "";
  }

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
window.addNewSection = async function () {
  // Matches the ID in settings.html
  const inputEl = document.getElementById("newSectionInput");
  if (!inputEl) return alert("Could not find the section input field.");

  const sectionName = inputEl.value.trim();
  if (!sectionName) return alert("Please enter a section name.");
  if (!window.db) return alert("Firebase disconnected.");

  window.showLoader("Adding Section to Cloud...");

  try {
    const { addDoc, collection } =
      await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");

    // Save to the Firestore 'sections' collection
    await addDoc(collection(window.db, "sections"), { name: sectionName });

    inputEl.value = ""; // Clear the input box

    // Refresh the local arrays, dropdowns, and tables
    if (window.loadSectionsAndStudents) {
      await window.loadSectionsAndStudents();
    }
  } catch (err) {
    alert("Failed to add section: " + err.message);
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

async function initRubric() {
  const activeId = localStorage.getItem("Adminerva_active_template_id");
  const rubricLabel = document.getElementById("activeRubricLabel");

  const setNoRubricWarning = () => {
    rubricLabel.textContent = "WARNING: No Rubric Found!";
    rubricLabel.classList.replace("text-purple-600", "text-red-600");
  };

  if (!activeId || !db) return setNoRubricWarning();

  try {
    const docSnap = await getDoc(doc(db, "templates", activeId));
    if (docSnap.exists()) {
      activeTemplate = { id: docSnap.id, ...docSnap.data() };
      rubricLabel.textContent = activeTemplate.name;
    } else {
      setNoRubricWarning();
    }
  } catch (e) {
    console.error("Failed to fetch active rubric:", e);
    setNoRubricWarning();
  }
}

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

  // NEW: Populate General Prompt
  if (document.getElementById("tplGeneralPrompt"))
    document.getElementById("tplGeneralPrompt").value =
      window.editingTemplate.generalPrompt || "";

  // NEW: Check the correct Scoring Mode radio button
  document.getElementsByName("tplScoreType").forEach((r) => {
    r.checked =
      r.value === (window.editingTemplate.scoringType || "percentage");
  });

  const container = document.getElementById("criteriaContainer");
  if (!container) return;
  container.innerHTML = "";

  let totalWeight = 0; // NEW: Track total weight for the UI

  window.editingTemplate.criteria.forEach((crit, index) => {
    totalWeight += Number(crit.weight || 0);
    container.insertAdjacentHTML(
      "beforeend",
      `
            <div class="criterion-row bg-white border border-gray-200 rounded p-3 flex gap-3 mb-2">
                <input type="text" class="crit-name w-1/4 p-1 border-b" value="${crit.name}" onchange="updateTemplatePreview()">
                <input type="number" class="crit-weight w-1/6 p-1 border-b" value="${crit.weight}" onchange="updateTemplatePreview(); window.renderTemplateEditor();">
                <input type="text" class="crit-desc w-1/2 p-1 border-b" value="${crit.description}" onchange="updateTemplatePreview()">
                <button onclick="removeCriterion(${index})" class="text-red-400">🗑️</button>
            </div>
        `,
    );
  });

  // NEW: Update the Total Weight badge
  const weightBadge = document.getElementById("tplTotalWeight");
  if (weightBadge) {
    const isPct = window.editingTemplate.scoringType === "percentage";
    weightBadge.textContent = `Total: ${totalWeight}${isPct ? "%" : " pts"}`;
  }
};

window.updateTemplatePreview = function () {
  window.editingTemplate.name =
    document.getElementById("tplName")?.value || "Unnamed";

  // NEW: Save General Prompt
  window.editingTemplate.generalPrompt =
    document.getElementById("tplGeneralPrompt")?.value || "";

  // NEW: Save Scoring Mode
  const scoreType = document.querySelector(
    'input[name="tplScoreType"]:checked',
  );
  if (scoreType) {
    window.editingTemplate.scoringType = scoreType.value;
  }

  window.editingTemplate.criteria = Array.from(
    document.querySelectorAll(".criterion-row"),
  ).map((row) => ({
    name: row.querySelector(".crit-name").value,
    weight: Number(row.querySelector(".crit-weight").value),
    description: row.querySelector(".crit-desc").value,
  }));
};

// ==========================================
// MISSING TEMPLATE MANAGEMENT FUNCTIONS
// ==========================================

window.equipCurrentTemplate = function () {
  const selectedId = document.getElementById("templateSelect").value;
  window.activeTemplateId = selectedId;

  // Save to localStorage so AutoGrader can find it
  localStorage.setItem("Adminerva_active_template_id", selectedId);

  window.updateRubricEquippedUI();
  window.renderTemplateDropdown();
  alert("✅ Rubric equipped! The AutoGrader will now use this template.");
};

window.createNewTemplate = function () {
  const newId = "tpl_" + Date.now();
  window.editingTemplate = {
    id: newId,
    name: "New Custom Template",
    scoringType: "percentage",
    generalPrompt: "",
    criteria: [
      { name: "First Criterion", weight: 100, description: "Description here" },
    ],
  };

  window.templates.push(window.editingTemplate);
  window.renderTemplateDropdown();
  document.getElementById("templateSelect").value = newId;
  window.renderTemplateEditor();
};

window.deleteCurrentTemplate = async function () {
  if (window.templates.length <= 1)
    return alert("You must have at least one template.");

  if (
    confirm(`Are you sure you want to delete '${window.editingTemplate.name}'?`)
  ) {
    window.showLoader("Deleting from Cloud...");
    try {
      if (window.db) {
        const { doc, deleteDoc } =
          await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
        await deleteDoc(doc(window.db, "templates", window.editingTemplate.id));
      }

      window.templates = window.templates.filter(
        (t) => t.id !== window.editingTemplate.id,
      );
      window.editingTemplate = JSON.parse(JSON.stringify(window.templates[0]));

      window.renderTemplateDropdown();
      window.renderTemplateEditor();
    } catch (e) {
      alert("Failed to delete rubric: " + e.message);
    } finally {
      window.hideLoader();
    }
  }
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

window.saveRubrics = async function () {
  if (!window.db) return alert("Firebase disconnected.");
  window.showLoader("Saving Rubric to Cloud...");
  window.updateTemplatePreview();

  try {
    // Save or update the rubric in the "templates" collection using its ID
    await setDoc(
      doc(window.db, "templates", window.editingTemplate.id),
      window.editingTemplate,
    );

    // Update local state
    const idx = window.templates.findIndex(
      (t) => t.id === window.editingTemplate.id,
    );
    if (idx >= 0) window.templates[idx] = window.editingTemplate;
    else window.templates.push(window.editingTemplate);

    window.renderTemplateDropdown();
    alert("Rubric saved to cloud successfully.");
  } catch (e) {
    alert("Failed to save rubric: " + e.message);
  } finally {
    window.hideLoader();
  }
};

window.handleCsvUpload = function (event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!window.db) return alert("Firebase disconnected. Check settings.");
  window.showLoader("Importing and Deduplicating Students...");

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async function (results) {
      const data = results.data;
      const uniqueStudents = new Map();

      for (const rawRow of data) {
        // 1. NORMALIZE HEADERS: Strip spaces, colons, and weird characters, and make lowercase
        const row = {};
        for (const key in rawRow) {
          const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
          row[cleanKey] = rawRow[key];
        }

        // 2. EXTRACT DATA: Target the normalized keys (e.g., "yourfirstname" instead of "Your First Name:")
        const firstName = row.yourfirstname || row.firstname || "";
        const lastName = row.yourlastname || row.lastname || "";
        const name =
          `${firstName} ${lastName}`.trim() || row.name || row.fullname || "";

        const email =
          row.emailaddress || row.githubemailaddress || row.email || "";

        const section =
          row.section ||
          document.getElementById("sectionFilterSelect")?.value ||
          "Default";

        const githubUsername =
          row.exactgithubusername || row.githubusername || row.github || "";

        let repoUrl =
          row.publicrepositoryurl ||
          row.repourl ||
          row.repositorylink ||
          row.repository ||
          row.repo ||
          "";
        repoUrl = repoUrl.replace(/[\[\]\s]/g, ""); // Cleans [https://...] to https://...

        // 3. ADD TO MAP: If the core data exists, queue it for import
        if (name && githubUsername && repoUrl) {
          const uniqueKey = email
            ? email.toLowerCase().trim()
            : name.toLowerCase().trim();
          uniqueStudents.set(uniqueKey, {
            name,
            email,
            section,
            githubUsername,
            repoUrl,
          });
        } else {
          // Logs skipped rows to the developer console for debugging
          console.warn("Skipped row due to missing data:", rawRow);
        }
      }

      try {
        const { collection, addDoc } =
          await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
        let successCount = 0;

        for (const [key, studentData] of uniqueStudents.entries()) {
          await addDoc(collection(window.db, "students"), studentData);
          successCount++;
        }

        event.target.value = "";
        if (window.loadSectionsAndStudents)
          await window.loadSectionsAndStudents();

        if (successCount === 0) {
          alert(
            "⚠️ 0 students imported. Please press F12 to check the console and see why rows were skipped.",
          );
        } else {
          alert(`✅ Successfully imported ${successCount} unique students.`);
        }
      } catch (err) {
        alert("Import failed: " + err.message);
      } finally {
        window.hideLoader();
      }
    },
    error: function (err) {
      window.hideLoader();
      alert("Failed to read CSV: " + err.message);
    },
  });
};
