import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

window.availablePlans = [];
window.selectedPlanData = null;
window.selectedSessionData = null;

document.addEventListener("DOMContentLoaded", () => {
  injectPlanSelectorUI();
  // Wait for the global Firebase instance to initialize from settings-core
  setTimeout(fetchSavedLessonPlans, 1000);
});

function injectPlanSelectorUI() {
  const leftColumn = document.querySelector(".lg\\:w-1\\/4");
  if (!leftColumn) return;

  const selectorHTML = `
        <div class="mb-4 bg-gray-50 p-3 rounded border border-gray-200">
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
  leftColumn.insertAdjacentHTML("afterbegin", selectorHTML);
}

async function fetchSavedLessonPlans() {
  const select = document.getElementById("presentationPlanSelect");
  if (!window.db) {
    select.innerHTML = '<option value="">Firebase disconnected</option>';
    return;
  }

  try {
    const querySnapshot = await getDocs(collection(window.db, "lesson_plans"));
    window.availablePlans = [];
    select.innerHTML = '<option value="">-- Choose a Lesson Plan --</option>';

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      window.availablePlans.push({ id: doc.id, ...data });

      const grade = data.grade_level || "N/A";
      const subject = data.subject_title || "Unknown Subject";
      const week = data.week || "Unknown Week";

      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = `${grade} - ${subject} (${week})`;
      select.appendChild(option);
    });
  } catch (e) {
    console.error("Error fetching plans:", e);
    select.innerHTML = '<option value="">Error loading plans</option>';
  }
}

window.handlePlanSelection = function () {
  const planId = document.getElementById("presentationPlanSelect").value;
  const sessionSelect = document.getElementById("presentationSessionSelect");
  const btnGen = document.getElementById("btnGenerateSlides");

  if (!planId) {
    sessionSelect.innerHTML = '<option value="">Awaiting lesson...</option>';
    sessionSelect.disabled = true;
    btnGen.disabled = true;
    btnGen.classList.add("opacity-50", "cursor-not-allowed");
    return;
  }

  window.selectedPlanData = window.availablePlans.find((p) => p.id === planId);
  sessionSelect.innerHTML = '<option value="">-- Choose a Session --</option>';
  sessionSelect.disabled = false;

  if (window.selectedPlanData && window.selectedPlanData.sessions) {
    window.selectedPlanData.sessions.forEach((session, idx) => {
      const option = document.createElement("option");
      option.value = idx;
      option.textContent = session.session_name || `Session ${idx + 1}`;
      sessionSelect.appendChild(option);
    });
  }
};

window.handleSessionSelection = function () {
  const sessionIdx = document.getElementById("presentationSessionSelect").value;
  const btnGen = document.getElementById("btnGenerateSlides");

  if (sessionIdx !== "") {
    window.selectedSessionData = window.selectedPlanData.sessions[sessionIdx];
    btnGen.disabled = false;
    btnGen.classList.remove("opacity-50", "cursor-not-allowed");
  } else {
    window.selectedSessionData = null;
    btnGen.disabled = true;
    btnGen.classList.add("opacity-50", "cursor-not-allowed");
  }
};
