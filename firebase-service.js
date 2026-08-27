import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

window.initFirebase = function() {
    const configStr = localStorage.getItem('repoReview_firebase_config');
    if (!configStr) return;
    try {
        const firebaseConfig = JSON.parse(configStr);
        const app = initializeApp(firebaseConfig);
        window.db = getFirestore(app);
        window.loadLibraryFolders(); 
    } catch (e) {
        console.error("Firebase Initialization Failed:", e);
    }
};

window.loadLibraryFolders = async function() {
    const container = document.getElementById('libraryFolderContainer');
    if(!container) return;

    if (!window.db) {
        container.innerHTML = '<div class="text-xs text-red-500 italic">Firebase not ready.</div>';
        return;
    }

    container.innerHTML = '<div class="text-xs text-gray-500 italic">Fetching folders from cloud...</div>';

    try {
        const snap = await getDocs(collection(window.db, "reference_folders"));
        const libraryData = [];
        snap.forEach(d => libraryData.push({ id: d.id, ...d.data() }));

        localStorage.setItem('lessonReview_library', JSON.stringify(libraryData)); 

        container.innerHTML = '';
        if (libraryData.length === 0) {
            container.innerHTML = '<div class="text-xs text-gray-500 italic">No folders found in Firebase.</div>';
            return;
        }

        libraryData.forEach(folder => {
            const docCount = folder.documents ? folder.documents.length : 0;
            container.insertAdjacentHTML('beforeend', `
                <label class="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" value="${folder.id}" class="folder-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 bg-white">
                    <span class="text-sm font-bold text-blue-900 group-hover:text-blue-700 transition">📁 ${folder.name} <span class="text-[10px] text-gray-500 font-normal">(${docCount} docs)</span></span>
                </label>
            `);
        });
    } catch (e) {
        container.innerHTML = `<div class="text-xs text-red-500 italic">Failed to load library: ${e.message}</div>`;
    }
};

window.fetchPreviousPlan = async function(grade, subject, currentMonth, currentWeek) {
    if(!window.db) return null;
    const months = ["August", "September", "October", "November", "December", "January", "February", "March", "April", "May"];
    let mIdx = months.indexOf(currentMonth);
    let prevMonth = currentMonth;
    let prevWeek = "";

    if (currentWeek === "Week 1") {
        if (mIdx <= 0) return null; 
        prevMonth = months[mIdx - 1];
    } else {
        let wNum = parseInt(currentWeek.replace("Week ", ""));
        prevWeek = `Week ${wNum - 1}`;
    }

    const tryFetch = async (m, w) => {
        const id = `${grade}_${subject}_${m}_${w}`.replace(/[^a-zA-Z0-9_]/g, "");
        const docRef = doc(window.db, "lesson_plans", id);
        try {
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? docSnap.data() : null;
        } catch(e) { return null; }
    };

    if (currentWeek === "Week 1" && mIdx > 0) {
        let plan = await tryFetch(prevMonth, "Week 5");
        if (!plan) plan = await tryFetch(prevMonth, "Week 4");
        return plan;
    } else {
        return await tryFetch(prevMonth, prevWeek);
    }
};

window.saveLessonPlan = async function() {
    if (!window.currentPlan || window.currentPlan.length === 0 || !window.currentWeeklyOverview) {
        alert("Please generate a lesson plan first before saving.");
        return false; 
    }
    if (!window.db) {
        alert("Firebase is not connected! Please configure it in Global Settings.");
        return false; 
    }

    const subject = document.getElementById('lpSubjectTitle').value || "Subject";
    const grade = window.currentTargetGrade || "Grade";
    const month = document.getElementById('lpMonth').value;
    const week = document.getElementById('lpWeek').value;
    const quarter = document.getElementById('lpQuarter').value;
    const dateRangeEl = document.getElementById('lpDateRange');

    const safeDocId = `${grade}_${subject}_${month}_${week}`.replace(/[^a-zA-Z0-9_]/g, "");

    const loaderText = document.querySelector('#globalLoader p');
    const originalText = loaderText ? loaderText.textContent : "Processing...";
    if(loaderText) loaderText.textContent = "Anchoring Week Sequence...";
    window.showLoader();

    try {
        const docRef = doc(window.db, "lesson_plans", safeDocId);
        const docSnap = await getDoc(docRef);
        let anchoredWeek = 1;

        if (docSnap.exists() && docSnap.data().absoluteWeek) {
            anchoredWeek = docSnap.data().absoluteWeek;
        } else {
            const qSnap = await getDocs(collection(window.db, "lesson_plans"));
            let usedWeeks = [];
            qSnap.forEach(d => {
                const data = d.data();
                if (data.subject_title === subject && data.grade_level === grade && data.quarter === quarter) {
                    if (data.absoluteWeek) usedWeeks.push(data.absoluteWeek);
                }
            });
            while (usedWeeks.includes(anchoredWeek)) {
                anchoredWeek++;
            }
        }

        const planData = {
            teacher_name: document.getElementById('lpTeacherName').value || "Unassigned",
            subject_title: subject,
            school_year: document.getElementById('lpSchoolYear').value,
            semester: document.getElementById('lpSemester').value,
            quarter: quarter,
            month: month,
            week: week,
            absoluteWeek: anchoredWeek, 
            date_range: dateRangeEl ? dateRangeEl.value : "",
            grade_level: grade,
            custom_instructions: document.getElementById('lpCustomInstructions').value.trim(),
            schedule: localStorage.getItem('lessonReview_schedule') || "",
            reference_folders: Array.from(document.querySelectorAll('.folder-checkbox:checked')).map(cb => cb.value),
            weekly_overview: window.currentWeeklyOverview,
            sessions: window.currentPlan,
            timestamp: new Date().toISOString()
        };

        await setDoc(docRef, planData);
        window.currentAnchoredWeek = anchoredWeek; 
        alert(`✅ Lesson Plan saved and anchored as Week ${anchoredWeek}!`);
        return true; 
    } catch (e) {
        console.error("Error saving plan:", e);
        alert("Failed to save to database: " + e.message);
        return false; 
    } finally {
        if(loaderText) loaderText.textContent = originalText;
        window.hideLoader();
    }
};

window.openLoadPlanModal = async function() {
    const modal = document.getElementById('loadPlanModal');
    if (!modal) return alert("Modal HTML is missing!");
    modal.classList.replace('hidden', 'flex');

    const container = document.getElementById('savedPlansListContainer');
    container.innerHTML = `<p class="text-gray-500 italic text-center py-8">Fetching saved plans from cloud...</p>`;

    if (!window.db) {
        container.innerHTML = `<p class="text-red-500 font-bold text-center py-8">Firebase is not connected!</p>`;
        return;
    }

    try {
        const querySnapshot = await getDocs(collection(window.db, "lesson_plans"));
        container.innerHTML = '';
        if (querySnapshot.empty) {
            container.innerHTML = `<p class="text-gray-400 italic text-center py-8">No saved plans found.</p>`;
            return;
        }

        const allPlans = [];
        querySnapshot.forEach(docSnap => allPlans.push({ id: docSnap.id, ...docSnap.data() }));

        allPlans.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

        const quarters = { "1": [], "2": [], "3": [], "4": [] };
        allPlans.forEach(plan => {
            let qtrNum = "1";
            if(/2|second/i.test(plan.quarter || "")) qtrNum = "2";
            if(/3|third/i.test(plan.quarter || "")) qtrNum = "3";
            if(/4|fourth/i.test(plan.quarter || "")) qtrNum = "4";
            quarters[qtrNum].push(plan);
        });

        Object.keys(quarters).sort().forEach(q => {
            if (quarters[q].length > 0) {
                container.insertAdjacentHTML('beforeend', `<h3 class="w-full text-xs font-extrabold text-gray-500 uppercase tracking-widest mt-6 mb-2 border-b-2 border-gray-200 pb-1">Quarter ${q}</h3>`);

                quarters[q].forEach((data) => {
                    const dateStr = data.timestamp ? new Date(data.timestamp).toLocaleString() : "Unknown";
                    const rawGrade = (data.grade_level || "11").replace(/\D/g, "");
                    const semNum = /2|second/i.test(data.semester || "") ? "2" : "1";
                    const shortSubject = (data.subject_title || "").split(/\s+/).map(w => w.match(/\d+/) ? w : w.substring(0, 4)).join('').replace(/[^a-zA-Z0-9]/g, "");

                    const anchoredWeek = data.absoluteWeek || 1; 
                    const displayTitle = `${rawGrade}-Sem${semNum},Qtr${q},W${anchoredWeek}(${shortSubject})`;

                    const card = document.createElement('div');
                    card.className = "p-4 border rounded-lg bg-gray-50 hover:bg-blue-50 transition flex justify-between items-center shadow-sm mb-2";
                    card.innerHTML = `
                        <div>
                            <h4 class="font-bold text-blue-900">${displayTitle}</h4>
                            <p class="text-xs text-gray-600 mt-1">Target: <strong>${data.month || ''} ${data.week || ''}</strong></p>
                            <p class="text-[10px] text-gray-400 mt-0.5">Saved on: ${dateStr}</p>
                        </div>
                        <div class="flex gap-2">
                            <button onclick='loadSpecificPlan(${JSON.stringify(data).replace(/'/g, "&#39;")})' class="px-3 py-2 bg-blue-600 text-white font-bold text-xs rounded hover:bg-blue-700 shadow transition">📂 Load</button>
                            <button onclick="deleteLessonPlan('${data.id}')" class="px-3 py-2 bg-red-100 text-red-600 font-bold text-xs rounded hover:bg-red-200 shadow transition" title="Delete Plan">🗑️</button>
                        </div>
                    `;
                    container.appendChild(card);
                });
            }
        });
    } catch (e) {
        container.innerHTML = `<p class="text-red-500">Error: ${e.message}</p>`;
    }
};

window.deleteLessonPlan = async function(docId) {
    if (!confirm("Are you sure you want to delete this saved lesson plan?")) return;
    window.showLoader();
    try {
        await deleteDoc(doc(window.db, "lesson_plans", docId));
        window.openLoadPlanModal(); 
    } catch (e) {
        alert("Failed to delete plan: " + e.message);
    } finally {
        window.hideLoader();
    }
};