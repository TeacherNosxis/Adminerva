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
    const msgEl = document.getElementById('loaderMessage');
    if (msgEl) msgEl.textContent = msg;
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.classList.remove('hidden');
        loader.classList.add('flex');
    }
};

window.hideLoader = function() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.classList.add('hidden');
        loader.classList.remove('flex');
    }
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadSecuritySettings();
    loadLessonReviewSettings(); 
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
        if (!pane || !btn) return;
        
        if (t === tabName) {
            pane.classList.remove('hidden');
            btn.className = `flex-1 py-4 text-sm font-bold border-b-2 transition ${tabName === 'repo' ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-blue-600 text-blue-700 bg-blue-50'}`;
        } else {
            pane.classList.add('hidden');
            btn.className = "flex-1 py-4 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition bg-white";
        }
    });
};

window.switchAdminTab = function(tabId) {
    ['security', 'students', 'rubrics'].forEach(id => {
        const pane = document.getElementById('tab-' + id);
        const btn = document.getElementById('tabBtn-' + id);
        if (!pane || !btn) return;

        pane.classList.add('hidden');
        pane.classList.remove('block');
        btn.classList.remove('tab-active'); 
        btn.classList.add('tab-inactive');
    });
    
    const activePane = document.getElementById('tab-' + tabId);
    const activeBtn = document.getElementById('tabBtn-' + tabId);
    if (activePane && activeBtn) {
        activePane.classList.remove('hidden');
        activePane.classList.add('block');
        activeBtn.classList.add('tab-active'); 
        activeBtn.classList.remove('tab-inactive');
    }
};

// ----------------------------------------------------
// LESSONREVIEW SETTINGS LOGIC
// ----------------------------------------------------
window.loadLessonReviewSettings = async function() {
    if (!db) return;

    try {
        const docRef = doc(db, "global_settings", "lesson_review_config");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Populate fields if they exist in cloud data
            if (document.getElementById('setTeacherName')) document.getElementById('setTeacherName').value = data.teacher_name || '';
            if (document.getElementById('setSubjectTitle')) document.getElementById('setSubjectTitle').value = data.subject_title || '';
            if (document.getElementById('settingsHeaderImage')) document.getElementById('settingsHeaderImage').value = data.header_image_url || '';
            
            if (document.getElementById('sigTeacher')) document.getElementById('sigTeacher').value = data.sig_teacher || '';
            if (document.getElementById('sigTeacherTitle')) document.getElementById('sigTeacherTitle').value = data.sig_teacher_title || '';
            if (document.getElementById('sigSubjectCoord')) document.getElementById('sigSubjectCoord').value = data.sig_subject_coord || '';
            if (document.getElementById('sigSubjectCoordTitle')) document.getElementById('sigSubjectCoordTitle').value = data.sig_subject_coord_title || '';
            if (document.getElementById('sigGradeCoord')) document.getElementById('sigGradeCoord').value = data.sig_grade_coord || '';
            if (document.getElementById('sigGradeCoordTitle')) document.getElementById('sigGradeCoordTitle').value = data.sig_grade_coord_title || '';
            if (document.getElementById('sigPrincipal')) document.getElementById('sigPrincipal').value = data.sig_principal || '';
            if (document.getElementById('sigPrincipalTitle')) document.getElementById('sigPrincipalTitle').value = data.sig_principal_title || '';

            // Sync cache back to localStorage for fast access during printing
            if (data.header_image_url) localStorage.setItem('lessonReview_headerImage', data.header_image_url);
            if (data.sig_teacher) localStorage.setItem('lessonReview_sigTeacher', data.sig_teacher);
            if (data.sig_teacher_title) localStorage.setItem('lessonReview_sigTeacherTitle', data.sig_teacher_title);
            if (data.sig_subject_coord) localStorage.setItem('lessonReview_sigSubjectCoord', data.sig_subject_coord);
            if (data.sig_subject_coord_title) localStorage.setItem('lessonReview_sigSubjectCoordTitle', data.sig_subject_coord_title);
            if (data.sig_grade_coord) localStorage.setItem('lessonReview_sigGradeCoord', data.sig_grade_coord);
            if (data.sig_grade_coord_title) localStorage.setItem('lessonReview_sigGradeCoordTitle', data.sig_grade_coord_title);
            if (data.sig_principal) localStorage.setItem('lessonReview_sigPrincipal', data.sig_principal);
            if (data.sig_principal_title) localStorage.setItem('lessonReview_sigPrincipalTitle', data.sig_principal_title);
        }
    } catch (e) {
        console.error("Error loading settings from cloud:", e);
    }
};
window.saveLessonReviewSettings = async function() {
    if (!db) {
        alert("Firebase is not connected! Please configure it in Global Settings first.");
        return;
    }

    const loader = document.getElementById('globalLoader');
    if (loader) loader.classList.replace('hidden', 'flex');

    try {
        const settingsData = {
            teacher_name: document.getElementById('setTeacherName').value.trim(),
            subject_title: document.getElementById('setSubjectTitle').value.trim(),
            header_image_url: document.getElementById('settingsHeaderImage').value.trim(), // <--- Cloud Header Image
            sig_teacher: document.getElementById('sigTeacher').value.trim(),
            sig_teacher_title: document.getElementById('sigTeacherTitle').value.trim(),
            sig_subject_coord: document.getElementById('sigSubjectCoord').value.trim(),
            sig_subject_coord_title: document.getElementById('sigSubjectCoordTitle').value.trim(),
            sig_grade_coord: document.getElementById('sigGradeCoord').value.trim(),
            sig_grade_coord_title: document.getElementById('sigGradeCoordTitle').value.trim(),
            sig_principal: document.getElementById('sigPrincipal').value.trim(),
            sig_principal_title: document.getElementById('sigPrincipalTitle').value.trim(),
            updated_at: new Date().toISOString()
        };

        // Save to Firebase Firestore
        await setDoc(doc(db, "global_settings", "lesson_review_config"), settingsData, { merge: true });

        // Also update localStorage backup for instant local retrieval
        localStorage.setItem('lessonReview_headerImage', settingsData.header_image_url);
        localStorage.setItem('lessonReview_sigTeacher', settingsData.sig_teacher);
        localStorage.setItem('lessonReview_sigTeacherTitle', settingsData.sig_teacher_title);
        localStorage.setItem('lessonReview_sigSubjectCoord', settingsData.sig_subject_coord);
        localStorage.setItem('lessonReview_sigSubjectCoordTitle', settingsData.sig_subject_coord_title);
        localStorage.setItem('lessonReview_sigGradeCoord', settingsData.sig_grade_coord);
        localStorage.setItem('lessonReview_sigGradeCoordTitle', settingsData.sig_grade_coord_title);
        localStorage.setItem('lessonReview_sigPrincipal', settingsData.sig_principal);
        localStorage.setItem('lessonReview_sigPrincipalTitle', settingsData.sig_principal_title);

        alert("✅ LessonReview settings and header image successfully saved to the cloud!");
    } catch (e) {
        console.error("Error saving settings:", e);
        alert("Failed to save settings to Firebase: " + e.message);
    } finally {
        if (loader) loader.classList.replace('flex', 'hidden');
    }
};

// ----------------------------------------------------
// DATABASE & SECURITY LOGIC
// ----------------------------------------------------
function loadSecuritySettings() {
    const safeSet = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val; };

    safeSet('adminGithubToken', localStorage.getItem('repoReview_github_token') || "");
    safeSet('adminGeminiKey', localStorage.getItem('repoReview_gemini_token') || "");
    safeSet('adminAiModel', localStorage.getItem('repoReview_ai_model') || "gemini-1.5-flash");
    
    const fbConfig = localStorage.getItem('repoReview_firebase_config');
    if (fbConfig) {
        safeSet('firebaseConfigInput', fbConfig);
    }
}

window.saveSecuritySettings = async function() {
    const safeGet = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : "";

    const firebaseInput = safeGet('firebaseConfigInput');
    const githubInput = safeGet('adminGithubToken');
    const apiKeyInput = safeGet('adminGeminiKey');
    const aiModelInput = safeGet('adminAiModel') || 'gemini-1.5-flash';

    const saveBtn = document.getElementById('saveSecurityBtn'); 
    let originalText = "Save Security Settings";
    
    if (saveBtn) {
        originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = "⏳ Testing Connection...";
        saveBtn.disabled = true;
    }

    try {
        // Only test the AI Connection if an API key was actually typed in
        if (apiKeyInput) {
            const testPrompt = "Reply with exactly one word: SUCCESS";
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModelInput}:generateContent?key=${apiKeyInput}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: testPrompt }] }]
                })
            });

            if (!response.ok) {
                const errorDetails = await response.text();
                throw new Error(`Error Code ${response.status}\n\nGoogle says: ${errorDetails}`);
            }
        }

        // Save EVERYTHING securely to local storage
        localStorage.setItem('repoReview_firebase_config', firebaseInput);
        localStorage.setItem('repoReview_github_token', githubInput);
        localStorage.setItem('repoReview_gemini_token', apiKeyInput);
        localStorage.setItem('repoReview_ai_model', aiModelInput);
        
        if (apiKeyInput) {
            alert("✅ Security Settings Saved!\nAI Connection tested successfully. Your Firebase and GitHub settings were also saved.");
        } else {
            alert("✅ Settings Saved!\n(Skipped AI test because no Gemini API Key was entered).");
        }

    } catch (error) {
        alert("🚨 AI TEST FAILED!\n\nSettings were NOT saved. Please fix the issue below:\n\n" + error.message);
    } finally {
        if (saveBtn) {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
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
        const tbody = document.getElementById('studentTableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-red-500 font-bold">Failed to connect to Firebase. Check your configuration.</td></tr>`;
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
    if (filterSelect) {
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
    }

    const modalSelect = document.getElementById('modalStudentSection');
    if (modalSelect) {
        modalSelect.innerHTML = '';
        allSections.forEach(sec => {
            const opt = document.createElement('option');
            opt.value = sec.name;
            opt.textContent = sec.name;
            modalSelect.appendChild(opt);
        });
    }

    renderSectionsManagerTable();
}

function renderSectionsManagerTable() {
    const tbody = document.getElementById('sectionsTableBody');
    if (!tbody) return; // Safely exit if the modal HTML is missing!
    
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
    const modal = document.getElementById('sectionsModal');
    if (modal) modal.classList.replace('hidden', 'flex');
    else alert("Sections Modal HTML is missing!");
};

window.closeSectionsModal = function() {
    const modal = document.getElementById('sectionsModal');
    if (modal) modal.classList.replace('flex', 'hidden');
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
    if (!tbody) return;

    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        allStudents = [];
        querySnapshot.forEach(d => {
            allStudents.push({ id: d.id, ...d.data() });
        });

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
    const filterSelect = document.getElementById('sectionFilterSelect');
    const tbody = document.getElementById('studentTableBody');
    if (!filterSelect || !tbody) return;
    
    const filter = filterSelect.value;
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
    const safeSet = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val; };
    const safeText = (id, text) => { if(document.getElementById(id)) document.getElementById(id).textContent = text; };

    safeText('studentModalTitle', "Add New Student");
    safeSet('modalStudentDocId', "");
    safeSet('modalStudentName', "");
    safeSet('modalStudentEmail', "");
    safeSet('modalStudentGithub', "");
    safeSet('modalStudentRepo', "");
    
    const filterSelect = document.getElementById('sectionFilterSelect');
    if (filterSelect && filterSelect.value !== "ALL") {
        safeSet('modalStudentSection', filterSelect.value);
    }

    const modal = document.getElementById('studentModal');
    if (modal) modal.classList.replace('hidden', 'flex');
    else alert("Student Modal HTML is missing!");
};

window.editStudent = function(docId) {
    const student = allStudents.find(s => s.id === docId);
    if (!student) return;

    const safeSet = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val; };
    
    if (document.getElementById('studentModalTitle')) {
        document.getElementById('studentModalTitle').textContent = "Edit Student Profile";
    }
    
    safeSet('modalStudentDocId', docId);
    safeSet('modalStudentSection', student.section || allSections[0]?.name || "");
    safeSet('modalStudentName', student.name || "");
    safeSet('modalStudentEmail', student.email || "");
    safeSet('modalStudentGithub', student.githubUsername || "");
    safeSet('modalStudentRepo', student.repoUrl || "");

    const modal = document.getElementById('studentModal');
    if (modal) modal.classList.replace('hidden', 'flex');
    else alert("Student Modal HTML is missing!");
};

window.closeStudentModal = function() {
    const modal = document.getElementById('studentModal');
    if (modal) modal.classList.replace('flex', 'hidden');
};

window.saveStudentForm = async function(event) {
    event.preventDefault();
    if (!db) return alert("Firebase is not connected.");

    const safeGet = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : "";
    const docId = document.getElementById('modalStudentDocId') ? document.getElementById('modalStudentDocId').value : "";

    const studentData = {
        section: safeGet('modalStudentSection'),
        name: safeGet('modalStudentName'),
        email: safeGet('modalStudentEmail'),
        githubUsername: safeGet('modalStudentGithub'),
        repoUrl: safeGet('modalStudentRepo')
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
    
    const banner = document.getElementById('activeEquippedBanner');
    if (banner) banner.textContent = activeTpl.name;

    const badge = document.getElementById('editorStatusBadge');
    const equipBtn = document.getElementById('equipTemplateBtn');
    
    if (!badge || !equipBtn) return;

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
    if (!select) return;
    
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
    const tplNameEl = document.getElementById('tplName');
    if (tplNameEl) editingTemplate.name = tplNameEl.value.trim() || "Unnamed Template";
    
    const scoreTypeEl = document.querySelector('input[name="tplScoreType"]:checked');
    if (scoreTypeEl) editingTemplate.scoringType = scoreTypeEl.value;
    
    const genPromptEl = document.getElementById('tplGeneralPrompt');
    if (genPromptEl) editingTemplate.generalPrompt = genPromptEl.value;
    
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
    const safeSet = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val; };
    
    safeSet('tplName', editingTemplate.name);
    safeSet('tplGeneralPrompt', editingTemplate.generalPrompt);
    
    document.getElementsByName('tplScoreType').forEach(r => r.checked = (r.value === editingTemplate.scoringType));

    const container = document.getElementById('criteriaContainer');
    if (!container) return;
    
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
    
    const weightEl = document.getElementById('tplTotalWeight');
    if (weightEl) {
        weightEl.textContent = `Total: ${totalWeight}${editingTemplate.scoringType === 'percentage' ? '%' : ' pts'}`;
    }
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