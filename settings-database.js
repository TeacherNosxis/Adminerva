import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

window.db = null;
window.allStudents = [];
window.allSections = [];

window.initFirebase = function() {
    const configStr = localStorage.getItem('repoReview_firebase_config');
    if (!configStr) return;
    try {
        const app = initializeApp(JSON.parse(configStr));
        window.db = getFirestore(app);
        loadSectionsAndStudents();
    } catch (e) {
        console.error("Firebase Init Failed:", e);
    }
};

async function loadSectionsAndStudents() {
    window.showLoader("Loading Database...");
    if (!window.db) return window.hideLoader();
    try {
        const [secSnap, stuSnap] = await Promise.all([
            getDocs(collection(window.db, "sections")),
            getDocs(collection(window.db, "students"))
        ]);
        
        window.allSections = [];
        secSnap.forEach(d => window.allSections.push({ id: d.id, ...d.data() }));
        
        window.allStudents = [];
        stuSnap.forEach(d => window.allStudents.push({ id: d.id, ...d.data() }));

        populateSectionDropdowns();
        window.filterStudentsTable();
    } catch (e) {
        console.error("Load failed:", e);
    } finally {
        window.hideLoader();
    }
}

function populateSectionDropdowns() {
    const filterSelect = document.getElementById('sectionFilterSelect');
    if (filterSelect) {
        filterSelect.innerHTML = `<option value="ALL">All Sections</option>`;
        window.allSections.forEach(sec => {
            filterSelect.insertAdjacentHTML('beforeend', `<option value="${sec.name}">${sec.name}</option>`);
        });
    }
    window.renderSectionsManagerTable();
}

window.renderSectionsManagerTable = function() {
    const tbody = document.getElementById('sectionsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    window.allSections.forEach(sec => {
        tbody.insertAdjacentHTML('beforeend', `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-2 font-medium">${sec.name}</td>
                <td class="p-2 text-center"><button onclick="deleteSectionDoc('${sec.id}', '${sec.name}')" class="text-red-500 font-bold text-xs">🗑️</button></td>
            </tr>
        `);
    });
};

window.filterStudentsTable = function() {
    const filter = document.getElementById('sectionFilterSelect')?.value || "ALL";
    const tbody = document.getElementById('studentTableBody');
    if (!tbody) return;
    
    const filtered = filter === "ALL" ? window.allStudents : window.allStudents.filter(s => s.section === filter);
    tbody.innerHTML = '';
    
    if (filtered.length === 0) return tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-400">No students found.</td></tr>`;
    
    filtered.forEach(data => {
        tbody.insertAdjacentHTML('beforeend', `
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
        `);
    });
};

window.openAddStudentModal = function() {
    document.getElementById('modalStudentDocId').value = "";
    document.getElementById('modalStudentName').value = "";
    document.getElementById('modalStudentEmail').value = "";
    document.getElementById('modalStudentGithub').value = "";
    document.getElementById('modalStudentRepo').value = "";
    document.getElementById('studentModal').classList.replace('hidden', 'flex');
};

window.editStudent = function(id) {
    const s = window.allStudents.find(x => x.id === id);
    if (!s) return;
    document.getElementById('modalStudentDocId').value = s.id;
    document.getElementById('modalStudentName').value = s.name;
    document.getElementById('modalStudentEmail').value = s.email;
    document.getElementById('modalStudentGithub').value = s.githubUsername;
    document.getElementById('modalStudentRepo').value = s.repoUrl;
    document.getElementById('studentModal').classList.replace('hidden', 'flex');
};

window.saveStudentForm = async function(e) {
    e.preventDefault();
    if (!window.db) return alert("Firebase disconnected.");
    
    const id = document.getElementById('modalStudentDocId').value;
    const data = {
        name: document.getElementById('modalStudentName').value,
        email: document.getElementById('modalStudentEmail').value,
        section: document.getElementById('modalStudentSection')?.value || "Default",
        githubUsername: document.getElementById('modalStudentGithub').value,
        repoUrl: document.getElementById('modalStudentRepo').value
    };

    window.showLoader();
    try {
        if (id) {
            await updateDoc(doc(window.db, "students", id), data);
        } else {
            await addDoc(collection(window.db, "students"), data);
        }
        await loadSectionsAndStudents();
        window.closeStudentModal();
    } catch (err) {
        alert("Save failed: " + err.message);
    } finally {
        window.hideLoader();
    }
};

window.deleteSectionDoc = async function(id, name) {
    if (confirm(`Delete section '${name}'?`)) {
        await deleteDoc(doc(window.db, "sections", id));
        loadSectionsAndStudents();
    }
};

window.deleteStudent = async function(id) {
    if (confirm("Remove student?")) {
        await deleteDoc(doc(window.db, "students", id));
        loadSectionsAndStudents();
    }
};