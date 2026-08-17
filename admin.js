import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ==========================================
// GLOBAL STATE
// ==========================================
let db = null;
let templates = [];
let activeTemplateId = null;
let editingTemplate = null; 

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadSecuritySettings();
    initFirebase();
    initRubrics();

    // CSV Bulk Import Listener
    document.getElementById('csvFileInput').addEventListener('change', handleCsvUpload);
});

// ----------------------------------------------------
// UI TABS
// ----------------------------------------------------
window.switchAdminTab = function(tabId) {
    ['security', 'students', 'rubrics'].forEach(id => {
        document.getElementById('tab-' + id).classList.add('hidden');
        document.getElementById('tab-' + id).classList.remove('block');
        const btn = document.getElementById('tabBtn-' + id);
        btn.classList.remove('tab-active'); btn.classList.add('tab-inactive');
    });
    document.getElementById('tab-' + tabId).classList.remove('hidden');
    document.getElementById('tab-' + tabId).classList.add('block');
    const activeBtn = document.getElementById('tabBtn-' + tabId);
    activeBtn.classList.add('tab-active'); activeBtn.classList.remove('tab-inactive');
}

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

window.saveAdminSecurity = function() {
    const ghToken = document.getElementById('adminGithubToken').value.trim();
    const gemKey = document.getElementById('adminGeminiKey').value.trim();
    const aiModel = document.getElementById('adminAiModel').value.trim();
    const rawFbConfig = document.getElementById('firebaseConfigInput').value.trim();

    localStorage.setItem('repoReview_github_token', ghToken);
    localStorage.setItem('repoReview_gemini_token', gemKey);
    localStorage.setItem('repoReview_ai_model', aiModel);

    if (rawFbConfig) {
        try {
            // Validate it's proper JSON
            JSON.parse(rawFbConfig);
            localStorage.setItem('repoReview_firebase_config', rawFbConfig);
            alert("Settings Saved! Reloading to establish database connection.");
            location.reload();
        } catch (e) {
            alert("Invalid Firebase Configuration format. Please ensure it is a valid JSON object.");
        }
    } else {
        alert("Settings Saved locally.");
    }
}

function initFirebase() {
    const configStr = localStorage.getItem('repoReview_firebase_config');
    if (!configStr) return;

    try {
        const firebaseConfig = JSON.parse(configStr);
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        fetchStudentsFromFirebase();
    } catch (e) {
        console.error("Firebase Initialization Failed:", e);
        document.getElementById('studentTableBody').innerHTML = `<tr><td colspan="5" class="py-4 text-center text-red-500 font-bold">Failed to connect to Firebase. Check configuration.</td></tr>`;
    }
}

// ----------------------------------------------------
// STUDENT FIRESTORE MANAGEMENT
// ----------------------------------------------------
async function fetchStudentsFromFirebase() {
    if (!db) return;
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-500 animate-pulse">Loading roster from Firebase...</td></tr>`;

    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        tbody.innerHTML = '';
        
        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-400 italic">Database is empty. Import a CSV.</td></tr>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50";
            tr.innerHTML = `
                <td class="py-2 px-4 text-gray-600">${data.section || 'N/A'}</td>
                <td class="py-2 px-4 text-gray-800 font-medium">${data.name || 'N/A'}</td>
                <td class="py-2 px-4 text-gray-500">${data.githubUsername || 'N/A'}</td>
                <td class="py-2 px-4 text-blue-500 text-xs truncate max-w-[200px]"><a href="${data.repoUrl}" target="_blank">${data.repoUrl || 'N/A'}</a></td>
                <td class="py-2 px-4 text-center">
                    <button onclick="deleteStudent('${doc.id}')" class="text-red-400 hover:text-red-600 transition">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading students:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-red-500">Error fetching data. Check Firestore rules.</td></tr>`;
    }
}

function handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!db) {
        alert("Firebase is not connected. Save your config first.");
        return;
    }

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            const data = results.data;
            if (data.length === 0) return alert("CSV is empty.");

            const loadingInd = document.getElementById('importLoading');
            loadingInd.classList.remove('hidden');

            try {
                const batch = writeBatch(db);
                data.forEach(row => {
                    // Ensure your CSV headers exactly match these properties, or modify mapping here:
                    const docRef = doc(collection(db, "students")); 
                    batch.set(docRef, {
                        name: row.Name || row.name || "",
                        email: row.Email || row.email || "",
                        section: row.Section || row.section || "",
                        githubUsername: row.GitHubUsername || row.github || "",
                        repoUrl: row.RepoURL || row.repo || ""
                    });
                });

                await batch.commit();
                alert(`Successfully imported ${data.length} students to Firebase!`);
                fetchStudentsFromFirebase();
            } catch (err) {
                console.error("Batch write failed", err);
                alert("Failed to write to Firebase: " + err.message);
            } finally {
                loadingInd.classList.add('hidden');
                event.target.value = ''; // reset file input
            }
        }
    });
}

window.deleteStudent = async function(docId) {
    if (confirm("Are you sure you want to remove this student?")) {
        try {
            await deleteDoc(doc(db, "students", docId));
            fetchStudentsFromFirebase();
        } catch (e) {
            alert("Error deleting document: " + e.message);
        }
    }
}

window.clearAllStudents = async function() {
    if (confirm("WARNING: This will delete ALL students from Firebase. Are you absolutely sure?")) {
        try {
            const querySnapshot = await getDocs(collection(db, "students"));
            const batch = writeBatch(db);
            querySnapshot.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });
            await batch.commit();
            fetchStudentsFromFirebase();
            alert("Database cleared.");
        } catch (e) {
            alert("Error clearing database: " + e.message);
        }
    }
}

// ----------------------------------------------------
// RUBRICS EDITOR LOGIC
// ----------------------------------------------------
const DEFAULT_TEMPLATES = [
    {
        id: "default_pct", name: "Strict Core Grading (%)", scoringType: "percentage", generalPrompt: "",
        criteria: [
            { name: "Logic & Functionality", weight: 40, description: "Missing logic, functionality gaps, logic errors." },
            { name: "Syntax & Best Practices", weight: 30, description: "Syntax errors, naming conventions, optimization." },
            { name: "Documentation & Commits", weight: 30, description: "Commit clarity, code comments." }
        ]
    }
];

function initRubrics() {
    const storedTemplates = localStorage.getItem('repoReview_grading_templates');
    templates = storedTemplates ? JSON.parse(storedTemplates) : JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    activeTemplateId = localStorage.getItem('repoReview_active_template_id');
    if (!templates.find(t => t.id === activeTemplateId)) activeTemplateId = templates[0].id;

    const templateToLoad = templates.find(t => t.id === activeTemplateId) || templates[0];
    editingTemplate = JSON.parse(JSON.stringify(templateToLoad));
    
    renderTemplateDropdown();
    renderTemplateEditor();
}

function renderTemplateDropdown() {
    const select = document.getElementById('templateSelect');
    select.innerHTML = '';
    templates.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id; opt.textContent = t.name;
        if (t.id === editingTemplate.id) opt.selected = true;
        select.appendChild(opt);
    });
}

window.changeTemplate = function() {
    const target = templates.find(t => t.id === document.getElementById('templateSelect').value);
    if (target) { editingTemplate = JSON.parse(JSON.stringify(target)); renderTemplateEditor(); }
}

window.createNewTemplate = function() {
    const newId = 'tpl_' + Date.now();
    editingTemplate = { id: newId, name: "New Strict Rubric", scoringType: "percentage", generalPrompt: "", criteria: [{ name: "New Criterion", weight: 100, description: "Detail what to deduct points for." }] };
    templates.push(editingTemplate); 
    renderTemplateDropdown(); document.getElementById('templateSelect').value = newId; renderTemplateEditor();
}

window.deleteCurrentTemplate = function() {
    if (templates.length <= 1) return alert("At least one template must remain.");
    if (confirm(`Delete '${editingTemplate.name}'?`)) {
        templates = templates.filter(t => t.id !== editingTemplate.id);
        editingTemplate = JSON.parse(JSON.stringify(templates[0]));
        renderTemplateDropdown(); renderTemplateEditor();
    }
}

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
}

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
                    <label class="block text-[10px] font-bold text-gray-500 uppercase">Criterion</label>
                    <input type="text" class="crit-name w-full p-1.5 text-sm border-b focus:border-purple-500 outline-none" value="${crit.name}" onchange="updateTemplatePreview()">
                </div>
                <div class="w-full md:w-1/6">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase">${editingTemplate.scoringType === 'percentage' ? 'Weight %' : 'Points'}</label>
                    <input type="number" class="crit-weight w-full p-1.5 text-sm border-b focus:border-purple-500 outline-none" value="${crit.weight}" onchange="updateTemplatePreview()">
                </div>
                <div class="w-full md:flex-1">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase">AI Constraints</label>
                    <input type="text" class="crit-desc w-full p-1.5 text-sm border-b focus:border-purple-500 outline-none" value="${crit.description}" onchange="updateTemplatePreview()">
                </div>
                <button onclick="removeCriterion(${index})" class="text-red-400 hover:text-red-600 p-2 md:mt-4">🗑️</button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
    document.getElementById('tplTotalWeight').textContent = `Total: ${totalWeight}${editingTemplate.scoringType === 'percentage' ? '%' : ' pts'}`;
}

window.addCriterion = function() { window.updateTemplatePreview(); editingTemplate.criteria.push({ name: "", weight: 10, description: "" }); renderTemplateEditor(); }
window.removeCriterion = function(index) { window.updateTemplatePreview(); editingTemplate.criteria.splice(index, 1); renderTemplateEditor(); }

window.saveRubrics = function() {
    window.updateTemplatePreview();
    const tIndex = templates.findIndex(t => t.id === editingTemplate.id);
    if (tIndex >= 0) templates[tIndex] = editingTemplate; else templates.push(editingTemplate);
    activeTemplateId = editingTemplate.id;
    
    localStorage.setItem('repoReview_grading_templates', JSON.stringify(templates));
    localStorage.setItem('repoReview_active_template_id', activeTemplateId);
    alert("Rubric Template Saved Successfully.");
}