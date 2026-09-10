import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

window.initFirebase = function () {
  const configStr = localStorage.getItem("Adminerva_firebase_config");
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

window.loadLibraryFolders = async function () {
  const container = document.getElementById("libraryFolderContainer");
  if (!container) return;

  if (!window.db) {
    container.innerHTML =
      '<div class="text-xs text-red-500 italic">Firebase not ready.</div>';
    return;
  }

  container.innerHTML =
    '<div class="text-xs text-gray-500 italic">Fetching folders from cloud...</div>';

  try {
    const snap = await getDocs(collection(window.db, "reference_folders"));
    const libraryData = [];
    snap.forEach((d) => libraryData.push({ id: d.id, ...d.data() }));

    localStorage.setItem("lessonReview_library", JSON.stringify(libraryData));

    container.innerHTML = "";
    if (libraryData.length === 0) {
      container.innerHTML =
        '<div class="text-xs text-gray-500 italic">No folders found in Firebase.</div>';
      return;
    }

    libraryData.forEach((folder) => {
      const docCount = folder.documents ? folder.documents.length : 0;
      container.insertAdjacentHTML(
        "beforeend",
        `
                <label class="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" value="${folder.id}" class="folder-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 bg-white">
                    <span class="text-sm font-bold text-blue-900 group-hover:text-blue-700 transition">📁 ${folder.name} <span class="text-[10px] text-gray-500 font-normal">(${docCount} docs)</span></span>
                </label>
            `,
      );
    });
  } catch (e) {
    container.innerHTML = `<div class="text-xs text-red-500 italic">Failed to load library: ${e.message}</div>`;
  }
};

// 🚀 LOOKS BACK USING THE NEW COURSE WEEK INSTEAD OF MONTH
window.fetchPreviousPlan = async function (
  grade,
  subject,
  academicTerm,
  currentCourseWeek,
) {
  if (!window.db) return null;

  const currentWeekNum = parseInt(currentCourseWeek.replace(/\D/g, ""));
  if (currentWeekNum <= 1) return null;

  const prevWeekStr = `Week ${currentWeekNum - 1}`;
  const qtrStr = academicTerm.includes("SECOND QUARTER")
    ? "Q2"
    : academicTerm.includes("THIRD QUARTER")
      ? "Q3"
      : academicTerm.includes("FOURTH QUARTER")
        ? "Q4"
        : "Q1";
  const id = `${grade}_${subject}_${qtrStr}_${prevWeekStr}`.replace(
    /[^a-zA-Z0-9_]/g,
    "",
  );

  try {
    const docSnap = await getDoc(doc(window.db, "lesson_plans", id));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (e) {
    return null;
  }
};

window.saveLessonPlan = async function () {
  if (
    !window.currentPlan ||
    window.currentPlan.length === 0 ||
    !window.currentWeeklyOverview
  ) {
    alert("Please generate a lesson plan first before saving.");
    return false;
  }
  if (!window.db) {
    alert("Firebase is not connected! Please configure it in Global Settings.");
    return false;
  }

  // 🚀 READS DATA FROM THE NEW 5-COLUMN UI AND GLOBAL SETTINGS
  const subject =
    localStorage.getItem("lessonReview_defaultSubject") || "Subject";
  const teacher =
    localStorage.getItem("lessonReview_defaultTeacher") || "Unassigned";
  const grade = window.currentTargetGrade || "Grade";

  const academicTerm = document.getElementById("lpAcademicTerm").value;
  const courseWeek = document.getElementById("lpCourseWeek").value;
  const dateRange = document.getElementById("lpDateRange").value;

  const qtrStr = academicTerm.includes("SECOND QUARTER")
    ? "Q2"
    : academicTerm.includes("THIRD QUARTER")
      ? "Q3"
      : academicTerm.includes("FOURTH QUARTER")
        ? "Q4"
        : "Q1";
  const safeDocId = `${grade}_${subject}_${qtrStr}_${courseWeek}`.replace(
    /[^a-zA-Z0-9_]/g,
    "",
  );

  window.showLoader(
    "Saving Lesson Plan...",
    "Syncing securely to Firebase storage.",
  );

  try {
    const planData = {
      teacher_name: teacher,
      subject_title: subject,
      school_year: document.getElementById("lpSchoolYear").value,
      academic_term: academicTerm,
      course_week: courseWeek,
      date_range: dateRange,
      grade_level: grade,
      custom_instructions: document
        .getElementById("lpCustomInstructions")
        .value.trim(),
      schedule: localStorage.getItem("lessonReview_schedule") || "",
      reference_folders: Array.from(
        document.querySelectorAll(".folder-checkbox:checked"),
      ).map((cb) => cb.value),
      weekly_overview: window.currentWeeklyOverview,
      sessions: window.currentPlan,
      timestamp: new Date().toISOString(),
    };

    await setDoc(doc(window.db, "lesson_plans", safeDocId), planData);
    alert(`✅ Lesson Plan saved successfully!`);
    return true;
  } catch (e) {
    console.error("Error saving plan:", e);
    alert("Failed to save to database: " + e.message);
    return false;
  } finally {
    window.hideLoader();
  }
};

window.openLoadPlanModal = async function () {
  const modal = document.getElementById("loadPlanModal");
  if (!modal) return alert("Modal HTML is missing!");
  modal.classList.replace("hidden", "flex");

  const container = document.getElementById("savedPlansListContainer");
  container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12">
            <div class="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-blue-500 mb-4"></div>
            <p class="text-gray-500 font-medium">Fetching organized curriculum...</p>
        </div>
    `;

  if (!window.db) {
    container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded-lg text-center font-bold">Firebase is not connected!</div>`;
    return;
  }

  try {
    const querySnapshot = await getDocs(collection(window.db, "lesson_plans"));
    if (querySnapshot.empty) {
      container.innerHTML = `<div class="text-center py-12"><p class="text-gray-500 font-bold">No saved plans found.</p></div>`;
      return;
    }

    const allFetchedPlans = [];
    const uniqueSYs = new Set();

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // 🚀 PHASE 2: Actively hide archived files from the UI
      if (data.is_archived) return;

      const sy = data.school_year || "2026-2027";
      uniqueSYs.add(sy);

      let safeTerm = data.academic_term || "";
      if (!safeTerm) {
        const sem = /2|second/i.test(data.semester || "")
          ? "SECOND SEMESTER"
          : "FIRST SEMESTER";
        let qtr = "FIRST QUARTER";
        if (/2|second/i.test(data.quarter || "")) qtr = "SECOND QUARTER";
        if (/3|third/i.test(data.quarter || "")) qtr = "THIRD QUARTER";
        if (/4|fourth/i.test(data.quarter || "")) qtr = "FOURTH QUARTER";
        safeTerm = `${sem}/${qtr}`;
      }

      let safeWeek = data.course_week || "";
      if (!safeWeek) safeWeek = `Week ${data.absoluteWeek || 1}`;

      allFetchedPlans.push({
        id: docSnap.id,
        ...data,
        safeSY: sy,
        safeTerm: safeTerm,
        safeWeek: safeWeek,
        safeDate: data.date_range || "No physical dates",
        subjectGrade: `${data.subject_title || "Subject"} — ${data.grade_level || "Grade"}`,
      });
    });

    const syFilter = document.getElementById("modalSyFilter");
    if (syFilter) {
      const mainUiSy =
        document.getElementById("lpSchoolYear")?.value || "2026-2027";
      const currentSelection = syFilter.value || mainUiSy;

      syFilter.innerHTML = "";
      Array.from(uniqueSYs)
        .sort()
        .reverse()
        .forEach((sy) => {
          const selected = sy === currentSelection ? "selected" : "";
          syFilter.insertAdjacentHTML(
            "beforeend",
            `<option value="${sy}" ${selected}>SY: ${sy}</option>`,
          );
        });
    }

    const activeSY = syFilter ? syFilter.value : "2026-2027";
    const allPlans = allFetchedPlans.filter((p) => p.safeSY === activeSY);
    container.innerHTML = "";

    if (allPlans.length === 0) {
      container.innerHTML = `<div class="text-center py-12"><p class="text-gray-500 font-bold">No plans found for School Year ${activeSY}.</p></div>`;
      return;
    }

    const groupedPlans = {};
    allPlans.forEach((plan) => {
      const term = plan.safeTerm;
      const subjectGrade = plan.subjectGrade;
      if (!groupedPlans[term]) groupedPlans[term] = {};
      if (!groupedPlans[term][subjectGrade])
        groupedPlans[term][subjectGrade] = [];
      groupedPlans[term][subjectGrade].push(plan);
    });

    Object.keys(groupedPlans)
      .sort()
      .forEach((term, termIndex) => {
        const isTermOpen = termIndex === 0 ? "open" : "";
        let subjectAccordionsHTML = "";

        Object.keys(groupedPlans[term])
          .sort()
          .forEach((subjectGrade) => {
            const plans = groupedPlans[term][subjectGrade];
            plans.sort((a, b) => {
              const weekA = parseInt((a.safeWeek || "0").replace(/\D/g, ""));
              const weekB = parseInt((b.safeWeek || "0").replace(/\D/g, ""));
              return weekA - weekB;
            });

            let rowsHTML = "";
            plans.forEach((data) => {
              let shortDate = data.safeDate;
              const monthMap = {
                January: "Jan",
                February: "Feb",
                March: "Mar",
                April: "Apr",
                August: "Aug",
                September: "Sep",
                October: "Oct",
                November: "Nov",
                December: "Dec",
              };
              Object.keys(monthMap).forEach((longMonth) => {
                shortDate = shortDate.replace(
                  new RegExp(longMonth, "gi"),
                  monthMap[longMonth],
                );
              });

              rowsHTML += `
                        <tr class="border-b border-gray-100 hover:bg-blue-50 transition">
                            <td class="px-4 py-3 font-bold text-blue-900 w-1/4">${data.safeWeek}</td>
                            <td class="px-4 py-3 text-xs text-gray-600 font-medium">🗓️ ${shortDate}</td>
                            <td class="px-4 py-3 text-right">
                                <div class="flex justify-end gap-2">
                                    <button onclick='loadSpecificPlan(${JSON.stringify(data).replace(/'/g, "&#39;")})' class="px-3 py-1.5 bg-blue-600 text-white font-bold text-[10px] rounded hover:bg-blue-700 shadow-sm transition">Load</button>
                                    <button onclick="deleteLessonPlan('${data.id}')" class="px-2 py-1.5 bg-red-50 text-red-600 font-bold text-[10px] rounded hover:bg-red-100 transition" title="Delete">✖</button>
                                </div>
                            </td>
                        </tr>
                    `;
            });

            subjectAccordionsHTML += `
                    <details class="group/sub border border-gray-200 rounded-md mb-3 overflow-hidden shadow-sm" open>
                        <summary class="flex justify-between items-center bg-gray-50 p-3 cursor-pointer select-none hover:bg-gray-100 transition">
                            <span class="font-bold text-sm text-gray-800">📘 ${subjectGrade}</span>
                            <span class="text-gray-400 group-open/sub:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div class="bg-white"><table class="w-full text-left"><tbody>${rowsHTML}</tbody></table></div>
                    </details>
                `;
          });

        container.insertAdjacentHTML(
          "beforeend",
          `
                <details class="group/main mb-4 bg-white border border-blue-200 rounded-lg shadow-sm" ${isTermOpen}>
                    <summary class="flex justify-between items-center font-extrabold text-blue-900 uppercase tracking-widest cursor-pointer select-none p-4 bg-blue-50 hover:bg-blue-100 transition rounded-t-lg border-b border-blue-100">
                        <div class="flex items-center gap-2"><span class="text-lg">📁</span><span>${term}</span></div>
                        <span class="text-blue-500 group-open/main:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div class="p-4 bg-white rounded-b-lg">${subjectAccordionsHTML}</div>
                </details>
            `,
        );
      });
  } catch (e) {
    container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">Error: ${e.message}</div>`;
  }
};

window.deleteLessonPlan = async function (docId) {
  // 🚀 PHASE 1: Soft-Delete Execution
  if (
    !confirm(
      "Move this lesson plan to the Archive? It will be permanently deleted in 14 days.",
    )
  )
    return;

  window.showLoader("Archiving...", "Moving lesson plan to the Recycle Bin.");
  try {
    const purgeDate = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000,
    ).toISOString();

    await setDoc(
      doc(window.db, "lesson_plans", docId),
      {
        is_archived: true,
        archived_at: new Date().toISOString(),
        purge_at: purgeDate,
      },
      { merge: true },
    );

    window.openLoadPlanModal();
  } catch (e) {
    alert("Failed to archive plan: " + e.message);
  } finally {
    window.hideLoader();
  }
};
// ==========================================
// 🚀 GLOBAL RECYCLE BIN & AUTO-PURGER
// ==========================================
window.openArchiveManager = async function () {
  if (!window.db) return alert("Firebase is not connected.");

  let modal = document.getElementById("archiveModal");
  if (!modal) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
            <div id="archiveModal" class="fixed inset-0 bg-gray-900/90 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
                <div class="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 relative flex flex-col max-h-[85vh]">
                    <button onclick="document.getElementById('archiveModal').classList.add('hidden')" class="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-xl font-bold">✖</button>
                    <h3 class="text-xl font-black text-blue-900 mb-2 flex items-center gap-2"><span>🗑️</span> Cloud Recycle Bin</h3>
                    <p class="text-sm text-gray-500 mb-4 border-b pb-4">Items here will be permanently deleted 14 days after archiving.</p>
                    
                    <div id="archiveListContainer" class="flex-1 overflow-y-auto space-y-3 pr-2">
                        <p class="text-gray-400 italic text-center py-8">Scanning for archived files...</p>
                    </div>
                </div>
            </div>
        `,
    );
    modal = document.getElementById("archiveModal");
  } else {
    modal.classList.remove("hidden");
  }

  const container = document.getElementById("archiveListContainer");
  container.innerHTML = `<div class="animate-pulse flex space-x-4"><div class="flex-1 space-y-4 py-1"><div class="h-4 bg-gray-200 rounded w-3/4"></div></div></div>`;

  try {
    const { collection, getDocs } =
      await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const [plansSnap, presSnap] = await Promise.all([
      getDocs(collection(window.db, "lesson_plans")),
      getDocs(collection(window.db, "presentations")),
    ]);

    let archivedItems = [];
    const now = Date.now();

    plansSnap.forEach((doc) => {
      const d = doc.data();
      if (d.is_archived)
        archivedItems.push({
          collection: "lesson_plans",
          id: doc.id,
          title: `Lesson Plan: ${d.grade_level} - ${d.subject_title}`,
          ...d,
        });
    });

    presSnap.forEach((doc) => {
      const d = doc.data();
      if (d.is_archived)
        archivedItems.push({
          collection: "presentations",
          id: doc.id,
          title: `Presentation Slides: ${d.grade} - ${d.subject}`,
          ...d,
        });
    });

    container.innerHTML = "";
    if (archivedItems.length === 0)
      return (container.innerHTML = `<p class="text-gray-400 font-bold text-center py-8">Recycle Bin is empty.</p>`);

    archivedItems.sort(
      (a, b) =>
        new Date(b.archived_at).getTime() - new Date(a.archived_at).getTime(),
    );

    archivedItems.forEach((item) => {
      const daysLeft = Math.max(
        0,
        Math.ceil(
          (new Date(item.purge_at).getTime() - now) / (1000 * 60 * 60 * 24),
        ),
      );
      const icon = item.collection === "lesson_plans" ? "📘" : "🖥️";

      container.insertAdjacentHTML(
        "beforeend",
        `
                <div class="p-3 border rounded-lg bg-gray-50 flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-gray-800 text-sm flex items-center gap-2"><span>${icon}</span> ${item.title}</h4>
                        <p class="text-[10px] ${daysLeft <= 3 ? "text-red-600" : "text-amber-600"} font-bold mt-1">Permanently deletes in ${daysLeft} days</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="restoreDocument('${item.collection}', '${item.id}')" class="px-3 py-1.5 bg-green-50 text-green-700 font-bold text-xs rounded border border-green-200 hover:bg-green-100 transition shadow-sm">♻️ Restore</button>
                        <button onclick="hardDeleteDocument('${item.collection}', '${item.id}')" class="px-3 py-1.5 bg-red-600 text-white font-bold text-xs rounded hover:bg-red-700 transition shadow-sm">🗑️ Eradicate</button>
                    </div>
                </div>
            `,
      );
    });
  } catch (e) {
    container.innerHTML = `<p class="text-red-500 font-bold text-center py-8">Error: ${e.message}</p>`;
  }
};

window.restoreDocument = async function (collectionName, docId) {
  if (!window.db) return;
  try {
    const { doc, setDoc } =
      await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    await setDoc(
      doc(window.db, collectionName, docId),
      { is_archived: false },
      { merge: true },
    );

    window.openArchiveManager(); // Refresh UI
    if (typeof window.openLoadPlanModal === "function")
      window.openLoadPlanModal(); // Refresh planner list
  } catch (e) {
    alert("Failed to restore: " + e.message);
  }
};

window.hardDeleteDocument = async function (collectionName, docId) {
  if (
    !window.db ||
    !confirm(
      "WARNING: This will eradicate the file permanently. Cannot be undone. Proceed?",
    )
  )
    return;
  try {
    const { doc, deleteDoc } =
      await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    await deleteDoc(doc(window.db, collectionName, docId));

    window.openArchiveManager();
    if (typeof window.openLoadPlanModal === "function")
      window.openLoadPlanModal();
  } catch (e) {
    alert("Failed to delete: " + e.message);
  }
};

// 🚀 SILENT 14-DAY AUTO-PURGER (Fires 5 seconds after boot)
setTimeout(async () => {
  if (!window.db) return;
  try {
    const { collection, getDocs, doc, deleteDoc } =
      await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const [plansSnap, presSnap] = await Promise.all([
      getDocs(collection(window.db, "lesson_plans")),
      getDocs(collection(window.db, "presentations")),
    ]);

    const now = Date.now();
    const checkAndPurge = async (snapshot, collName) => {
      for (let document of snapshot.docs) {
        const data = document.data();
        if (data.is_archived && data.purge_at) {
          if (now > new Date(data.purge_at).getTime()) {
            await deleteDoc(doc(window.db, collName, document.id));
            console.log(
              `[Auto-Purge] Eradicated expired ${collName}: ${document.id}`,
            );
          }
        }
      }
    };

    await checkAndPurge(plansSnap, "lesson_plans");
    await checkAndPurge(presSnap, "presentations");
  } catch (e) {
    console.warn("Auto-Purge check failed:", e);
  }
}, 5000);
