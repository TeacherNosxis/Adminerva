import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let db = null;
let velocityChartInstance = null;

window.showLoader = function(msg) { 
    if(msg) document.getElementById('loaderMessage').textContent = msg;
    document.getElementById('globalLoader').classList.replace('hidden', 'flex'); 
};
window.hideLoader = function() { document.getElementById('globalLoader').classList.replace('flex', 'hidden'); };

document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
});

function initFirebase() {
    const configStr = localStorage.getItem('repoReview_firebase_config');
    if (!configStr) return alert("Firebase not configured. Please visit the Admin Hub.");
    
    db = getFirestore(initializeApp(JSON.parse(configStr)));
    loadSections();
}

async function loadSections() {
    try {
        const snap = await getDocs(collection(db, "sections"));
        const select = document.getElementById('sectionSelect');
        select.innerHTML = '';
        let count = 0;
        snap.forEach(d => {
            select.insertAdjacentHTML('beforeend', `<option value="${d.data().name}">${d.data().name}</option>`);
            count++;
        });
        if(count > 0) window.loadDashboardData();
    } catch (e) {
        console.error("Failed to load sections", e);
    }
}

window.loadDashboardData = async function() {
    const section = document.getElementById('sectionSelect').value;
    if (!section) return;

    window.showLoader("Analyzing Database...");

    try {
        // 1. Fetch Students
        const qStudents = query(collection(db, "students"), where("section", "==", section));
        const stuSnap = await getDocs(qStudents);
        const students = [];
        stuSnap.forEach(d => students.push(d.data()));
        document.getElementById('statStudents').textContent = students.length;

        // 2. Fetch Grades & Calculate Insights
        const qGrades = query(collection(db, "grades"), where("section", "==", section));
        const gradeSnap = await getDocs(qGrades);
        
        let processedCount = 0;
        let publishedCount = 0;
        let criteriaStats = {};

        gradeSnap.forEach(d => {
            const g = d.data();
            processedCount++;
            if (g.publishedToGithub) publishedCount++;

            // Aggregate Rubric Performance
            if (g.rawAiData && g.rawAiData.breakdown) {
                g.rawAiData.breakdown.forEach(b => {
                    if (!criteriaStats[b.criterion]) {
                        criteriaStats[b.criterion] = { totalScore: 0, totalMax: 0, count: 0 };
                    }
                    criteriaStats[b.criterion].totalScore += b.score;
                    criteriaStats[b.criterion].totalMax += b.max;
                    criteriaStats[b.criterion].count++;
                });
            }
        });

        document.getElementById('statGrades').textContent = processedCount;
        document.getElementById('statComments').textContent = publishedCount;

        renderCriteriaInsights(criteriaStats);

        // 3. Fetch GitHub Velocity Data
        if (students.length > 0) {
            window.showLoader("Fetching 30-Day Commit Velocity from GitHub...");
            await renderVelocityChart(students);
        } else {
            renderEmptyChart();
        }

    } catch (e) {
        alert("Dashboard Error: " + e.message);
    } finally {
        window.hideLoader();
    }
};

function renderCriteriaInsights(stats) {
    const list = document.getElementById('criteriaList');
    list.innerHTML = '';

    const sortedCriteria = Object.keys(stats).map(key => {
        const s = stats[key];
        return {
            name: key,
            averagePercentage: (s.totalScore / s.totalMax) * 100
        };
    }).sort((a, b) => a.averagePercentage - b.averagePercentage); // Sort Lowest to Highest

    if (sortedCriteria.length === 0) {
        list.innerHTML = '<div class="text-center text-sm text-gray-400 italic mt-8">No graded criteria found yet.</div>';
        return;
    }

    sortedCriteria.forEach((crit, index) => {
        // Red for bottom performer, Yellow for mid, Green for high
        let colorClass = "bg-green-100 text-green-700";
        if (index === 0) colorClass = "bg-red-100 text-red-700";
        else if (crit.averagePercentage < 75) colorClass = "bg-amber-100 text-amber-700";

        list.insertAdjacentHTML('beforeend', `
            <div class="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200">
                <span class="text-sm font-bold text-gray-700 truncate w-2/3" title="${crit.name}">${crit.name}</span>
                <span class="text-xs font-bold px-2 py-1 rounded ${colorClass}">${crit.averagePercentage.toFixed(1)}%</span>
            </div>
        `);
    });
}

async function renderVelocityChart(students) {
    const ghToken = localStorage.getItem('repoReview_github_token');
    if (!ghToken) return renderEmptyChart();

    // Generate last 30 days array formatted as YYYY-MM-DD
    const dates = [];
    const dateCounts = {};
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dates.push(dateStr);
        dateCounts[dateStr] = 0;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sinceIso = thirtyDaysAgo.toISOString();

    // Fetch commits for all students in the section
    for (const student of students) {
        if (!student.repoUrl) continue;
        try {
            let owner, repo;
            const urlParts = student.repoUrl.replace(/\/$/, '').replace('.git', '').split('/');
            repo = urlParts.pop(); owner = urlParts.pop();

            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?since=${sinceIso}`, {
                headers: { 'Authorization': `Bearer ${ghToken}`, 'Accept': 'application/vnd.github+json' }
            });

            if (res.ok) {
                const commits = await res.json();
                commits.forEach(c => {
                    const commitDateStr = c.commit.author.date.split('T')[0];
                    if (dateCounts[commitDateStr] !== undefined) {
                        dateCounts[commitDateStr]++;
                    }
                });
            }
        } catch (e) {
            console.error(`Failed to fetch for ${student.name}`);
        }
    }

    const dataPoints = dates.map(d => dateCounts[d]);
    drawChart(dates, dataPoints);
}

function drawChart(labels, data) {
    const ctx = document.getElementById('velocityChart').getContext('2d');
    
    if (velocityChartInstance) {
        velocityChartInstance.destroy();
    }

    velocityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Section Commits',
                data: data,
                borderColor: '#8b5cf6', // Purple-500
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#8b5cf6',
                pointRadius: 4,
                fill: true,
                tension: 0.3 // Smooth curves
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: {
                    ticks: {
                        maxTicksLimit: 10,
                        callback: function(val, index) {
                            // Show month/day format
                            const dateStr = this.getLabelForValue(val);
                            return dateStr.substring(5); 
                        }
                    }
                }
            }
        }
    });
}

function renderEmptyChart() {
    drawChart(['No Data'], [0]);
}