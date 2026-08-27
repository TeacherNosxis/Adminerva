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
            container.innerHTML = `
                <div class="text-center py-12">
                    <span class="text-4xl block mb-3">🗂️</span>
                    <p class="text-gray-500 font-bold">No saved plans found.</p>
                    <p class="text-xs text-gray-400 mt-1">Generate and save your first lesson plan to see it here.</p>
                </div>
            `;
            return;
        }

        const allPlans = [];
        querySnapshot.forEach(docSnap => allPlans.push({ id: docSnap.id, ...docSnap.data() }));

        // Sort chronologically
        allPlans.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

        const quarters = { "1": [], "2": [], "3": [], "4": [] };
        allPlans.forEach(plan => {
            let qtrNum = "1";
            // Check new academic_term key first, fallback to old quarter key
            if (plan.academic_term && plan.academic_term.includes("SECOND QUARTER")) qtrNum = "2";
            else if (plan.academic_term && plan.academic_term.includes("THIRD QUARTER")) qtrNum = "3";
            else if (plan.academic_term && plan.academic_term.includes("FOURTH QUARTER")) qtrNum = "4";
            else if (plan.quarter && /2|second/i.test(plan.quarter)) qtrNum = "2";
            else if (plan.quarter && /3|third/i.test(plan.quarter)) qtrNum = "3";
            else if (plan.quarter && /4|fourth/i.test(plan.quarter)) qtrNum = "4";
            
            quarters[qtrNum].push(plan);
        });

        // Render UI
        Object.keys(quarters).sort().forEach(q => {
            if (quarters[q].length > 0) {
                container.insertAdjacentHTML('beforeend', `
                    <div class="mt-8 mb-4 flex items-center gap-3">
                        <h3 class="text-sm font-extrabold text-blue-900 uppercase tracking-widest bg-blue-100 px-3 py-1 rounded-md">Quarter ${q}</h3>
                        <div class="h-px bg-gray-200 flex-grow"></div>
                    </div>
                `);

                const gridContainer = document.createElement('div');
                gridContainer.className = "grid grid-cols-1 md:grid-cols-2 gap-4";
                container.appendChild(gridContainer);

                quarters[q].forEach((data) => {
                    const dateStr = data.timestamp ? new Date(data.timestamp).toLocaleString() : "Unknown";
                    
                    // Extract exact numbers for the badges
                    let semNum = "1";
                    if (data.academic_term && data.academic_term.includes("SECOND SEMESTER")) semNum = "2";
                    else if (data.semester && /2|second/i.test(data.semester)) semNum = "2";
                    
                    let weekNum = "1";
                    if (data.course_week) weekNum = data.course_week.replace(/\D/g, "") || "1";
                    else if (data.absoluteWeek) weekNum = data.absoluteWeek;

                    const card = document.createElement('div');
                    card.className = "group relative p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-400 transition-all duration-200 flex flex-col justify-between";
                    card.innerHTML = `
                        <div>
                            <div class="flex justify-between items-start mb-3">
                                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                    Course Week ${weekNum}
                                </span>
                                <span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                    Sem ${semNum}
                                </span>
                            </div>
                            
                            <h4 class="font-extrabold text-gray-900 text-base mb-1 leading-tight line-clamp-1" title="${data.subject_title || 'Subject'}">
                                ${data.subject_title || 'Subject'}
                            </h4>
                            
                            <!-- 🚀 THE FIX: DIRECTLY RENDERING THE DATE RANGE STRING -->
                            <p class="text-[11px] text-gray-500 mb-4 font-bold flex items-center gap-1">
                                🗓️ ${data.date_range || 'No physical dates provided'}
                            </p>
                        </div>
                        
                        <div class="pt-4 border-t border-gray-100 flex justify-between items-center">
                            <span class="text-[9px] text-gray-400 font-medium">💾 ${dateStr.split(',')[0]}</span>
                            <div class="flex gap-2">
                                <button onclick='loadSpecificPlan(${JSON.stringify(data).replace(/'/g, "&#39;")})' class="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 shadow-sm transition">
                                    Load
                                </button>
                                <button onclick="deleteLessonPlan('${data.id}')" class="flex items-center justify-center w-8 h-8 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 hover:text-red-700 transition" title="Delete Plan">
                                    ✖
                                </button>
                            </div>
                        </div>
                    `;
                    gridContainer.appendChild(card);
                });
            }
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