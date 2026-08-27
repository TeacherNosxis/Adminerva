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
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12">
            <svg class="animate-spin h-8 w-8 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p class="text-gray-500 font-medium animate-pulse">Fetching curriculum cloud data...</p>
        </div>
    `;

    if (!window.db) {
        container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded-lg text-center font-bold border border-red-200">Firebase is not connected!</div>`;
        return;
    }

    try {
        const querySnapshot = await getDocs(collection(window.db, "lesson_plans"));
        container.innerHTML = '';
        
        if (querySnapshot.empty) {
            container.innerHTML = `<div class="text-center py-12"><p class="text-gray-500 font-bold">No saved plans found.</p></div>`;
            return;
        }

        const allPlans = [];
        const conflictTracker = {};

        // 1. NORMALIZE & SCAN FOR OVERLAPS
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            
            // Normalize Legacy Data to New Format safely
            const safeSY = data.school_year || "2026-2027";
            const safeSubject = data.subject_title || "Unknown Subject";
            
            let safeTerm = data.academic_term || "";
            if (!safeTerm) {
                // If it's an old file, stitch the old quarter/semester together
                const sem = /2|second/i.test(data.semester || "") ? "SECOND SEMESTER" : "FIRST SEMESTER";
                let qtr = "FIRST QUARTER";
                if(/2|second/i.test(data.quarter || "")) qtr = "SECOND QUARTER";
                if(/3|third/i.test(data.quarter || "")) qtr = "THIRD QUARTER";
                if(/4|fourth/i.test(data.quarter || "")) qtr = "FOURTH QUARTER";
                safeTerm = `${sem}/${qtr}`;
            }

            let safeWeek = data.course_week || "";
            if (!safeWeek) {
                // If it's an old file, convert the absoluteWeek to the new Course Week format
                safeWeek = `Week ${data.absoluteWeek || 1}`;
            }

            // Apply patched data back to object
            data.safeSY = safeSY;
            data.safeTerm = safeTerm;
            data.safeSubject = safeSubject;
            data.safeWeek = safeWeek;
            data.safeDate = data.date_range || "No physical dates";

            const plan = { id: docSnap.id, ...data };
            allPlans.push(plan);

            // Build Conflict Key (e.g., "2026-2027_FIRST SEMESTER/FIRST QUARTER_Computer Programming 11_Week 1")
            const conflictKey = `${safeSY}_${safeTerm}_${safeSubject}_${safeWeek}`;
            if (!conflictTracker[conflictKey]) conflictTracker[conflictKey] = 0;
            conflictTracker[conflictKey]++;
            plan.conflictKey = conflictKey;
        });

        // Sort by timestamp (newest first)
        allPlans.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

        // Group purely by Academic Term for the GDrive folder look
        const termGroups = {};
        allPlans.forEach(plan => {
            if (!termGroups[plan.safeTerm]) termGroups[plan.safeTerm] = [];
            termGroups[plan.safeTerm].push(plan);
        });

        // 2. RENDER GOOGLE DRIVE STYLE UI
        Object.keys(termGroups).sort().forEach(term => {
            // Term Folder Header
            container.insertAdjacentHTML('beforeend', `
                <div class="mt-6 mb-2">
                    <h3 class="text-sm font-extrabold text-blue-900 bg-blue-50 px-3 py-2 rounded-t-lg border-b-2 border-blue-200 flex items-center gap-2">
                        📁 ${term}
                    </h3>
                </div>
            `);

            // Start Table
            const tableWrapper = document.createElement('div');
            tableWrapper.className = "overflow-x-auto border border-gray-200 rounded-b-lg mb-6 shadow-sm";
            
            let tableHTML = `
                <table class="w-full text-left text-sm whitespace-nowrap">
                    <thead class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <tr>
                            <th class="px-4 py-3 font-bold">Course Week</th>
                            <th class="px-4 py-3 font-bold">Subject</th>
                            <th class="px-4 py-3 font-bold">Physical Dates</th>
                            <th class="px-4 py-3 font-bold text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white">
            `;

            termGroups[term].forEach((data) => {
                // Check if this plan shares a slot with another plan
                const isConflict = conflictTracker[data.conflictKey] > 1;
                
                // Style warnings for overlaps
                const rowClass = isConflict ? "bg-amber-50 hover:bg-amber-100 transition" : "hover:bg-gray-50 transition";
                const warningIcon = isConflict ? `<span title="Duplicate/Overlap Warning" class="text-amber-600 mr-1">⚠️</span>` : ``;

                tableHTML += `
                    <tr class="${rowClass}">
                        <td class="px-4 py-3 font-bold ${isConflict ? 'text-amber-800' : 'text-blue-900'}">
                            ${warningIcon} ${data.safeWeek}
                            <div class="text-[9px] text-gray-400 font-normal mt-0.5">${data.safeSY}</div>
                        </td>
                        <td class="px-4 py-3 font-bold text-gray-700 truncate max-w-[200px]" title="${data.safeSubject}">
                            ${data.safeSubject}
                        </td>
                        <td class="px-4 py-3 text-xs text-gray-600 font-medium">
                            🗓️ ${data.safeDate}
                        </td>
                        <td class="px-4 py-3 text-center">
                            <div class="flex justify-center gap-2">
                                <button onclick='loadSpecificPlan(${JSON.stringify(data).replace(/'/g, "&#39;")})' class="px-3 py-1.5 bg-blue-600 text-white font-bold text-[10px] rounded hover:bg-blue-700 shadow-sm transition">
                                    Load
                                </button>
                                <button onclick="deleteLessonPlan('${data.id}')" class="px-2 py-1.5 bg-red-50 text-red-600 font-bold text-[10px] rounded hover:bg-red-100 transition" title="Delete">
                                    ✖
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            tableHTML += `</tbody></table>`;
            tableWrapper.innerHTML = tableHTML;
            container.appendChild(tableWrapper);
        });

    } catch (e) {
        container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">Error: ${e.message}</div>`;
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