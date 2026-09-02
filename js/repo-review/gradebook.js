import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let db = null;
let currentStudents = [];
let gradeMatrix = {}; // Maps studentId -> { 1: score, 2: score, 3: score, 4: score, avg: value }

window.showLoader = function() { document.getElementById('globalLoader').classList.replace('hidden', 'flex'); };
window.hideLoader = function() { document.getElementById('globalLoader').classList.replace('flex', 'hidden'); };

document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    initDateSelects();
});

function initFirebase() {
    const configStr = localStorage.getItem('repoReview_firebase_config');
    if (!configStr) {
        document.getElementById('gradebookTableBody').innerHTML = `<tr><td colspan="6" class="py-8 text-center text-red-500 font-bold">Firebase not configured. Please visit the Admin Hub.</td></tr>`;
        return;
    }
    db = getFirestore(initializeApp(JSON.parse(configStr)));
    loadSections();
}

function initDateSelects() {
    const currentYear = new Date().getFullYear();
    const yearSelect = document.getElementById('yearSelect');
    for (let i = currentYear - 2; i <= currentYear + 1; i++) {
        yearSelect.insertAdjacentHTML('beforeend', `<option value="${i}" ${i === currentYear ? 'selected' : ''}>${i}</option>`);
    }
    document.getElementById('monthSelect').value = new Date().getMonth();
}

async function loadSections() {
    if (!db) return;
    try {
        const snap = await getDocs(collection(db, "sections"));
        const select = document.getElementById('sectionSelect');
        select.innerHTML = '';
        snap.forEach(d => {
            select.insertAdjacentHTML('beforeend', `<option value="${d.data().name}">${d.data().name}</option>`);
        });
    } catch (e) {
        console.error("Failed to load sections", e);
    }
}

window.fetchGradebook = async function() {
    const section = document.getElementById('sectionSelect').value;
    const year = parseInt(document.getElementById('yearSelect').value);
    const month = parseInt(document.getElementById('monthSelect').value);

    if (!section) return alert("Please select a section.");

    window.showLoader();

    try {
        // 1. Fetch Students
        const qStudents = query(collection(db, "students"), where("section", "==", section));
        const stuSnap = await getDocs(qStudents);
        currentStudents = [];
        stuSnap.forEach(d => currentStudents.push({ id: d.id, ...d.data() }));

        if (currentStudents.length === 0) {
            document.getElementById('gradebookTableBody').innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-500">No students found in this section.</td></tr>`;
            document.getElementById('exportCsvBtn').classList.add('hidden');
            return window.hideLoader();
        }

        // 2. Fetch Grades (Filtering manually by year/month to avoid complex index requirements)
        const qGrades = query(collection(db, "grades"), where("section", "==", section));
        const gradeSnap = await getDocs(qGrades);
        
        gradeMatrix = {};
        currentStudents.forEach(s => gradeMatrix[s.id] = { 1: null, 2: null, 3: null, 4: null, maxScore: 0 });

        gradeSnap.forEach(d => {
            const g = d.data();
            // Only process grades for the selected year and month
            if (g.year === year && g.month === month && gradeMatrix[g.studentId]) {
                gradeMatrix[g.studentId][g.week] = g.score;
                gradeMatrix[g.studentId].maxScore = g.maxScore; // Store max score for reference
            }
        });

        renderGradebookTable();
        document.getElementById('exportCsvBtn').classList.remove('hidden');

    } catch (e) {
        alert("Error loading matrix: " + e.message);
    } finally {
        window.hideLoader();
    }
};

function renderGradebookTable() {
    const tbody = document.getElementById('gradebookTableBody');
    tbody.innerHTML = '';

    currentStudents.forEach(student => {
        const scores = gradeMatrix[student.id];
        let totalScore = 0;
        let weeksGraded = 0;

        let weekCells = "";
        for (let w = 1; w <= 4; w++) {
            const score = scores[w];
            if (score !== null) {
                totalScore += score;
                weeksGraded++;
                weekCells += `<td class="py-3 px-2 text-center font-bold text-gray-800">${score}</td>`;
            } else {
                weekCells += `<td class="py-3 px-2 text-center text-gray-400 font-medium">-</td>`;
            }
        }

        const average = weeksGraded > 0 ? (totalScore / weeksGraded).toFixed(1) : "-";

        const tr = `
            <tr class="border-b hover:bg-gray-50 transition">
                <td class="py-3 px-4 align-middle">
                    <div class="font-bold text-gray-800">${student.name}</div>
                    <div class="text-[10px] text-gray-500">${student.githubUsername}</div>
                </td>
                ${weekCells}
                <td class="py-3 px-4 text-center font-extrabold text-purple-700 bg-gray-50 border-l border-gray-200 text-lg">
                    ${average}
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', tr);
    });
}

// ==========================================
// CSV EXPORT LOGIC
// ==========================================
window.exportToCsv = function() {
    if (currentStudents.length === 0) return alert("No data to export.");

    const section = document.getElementById('sectionSelect').value;
    const year = document.getElementById('yearSelect').value;
    const month = document.getElementById('monthSelect').options[document.getElementById('monthSelect').selectedIndex].text;

    let csvContent = "Student Name,GitHub Username,Week 1,Week 2,Week 3,Week 4,Sprint Average\n";

    currentStudents.forEach(student => {
        const scores = gradeMatrix[student.id];
        let totalScore = 0;
        let weeksGraded = 0;

        let row = `"${student.name}","${student.githubUsername}",`;

        for (let w = 1; w <= 4; w++) {
            if (scores[w] !== null) {
                row += `${scores[w]},`;
                totalScore += scores[w];
                weeksGraded++;
            } else {
                row += `,`; // Blank cell if no grade
            }
        }

        const average = weeksGraded > 0 ? (totalScore / weeksGraded).toFixed(1) : "";
        row += `${average}\n`;
        csvContent += row;
    });

    // Create a Blob and trigger a download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `RepoReview_Grades_${section}_${month}_${year}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};