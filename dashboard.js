import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let db = null;

document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
});

function initFirebase() {
    const configStr = localStorage.getItem('repoReview_firebase_config');
    if (!configStr) {
        document.getElementById('statTotalStudents').textContent = "0";
        document.getElementById('statTotalGrades').textContent = "0";
        document.getElementById('statTotalPublished').textContent = "0";
        document.getElementById('recentGradesBody').innerHTML = `<tr><td colspan="4" class="py-8 text-center text-red-500 font-bold">Firebase not connected. Go to the Admin Hub to link your database.</td></tr>`;
        return;
    }

    try {
        const firebaseConfig = JSON.parse(configStr);
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        fetchAnalytics();
    } catch (e) {
        console.error("Firebase Initialization Failed:", e);
        document.getElementById('recentGradesBody').innerHTML = `<tr><td colspan="4" class="py-8 text-center text-red-500 font-bold">Firebase Initialization Failed. Check the Admin Hub.</td></tr>`;
    }
}

async function fetchAnalytics() {
    if (!db) return;

    try {
        // Fetch Total Students
        const studentsSnap = await getDocs(collection(db, "students"));
        document.getElementById('statTotalStudents').textContent = studentsSnap.size;

        // Fetch Grades Count
        const gradesSnap = await getDocs(collection(db, "grades"));
        let totalGrades = gradesSnap.size;
        let publishedCount = 0;
        let recentGradesHtml = '';

        if (gradesSnap.empty) {
            recentGradesHtml = `<tr><td colspan="4" class="py-8 text-center text-gray-400 italic">Database connected successfully. No grades logged yet. Head to the AutoGrader to start checking.</td></tr>`;
            document.getElementById('statTotalGrades').textContent = "0";
            document.getElementById('statTotalPublished').textContent = "0";
        } else {
            const grades = [];
            gradesSnap.forEach(doc => {
                const data = doc.data();
                if (data.publishedToGithub) publishedCount++;
                grades.push(data);
            });

            document.getElementById('statTotalGrades').textContent = totalGrades;
            document.getElementById('statTotalPublished').textContent = publishedCount;

            // Display a few recent records
            const displayGrades = grades.slice(0, 5); 
            displayGrades.forEach(g => {
                const statusBadge = g.publishedToGithub 
                    ? `<span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold shadow-sm">Published to GitHub</span>` 
                    : `<span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold shadow-sm">Logged (Unpublished)</span>`;

                recentGradesHtml += `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="py-3 px-6"><div class="font-bold text-gray-800">${g.githubUsername || 'Unknown'}</div><div class="text-xs text-gray-500">${g.section || 'N/A'}</div></td>
                        <td class="py-3 px-6 text-gray-600">Year ${g.year}, M${g.month}, W${g.week}</td>
                        <td class="py-3 px-6 font-bold text-purple-600">${g.score}/${g.maxScore}</td>
                        <td class="py-3 px-6">${statusBadge}</td>
                    </tr>
                `;
            });
        }
        
        document.getElementById('recentGradesBody').innerHTML = recentGradesHtml;

    } catch (error) {
        console.error("Error fetching analytics:", error);
        document.getElementById('recentGradesBody').innerHTML = `<tr><td colspan="4" class="py-8 text-center text-red-500">Error fetching data. Ensure your Firestore security rules allow reading.</td></tr>`;
    }
}