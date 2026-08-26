import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ==========================================
// GLOBAL STATE & LOADER
// ==========================================
let db = null;
let allStudents = [];
let allSections = [];
let templates = [];
let activeTemplateId = null;
let editingTemplate = null;

window.showLoader = function(msg = "Processing...") {
    document.getElementById('loaderMessage').textContent = msg;
    const loader = document.getElementById('globalLoader');
    loader.classList.remove('hidden');
    loader.classList.add('flex');
};

window.hideLoader = function() {
    const loader = document.getElementById('globalLoader');
    loader.classList.add('hidden');
    loader.classList.remove('flex');
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadSecuritySettings();
    loadLessonReviewSettings(); // Load LessonReview settings
    initFirebase();
    initRubrics();

    const csvInput = document.getElementById('csvFileInput');
    if(csvInput) csvInput.addEventListener('change', handleCsvUpload);
});

// ----------------------------------------------------
// UI TABS (Main & Sub-tabs)
// ----------------------------------------------------
window.switchSettingsTab = function(tabName) {
    ['repo', 'lesson'].forEach(t => {
        const pane = document.getElementById('settingsTab-' + t);
        const btn = document.getElementById('settingsTabBtn-' + t);
        if (t === tabName) {
            pane.classList.remove('hidden');
            // Assuming purple for RepoReview, blue for LessonReview based on previous styling
            btn.className = `flex-1 py-4 text-sm font-bold border-b-2 transition ${tabName === 'repo' ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-blue-600 text-blue-700 bg-blue-50'}`;
        } else {
            pane.classList.add('hidden');
            btn.className = "flex-1 py-4 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition bg-white";
        }
    });
};

window.switchAdminTab = function(tabId) {
    ['security', 'students', 'rubrics'].forEach(id => {
        document.getElementById('tab-' + id).classList.add('hidden');
        document.getElementById('tab-' + id).classList.remove('block');
        const btn = document.getElementById('tabBtn-' + id);
        btn.classList.remove('tab-active'); 
        btn.classList.add('tab-inactive');
    });
    document.getElementById('tab-' + tabId).classList.remove('hidden');
    document.getElementById('tab-' + tabId).classList.add('block');
    const activeBtn = document.getElementById('tabBtn-' + tabId);
    activeBtn.classList.add('tab-active'); 
    activeBtn.classList.remove('tab-inactive');
};

// ----------------------------------------------------
// LESSONREVIEW SETTINGS LOGIC
// ----------------------------------------------------
function loadLessonReviewSettings() {
    document.getElementById('setTeacherName').value = localStorage.getItem('lessonReview_teacherName') || "";
    document.getElementById('setSubjectTitle').value = localStorage.getItem('lessonReview_subjectTitle') || "";
    document.getElementById('sigTeacher').value = localStorage.getItem('lessonReview_sigTeacher') || "Computer Teacher";
    document.getElementById('sigTeacherTitle').value = localStorage.getItem('lessonReview_sigTeacherTitle') || "Teacher";
    document.getElementById('sigSubjectCoord').value = localStorage.getItem('lessonReview_sigSubjectCoord') || "Mr. Mer Ryanson Bañez";
    document.getElementById('sigSubjectCoordTitle').value = localStorage.getItem('lessonReview_sigSubjectCoordTitle') || "ICT Subject Coordinator";
    document.getElementById('sigGradeCoord').value = localStorage.getItem('lessonReview_sigGradeCoord') || "Mr. Darwin S. Mijares";
    document.getElementById('sigGradeCoordTitle').value = localStorage.getItem('lessonReview_sigGradeCoordTitle') || "Grade 11 Coordinator";
    document.getElementById('sigPrincipal').value = localStorage.getItem('lessonReview_sigPrincipal') || "Mrs. Lucille Ariette A. Bautista";
    document.getElementById('sigPrincipalTitle').value = localStorage.getItem('lessonReview_sigPrincipalTitle') || "JHS/SHS Principal";
}

window.saveLessonReviewSettings = function() {
    localStorage.setItem('lessonReview_teacherName', document.getElementById('setTeacherName').value.trim());
    localStorage.setItem('lessonReview_subjectTitle', document.getElementById('setSubjectTitle').value.trim());
    localStorage.setItem('lessonReview_sigTeacher', document.getElementById('sigTeacher').value.trim());
    localStorage.setItem('lessonReview_sigTeacherTitle', document.getElementById('sigTeacherTitle').value.trim());
    localStorage.setItem('lessonReview_sigSubjectCoord', document.getElementById('sigSubjectCoord').value.trim());
    localStorage.setItem('lessonReview_sigSubjectCoordTitle', document.getElementById('sigSubjectCoordTitle').value.trim());
    localStorage.setItem('lessonReview_sigGradeCoord', document.getElementById('sigGradeCoord').value.trim());
    localStorage.setItem('lessonReview_sigGradeCoordTitle', document.getElementById('sigGradeCoordTitle').value.trim());
    localStorage.setItem('lessonReview_sigPrincipal', document.getElementById('sigPrincipal').value.trim());
    localStorage.setItem('lessonReview_sigPrincipalTitle', document.getElementById('sigPrincipalTitle').value.trim());
    
    alert("LessonReview export defaults saved successfully!");
};

// ----------------------------------------------------
// DATABASE & SECURITY LOGIC
// ----------------------------------------------------
function loadSecuritySettings() {
    document.getElementById('adminGithubToken').value = localStorage.getItem('repoReview_github_token') || "";
    document.getElementById('adminGeminiKey').value = localStorage.getItem('repoReview_gemini_token') || "";
    document.getElementById('adminAiModel').value = localStorage.getItem('repoReview_ai_model') || "gemini-3.5-flash";
    
    const fbConfig = localStorage.getItem('repoReview_firebase_config');
    if (fbConfig) {
        document.getElementById('firebaseConfigInput').value = fbConfig;
    }
}

window.saveSecuritySettings = async function() {
    // 1. Get the exact inputs you want to test
    const apiKeyInput = document.getElementById('repoReview_gemini_token').value.trim();
    const aiModelInput = document.getElementById('repoReview_ai_model').value.trim();
    const saveBtn = document.getElementById('saveSecurityBtn'); // Your save button ID

    if (!apiKeyInput || !aiModelInput) {
        return alert("Please enter both a Gemini API Key and an AI Model name.");
    }

    // 2. Change the button to a loading state so you know it's testing
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = "⏳ Testing Connection...";
    saveBtn.disabled = true;

    try {
        // 3. Send a tiny "ping" to the AI to see if the door opens
        const testPrompt = "Reply with exactly one word: SUCCESS";
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModelInput}:generateContent?key=${apiKeyInput}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: testPrompt }] }]
            })
        });

        // 4. Trap the exact error if Google rejects the model or key
        if (!response.ok) {
            const errorDetails = await response.text();
            throw new Error(`Error Code ${response.status}\n\nGoogle says: ${errorDetails}`);
        }

        // 5. If it gets to this line, the test passed! Save the settings.
        localStorage.setItem('repoReview_gemini_token', apiKeyInput);
        localStorage.setItem('repoReview_ai_model', aiModelInput);
        
        alert("✅ AI Connection Successful!\nYour API Key and Model are perfectly configured and saved.");

    } catch (error) {
        // 6. Alert the exact reason it failed so you don't have to guess
        alert("🚨 AI TEST FAILED!\n\nSettings were NOT saved. Please fix the issue below:\n\n" + error.message);
    } finally {
        // Restore the save button
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
};

function initFirebase() {
    const configStr = localStorage.getItem('repoReview_firebase_config');
    if (!configStr) return;

    try {
        const firebaseConfig = JSON.parse(configStr);
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        
        loadSectionsAndStudents();
    } catch (e) {
        console.error("Firebase Initialization Failed:", e);
        document.getElementById('studentTableBody').innerHTML = `<tr><td colspan="6" class="py-4 text-center text-red-500 font-bold">Failed to connect to Firebase. Check your configuration.</td></tr>`;
    }
}

// ----------------------------------------------------
// SECTIONS MANAGEMENT
// ----------------------------------------------------
async function loadSectionsAndStudents() {
    window.showLoader("Loading Database...");
    await fetchSectionsFromFirebase();
    await fetchStudentsFromFirebase();
    window.hideLoader();
}

async function fetchSectionsFromFirebase() {
    if (!db) return;
    try {
        const snap = await getDocs(collection(db, "sections"));
        allSections = [];
        snap.forEach(d => allSections.push({ id: d.id, ...d.data() }));
        populateSectionDropdowns();
    } catch (e) {
        console.error("Error fetching sections:", e);
    }
}

function populateSectionDropdowns() {
    const filterSelect = document.getElementById('sectionFilterSelect');
    const curVal = filterSelect.value;
    filterSelect.innerHTML = `<option value="ALL">All Sections (All Students)</option>`;
    
    allSections.forEach(sec => {
        const opt = document.createElement('option');
        opt.value = sec.name;
        opt.textContent = sec.name;
        filterSelect.appendChild(opt);
    });
    if ([...filterSelect.options].some(o => o.value === curVal)) {
        filterSelect.value = curVal;
    }

    const modalSelect = document.getElementById('modalStudentSection');
    modalSelect.innerHTML = '';
    allSections.forEach(sec => {
        const opt = document.createElement('option');
        opt.value = sec.name;
        opt.textContent = sec.name;
        modalSelect.appendChild(opt);
    });

    renderSectionsManagerTable();
}

function renderSectionsManagerTable() {
    const tbody = document.getElementById('sectionsTableBody');
    tbody.innerHTML = '';
    allSections.forEach(sec => {
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-gray-50";
        tr.innerHTML = `
            <td class="p-2 font-medium text-gray-800">${sec.name}</td>
            <td class="p-2 text-center">
                <button onclick="deleteSectionDoc('${sec.id}', '${sec.name}')" class="text-red-500 hover:text-red-700 text-xs font-bold">🗑️ Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openSectionsModal = function() {
    renderSectionsManagerTable();
    document.getElementById('sectionsModal').classList.remove('hidden');
};

window.closeSectionsModal = function() {
    document.getElementById('sectionsModal').classList.add('hidden');
};

window.addNewSection = async function() {
    const name = document.getElementById('newSectionInput').value.trim();
    if (!name) return alert("Please type a section name.");

    if (allSections.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        return alert("This section already exists.");
    }

    if (!db) return alert("Firebase is not connected.");

    window.showLoader("Saving new section to Firebase...");
    try {
        const docRef = await addDoc(collection(db, "sections"), { name });
        allSections.push({ id: docRef.id, name });
        document.getElementById('newSectionInput').value = '';
        populateSectionDropdowns();
    } catch (e) {
        alert("Failed to add section. Have you created the Firestore Database in the console? Error: " + e.message);
    } finally {
        window.hideLoader();
    }
};

window.deleteSectionDoc = async function(id, name) {
    if (confirm(`Delete section '${name}'? (Students assigned to this section will remain in the database).`)) {
        window.showLoader("Deleting section...");
        try {
            await deleteDoc(doc(db, "sections", id));
            allSections = allSections.filter(s => s.id !== id);
            populateSectionDropdowns();
        } catch (e) {
            alert("Error deleting section: " + e.message);
        } finally {
            window.hideLoader();
        }
    }
};

// ----------------------------------------------------
// STUDENT FIRESTORE MANAGEMENT & FILTERING
// ----------------------------------------------------
async function fetchStudentsFromFirebase() {
    if (!db) return;
    const tbody = document.getElementById('studentTableBody');

    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        allStudents = [];
        querySnapshot.forEach(d => {
            allStudents.push({ id: d.id, ...d.data() });
        });

        // Ensure newly discovered sections from students exist
        let newSecAdded = false;
        for (let s of allStudents) {
            if (s.section && !allSections.some(sec => sec.name === s.section)) {
                const docRef = await addDoc(collection(db, "sections"), { name: s.section });
                allSections.push({ id: docRef.id, name: s.section });
                newSecAdded = true;
            }
        }
        if (newSecAdded) populateSectionDropdowns();

        filterStudentsTable();
    } catch (error) {
        console.error("Error loading students:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-red-500">Error fetching data. Check Firestore rules.</td></tr>`;
    }
}

window.filterStudentsTable = function() {
    const filter = document.getElementById('sectionFilterSelect').value;
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '';

    const filtered = filter === "ALL" 
        ? allStudents 
        : allStudents.filter(s => s.section === filter);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-gray-400 italic">No students found.</td></tr>`;
        return;
    }

    filtered.forEach((data) => {
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-gray-50";
        tr.innerHTML = `
            <td class="py-2.5 px-4 font-semibold text-purple-700">${data.section || 'Unassigned'}</td>
            <td class="py-2.5 px-4 text-gray-800 font-medium">${data.name || 'N/A'}</td>
            <td class="py-2.5 px-4 text-gray-500 text-xs">${data.email || 'N/A'}</td>
            <td class="py-2.5 px-4 text-gray-600 font-mono text-xs">${data.githubUsername || 'N/A'}</td>
            <td class="py-2.5 px-4 text-blue-500 text-xs truncate max-w-[220px]">
                <a href="${data.repoUrl}" target="_blank" class="hover:underline" title="${data.repoUrl}">${data.repoUrl || 'N/A'}</a>
            </td>
            <td class="py-2.5 px-4 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick="editStudent('${data.id}')" class="text-blue-500 hover:text-blue-700 text-xs font-bold" title="Edit Student">✏️ Edit</button>
                    <button onclick="deleteStudent('${data.id}')" class="text-red-400 hover:text-red-600 text-xs font-bold" title="Delete Student">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ----------------------------------------------------
// ADD / EDIT INDIVIDUAL STUDENT (MODAL)
// ----------------------------------------------------
window.openAddStudentModal = function() {
    document.getElementById('studentModalTitle').textContent = "Add New Student";
    document.getElementById('modalStudentDocId').value = "";
    document.getElementById('modalStudentName').value = "";
    document.getElementById('modalStudentEmail').value = "";
    document.getElementById('modalStudentGithub').value = "";
    document.getElementById('modalStudentRepo').value = "";
    
    const activeFilter = document.getElementById('sectionFilterSelect').value;
    if (activeFilter !== "ALL") {
        document.getElementById('modalStudentSection').value = activeFilter;
    }

    document.getElementById('studentModal').classList.remove('hidden');
};

window.editStudent = function(docId) {
    const student = allStudents.find(s => s.id === docId);
    if (!student) return;

    document.getElementById('studentModalTitle').textContent = "Edit Student Profile";
    document.getElementById('modalStudentDocId').value = docId;
    document.getElementById('modalStudentSection').value = student.section || allSections[0]?.name || "";
    document.getElementById('modalStudentName').value = student.name || "";
    document.getElementById('modalStudentEmail').value = student.email || "";
    document.getElementById('modalStudentGithub').value = student.githubUsername || "";
    document.getElementById('modalStudentRepo').value = student.repoUrl || "";

    document.getElementById('studentModal').classList.remove('hidden');
};

window.closeStudentModal = function() {
    document.getElementById('studentModal').classList.add('hidden');
};

window.saveStudentForm = async function(event) {
    event.preventDefault();
    if (!db) return alert("Firebase is not connected.");

    const docId = document.getElementById('modalStudentDocId').value;
    const studentData = {
        section: document.getElementById('modalStudentSection').value,
        name: document.getElementById('modalStudentName').value.trim(),
        email: document.getElementById('modalStudentEmail').value.trim(),
        githubUsername: document.getElementById('modalStudentGithub').value.trim(),
        repoUrl: document.getElementById('modalStudentRepo').value.trim()
    };

    window.showLoader("Saving student profile...");
    try {
        if (docId) {
            await updateDoc(doc(db, "students", docId), studentData);
            const index = allStudents.findIndex(s => s.id === docId);
            if (index !== -1) allStudents[index] = { id: docId, ...studentData };
        } else {
            const newDoc = await addDoc(collection(db, "students"), studentData);
            allStudents.push({ id: newDoc.id, ...studentData });
        }

        closeStudentModal();
        filterStudentsTable();
    } catch (e) {
        alert("Failed to save student. Ensure Firestore rules are set to allow writes. Error: " + e.message);
    } finally {
        window.hideLoader();
    }
};

window.deleteStudent = async function(docId) {
    if (confirm("Are you sure you want to remove this student?")) {
        window.showLoader("Deleting student...");
        try {
            await deleteDoc(doc(db, "students", docId));
            allStudents = allStudents.filter(s => s.id !== docId);
            filterStudentsTable();
        } catch (e) {
            alert("Error deleting document: " + e.message);
        } finally {
            window.hideLoader();
        }
    }
};

window.clearAllStudents = async function() {
    if (confirm("WARNING: This will delete ALL students from the database. Proceed?")) {
        window.showLoader("Wiping roster from database...");
        try {
            const querySnapshot = await getDocs(collection(db, "students"));
            const batch = writeBatch(db);
            querySnapshot.forEach((docSnap) => batch.delete(docSnap.ref));
            await batch.commit();
            allStudents = [];
            filterStudentsTable();
        } catch (e) {
            alert("Error clearing roster: " + e.message);
        } finally {
            window.hideLoader();
        }
    }
};

// ----------------------------------------------------
// CSV BULK IMPORT
// ----------------------------------------------------
function handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!db) return alert("Firebase is not connected. Save configuration first.");

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            const data = results.data;
            if (data.length === 0) return alert("CSV file contains no records.");

            window.showLoader(`Importing ${data.length} students to Firebase...`);

            try {
                const batch = writeBatch(db);
                for (let row of data) {
                    const sec = row.Section || row.section || "Default Section";
                    const docRef = doc(collection(db, "students")); 
                    batch.set(docRef, {
                        name: row.Name || row.name || "",
                        email: row.Email || row.email || "",
                        section: sec,
                        githubUsername: row.GitHubUsername || row.github || "",
                        repoUrl: row.RepoURL || row.repo || ""
                    });
                }

                await batch.commit();
                await loadSectionsAndStudents();
                alert(`Successfully imported ${data.length} students to Firebase!`);
            } catch (err) {
                console.error("Batch write failed", err);
                alert("Failed to write to Firebase: " + err.message);
            } finally {
                window.hideLoader();
                event.target.value = '';
            }
        }
    });
}

// ----------------------------------------------------
// RUBRICS & EQUIPPED STATUS SYSTEM
// ----------------------------------------------------
const DEFAULT_TEMPLATES = [
    {
        id: "default_pct", 
        name: "Standard Project Grading (Percentage)", 
        scoringType: "percentage", 
        generalPrompt: "",
        criteria: [
            { name: "Logic & Functionality", weight: 40, description: "Missing logic, functionality gaps, logic errors." },
            { name: "Code Quality & Naming", weight: 30, description: "Variables named well, readability, clean structure." },
            { name: "Efficiency & Optimization", weight: 30, description: "Redundant loops or unnecessary calls." }
        ]
    }
];

function initRubrics() {
    const storedTemplates = localStorage.getItem('repoReview_grading_templates');
    templates = storedTemplates ? JSON.parse(storedTemplates) : JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    
    activeTemplateId = localStorage.getItem('repoReview_active_template_id');
    if (!templates.find(t => t.id === activeTemplateId)) {
        activeTemplateId = templates[0].id;
        localStorage.setItem('repoReview_active_template_id', activeTemplateId);
    }

    const templateToLoad = templates.find(t => t.id === activeTemplateId) || templates[0];
    editingTemplate = JSON.parse(JSON.stringify(templateToLoad));
    
    renderTemplateDropdown();
    renderTemplateEditor();
    updateRubricEquippedUI();
}

function updateRubricEquippedUI() {
    const activeTpl = templates.find(t => t.id === activeTemplateId) || templates[0];
    document.getElementById('activeEquippedBanner').textContent = activeTpl.name;

    const badge = document.getElementById('editorStatusBadge');
    const equipBtn = document.getElementById('equipTemplateBtn');

    if (editingTemplate.id === activeTemplateId) {
        badge.className = "text-xs px-2.5 py-0.5 rounded-full font-bold bg-green-100 text-green-800";
        badge.textContent = "🟢 EQUIPPED & IN-USE";
        equipBtn.classList.add('opacity-50', 'cursor-not-allowed');
        equipBtn.disabled = true;
        equipBtn.innerHTML = `<span>✅</span> Equipped for AutoGrader`;
    } else {
        badge.className = "text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800";
        badge.textContent = "⚪ INACTIVE TEMPLATE (Not Equipped)";
        equipBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        equipBtn.disabled = false;
        equipBtn.innerHTML = `<span>🎯</span> Equip as Active Rubric`;
    }
}

function renderTemplateDropdown() {
    const select = document.getElementById('templateSelect');
    select.innerHTML = '';
    templates.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.id === activeTemplateId ? `⭐ [ACTIVE] ${t.name}` : t.name;
        if (t.id === editingTemplate.id) opt.selected = true;
        select.appendChild(opt);
    });
}

window.equipCurrentTemplate = function() {
    activeTemplateId = editingTemplate.id;
    localStorage.setItem('repoReview_active_template_id', activeTemplateId);
    
    renderTemplateDropdown();
    updateRubricEquippedUI();
};

window.changeTemplate = function() {
    const target = templates.find(t => t.id === document.getElementById('templateSelect').value);
    if (target) {
        editingTemplate = JSON.parse(JSON.stringify(target));
        renderTemplateEditor();
        updateRubricEquippedUI();
    }
};

window.createNewTemplate = function() {
    const newId = 'tpl_' + Date.now();
    editingTemplate = {
        id: newId,
        name: "New Custom Rubric",
        scoringType: "percentage",
        generalPrompt: "",
        criteria: [{ name: "Core Requirements", weight: 100, description: "Check functional requirements." }]
    };
    templates.push(editingTemplate); 
    renderTemplateDropdown();
    document.getElementById('templateSelect').value = newId;
    renderTemplateEditor();
    updateRubricEquippedUI();
};

window.deleteCurrentTemplate = function() {
    if (templates.length <= 1) return alert("At least one template must remain.");
    if (confirm(`Delete rubric '${editingTemplate.name}'?`)) {
        templates = templates.filter(t => t.id !== editingTemplate.id);
        if (activeTemplateId === editingTemplate.id) {
            activeTemplateId = templates[0].id;
            localStorage.setItem('repoReview_active_template_id', activeTemplateId);
        }
        editingTemplate = JSON.parse(JSON.stringify(templates[0]));
        renderTemplateDropdown();
        renderTemplateEditor();
        updateRubricEquippedUI();
    }
};

window.updateTemplatePreview = function() {
    editingTemplate.name = document.getElementById('tplName').value.trim() || "Unnamed Template";
    editingTemplate.scoringType = document.querySelector('input[name="tplScoreType"]:checked').value;
    editingTemplate.generalPrompt = document.getElementById('tplGeneralPrompt').value;
    
    const rowDivs = document.querySelectorAll('.criterion-row');
    editingTemplate.criteria = [];
    rowDivs.forEach((row) => {
        editingTemplate.criteria.push({
            name: row.querySelector('.crit-name').value, 
            weight: Number(row.querySelector('.crit-weight').value) || 0, 
            description: row.querySelector('.crit-desc').value
        });
    });
    renderTemplateEditor(); 
};

function renderTemplateEditor() {
    document.getElementById('tplName').value = editingTemplate.name;
    document.getElementById('tplGeneralPrompt').value = editingTemplate.generalPrompt;
    document.getElementsByName('tplScoreType').forEach(r => r.checked = (r.value === editingTemplate.scoringType));

    const container = document.getElementById('criteriaContainer');
    container.innerHTML = '';
    let totalWeight = 0;

    editingTemplate.criteria.forEach((crit, index) => {
        totalWeight += Number(crit.weight || 0);
        const html = `
            <div class="criterion-row bg-white border border-gray-200 rounded p-3 flex flex-col md:flex-row gap-3 items-start shadow-sm">
                <div class="w-full md:w-1/4">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase">Criterion Name</label>
                    <input type="text" class="crit-name w-full p-1.5 text-sm border-b focus:border-purple-500 outline-none" value="${crit.name}" onchange="updateTemplatePreview()">
                </div>
                <div class="w-full md:w-1/6">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase">${editingTemplate.scoringType === 'percentage' ? 'Weight %' : 'Points'}</label>
                    <input type="number" class="crit-weight w-full p-1.5 text-sm border-b focus:border-purple-500 outline-none" value="${crit.weight}" onchange="updateTemplatePreview()">
                </div>
                <div class="w-full md:flex-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase">AI Grading Constraints</label>
                    <input type="text" class="crit-desc w-full p-1.5 text-sm border-b focus:border-purple-500 outline-none" value="${crit.description}" onchange="updateTemplatePreview()">
                </div>
                <button onclick="removeCriterion(${index})" class="text-red-400 hover:text-red-600 p-2 md:mt-4">🗑️</button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
    document.getElementById('tplTotalWeight').textContent = `Total: ${totalWeight}${editingTemplate.scoringType === 'percentage' ? '%' : ' pts'}`;
}

window.addCriterion = function() { 
    window.updateTemplatePreview(); 
    editingTemplate.criteria.push({ name: "", weight: 10, description: "" }); 
    renderTemplateEditor(); 
};

window.removeCriterion = function(index) { 
    window.updateTemplatePreview(); 
    editingTemplate.criteria.splice(index, 1); 
    renderTemplateEditor(); 
};

window.saveRubrics = function() {
    window.updateTemplatePreview();
    const tIndex = templates.findIndex(t => t.id === editingTemplate.id);
    if (tIndex >= 0) templates[tIndex] = editingTemplate; 
    else templates.push(editingTemplate);
    
    localStorage.setItem('repoReview_grading_templates', JSON.stringify(templates));
    renderTemplateDropdown();
    updateRubricEquippedUI();
    alert(`Template '${editingTemplate.name}' saved successfully.`);
};