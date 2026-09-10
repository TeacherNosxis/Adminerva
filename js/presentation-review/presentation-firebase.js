import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

window.availablePlans = [];
window.selectedPlanData = null;
window.selectedSessionData = null;
window.selectedSessionIndex = null;
window.db = null;

document.addEventListener("DOMContentLoaded", () => {
  injectPlanSelectorUI();
  initFirebase();
});

function injectPlanSelectorUI() {
  const listContainer = document.getElementById("slideBlockList");
  if (!listContainer || !listContainer.parentElement) return;

  const selectorHTML = `
        <div class="mb-4 bg-gray-50 p-3 rounded border border-gray-200 w-full">
            <label class="block text-xs font-bold text-gray-600 uppercase mb-1">1. Select Saved Lesson</label>
            <select id="presentationPlanSelect" onchange="handlePlanSelection()" class="w-full p-1.5 mb-3 border border-gray-300 rounded text-xs bg-white focus:ring-blue-500">
                <option value="">Loading plans...</option>
            </select>
            
            <label class="block text-xs font-bold text-gray-600 uppercase mb-1">2. Select Session/Day</label>
            <select id="presentationSessionSelect" onchange="handleSessionSelection()" class="w-full p-1.5 mb-3 border border-gray-300 rounded text-xs bg-white focus:ring-blue-500" disabled>
                <option value="">Awaiting lesson...</option>
            </select>

            <button onclick="generateAI_SlideDeck()" id="btnGenerateSlides" class="w-full bg-purple-600 text-white font-bold py-2 rounded text-sm hover:bg-purple-700 transition shadow-sm opacity-50 cursor-not-allowed" disabled>
                ✨ Generate AI Slides
            </button>
        </div>
    `;
  listContainer.insertAdjacentHTML("beforebegin", selectorHTML);
}

function initFirebase() {
  const configStr =
    localStorage.getItem("Adminerva_firebase_config") ||
    localStorage.getItem("repoReview_firebase_config");
  const select = document.getElementById("presentationPlanSelect");

  if (!configStr) {
    if (select)
      select.innerHTML = '<option value="">Firebase disconnected</option>';
    return;
  }

  try {
    const firebaseConfig = JSON.parse(configStr);
    const app = initializeApp(firebaseConfig);
    window.db = getFirestore(app);
    fetchSavedLessonPlans();
  } catch (e) {
    console.error("Firebase Initialization Failed:", e);
    if (select)
      select.innerHTML = '<option value="">Error loading Firebase</option>';
  }
}

async function fetchSavedLessonPlans() {
  const select = document.getElementById("presentationPlanSelect");
  if (!window.db || !select) return;

  try {
    const querySnapshot = await getDocs(collection(window.db, "lesson_plans"));
    window.availablePlans = [];
    select.innerHTML = '<option value="">-- Choose a Lesson Plan --</option>';

    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // 🚀 PHASE 2: Do not load archived plans into the dropdown
      if (data.is_archived) return;

      window.availablePlans.push({ id: doc.id, ...data });

      const grade = data.grade_level || "N/A";
      const subject = data.subject_title || "Unknown Subject";
      const week = data.course_week || data.week || "Unknown Week";

      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = `${grade} - ${subject} (${week})`;
      select.appendChild(option);
    });
  } catch (e) {
    select.innerHTML = '<option value="">Error loading plans</option>';
  }
}

window.handleSessionSelection = async function () {
  const planId = document.getElementById("presentationPlanSelect").value;
  const sessionIdx = document.getElementById("presentationSessionSelect").value;
  const btnGen = document.getElementById("btnGenerateSlides");
  const btnDelete = document.getElementById("btnDeletePresentation");

  if (btnDelete) btnDelete.classList.add("hidden");

  if (sessionIdx !== "") {
    window.selectedSessionIndex = sessionIdx;
    window.selectedSessionData = window.selectedPlanData.sessions[sessionIdx];
    btnGen.disabled = false;
    btnGen.classList.remove("opacity-50", "cursor-not-allowed");

    if (window.db) {
      const presentationId = `${planId}_session${sessionIdx}`;
      try {
        const docSnap = await getDoc(
          doc(window.db, "presentations", presentationId),
        );

        // 🚀 PHASE 2: Ignore presentations that are flagged as archived
        if (docSnap.exists() && !docSnap.data().is_archived) {
          if (btnDelete) btnDelete.classList.replace("hidden", "flex");

          if (
            confirm(
              "💾 A saved presentation was found in the cloud for this session! Would you like to load it?",
            )
          ) {
            window.currentPresentationDeck = docSnap.data().deck;
            window.activeSlideIndex = 0;
            if (typeof window.renderSlideBlocks === "function")
              window.renderSlideBlocks();
            if (typeof window.selectSlide === "function") window.selectSlide(0);
          }
        }
      } catch (e) {
        console.warn("Failed to check cloud for existing presentation:", e);
      }
    }
  } else {
    window.selectedSessionData = null;
    window.selectedSessionIndex = null;
    btnGen.disabled = true;
    btnGen.classList.add("opacity-50", "cursor-not-allowed");
  }
};

// 🚀 PHASE 1: Presentation Soft-Delete Execution
window.deletePresentationFromCloud = async function () {
  const planId = document.getElementById("presentationPlanSelect")?.value;
  const sessionIdx = window.selectedSessionIndex;

  if (!planId || sessionIdx === null || sessionIdx === undefined) return;
  if (
    !confirm(
      "Move this presentation to the Archive? It will be permanently deleted in 14 days.",
    )
  )
    return;

  const btnDelete = document.getElementById("btnDeletePresentation");
  const originalText = btnDelete.innerHTML;
  btnDelete.innerHTML = "⏳ Archiving...";
  btnDelete.disabled = true;

  try {
    const presentationId = `${planId}_session${sessionIdx}`;
    const purgeDate = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000,
    ).toISOString();

    await setDoc(
      doc(window.db, "presentations", presentationId),
      {
        is_archived: true,
        archived_at: new Date().toISOString(),
        purge_at: purgeDate,
      },
      { merge: true },
    );

    alert("🗑️ Presentation moved to Archive.");
    btnDelete.classList.replace("flex", "hidden");

    // Clear the workspace visually
    window.currentPresentationDeck = [];
    window.activeSlideIndex = -1;
    if (typeof window.renderSlideBlocks === "function")
      window.renderSlideBlocks();
  } catch (e) {
    console.error("Archive Error:", e);
    alert("Failed to archive: " + e.message);
  } finally {
    btnDelete.innerHTML = originalText;
    btnDelete.disabled = false;
  }
};
// 🚀 CLOUD SAVE ENGINE
window.savePresentationToCloud = async function () {
  const planId = document.getElementById("presentationPlanSelect")?.value;
  const sessionIdx = window.selectedSessionIndex;

  if (!planId || sessionIdx === null || sessionIdx === undefined) {
    alert("Please select a Lesson Plan and Session first.");
    return;
  }
  if (
    !window.currentPresentationDeck ||
    window.currentPresentationDeck.length === 0
  ) {
    alert("No slides to save. Please add or generate slides first.");
    return;
  }
  if (!window.db) {
    alert("Firebase is not connected. Check Global Settings.");
    return;
  }

  const saveBtn = document.getElementById("btnSavePresentation");
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = "⏳ Saving...";
  saveBtn.disabled = true;

  try {
    const presentationId = `${planId}_session${sessionIdx}`;
    const payload = {
      plan_id: planId,
      session_index: sessionIdx,
      subject: window.selectedPlanData.subject_title || "Unknown",
      grade: window.selectedPlanData.grade_level || "Unknown",
      deck: window.currentPresentationDeck,
      updated_at: new Date().toISOString(),
    };

    await setDoc(doc(window.db, "presentations", presentationId), payload);
    alert("✅ Presentation successfully saved to Firebase!");
  } catch (e) {
    console.error("Save Error:", e);
    alert("Failed to save: " + e.message);
  } finally {
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  }
};
