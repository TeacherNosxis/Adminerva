import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const safeSet = (id, val) => {
  if (document.getElementById(id))
    document.getElementById(id).value = val || "";
};
const safeGet = (id) =>
  document.getElementById(id) ? document.getElementById(id).value.trim() : "";

let slideSequence = [
  { type: "title", label: "Title Slide" },
  { type: "objectives", label: "Objectives" },
  { type: "motivation", label: "Motivation / Recall" },
  { type: "core", label: "Core Content" },
  { type: "evaluation", label: "Evaluation" },
];

document.addEventListener("DOMContentLoaded", () => {
  const logoInput = document.getElementById("slideLogoFile");
  if (logoInput) {
    logoInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // 🚀 CRITICAL FIX: Block massive images before they crash local storage or Firebase
      if (file.size > 800 * 1024) {
        alert(
          "🚨 IMAGE TOO LARGE! Please compress your background to under 800KB. Massive files will crash the database.",
        );
        logoInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = function (event) {
        safeSet("slideLogoBase64", event.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  setTimeout(loadPresentationSettings, 500);
});

function renderSlideSequence() {
  const container = document.getElementById("slideTemplateSequence");
  if (!container) return;

  container.innerHTML = "";

  if (slideSequence.length === 0) {
    container.innerHTML = `<div class="text-xs text-gray-500 italic text-center py-4 border rounded bg-gray-50">No slides in default stack. Click "Add Slide Block" above.</div>`;
    return;
  }

  slideSequence.forEach((slide, index) => {
    const slideTypes = [
      { val: "title", text: "Title Slide" },
      { val: "objectives", text: "Objectives" },
      { val: "motivation", text: "Motivation / Recall" },
      { val: "core", text: "Core Lesson Content" },
      { val: "evaluation", text: "Evaluation" },
      { val: "closing", text: "Closing & Values" },
      { val: "blank", text: "Blank Slide" },
    ];

    let optionsHtml = slideTypes
      .map(
        (opt) =>
          `<option value="${opt.val}" ${slide.type === opt.val ? "selected" : ""}>${opt.text}</option>`,
      )
      .join("");

    const html = `
            <div class="flex items-center gap-3 bg-gray-50 border border-gray-200 p-2 rounded-lg shadow-sm slide-row">
                <div class="cursor-move text-gray-400 px-2 font-bold select-none">⋮⋮</div>
                <div class="font-bold text-xs text-gray-500 w-16 uppercase">Slide ${index + 1}</div>
                <select class="flex-1 p-1.5 border border-gray-300 rounded text-sm bg-white focus:ring-blue-500 slide-type-select" onchange="updateSlideSequence()">
                    ${optionsHtml}
                </select>
                <button onclick="removeSlideFromTemplate(${index})" class="text-red-400 hover:text-red-600 px-2 font-bold" title="Remove Slide">✖</button>
            </div>
        `;
    container.insertAdjacentHTML("beforeend", html);
  });
}

window.addSlideToTemplate = function () {
  slideSequence.push({ type: "blank", label: "Blank Slide" });
  renderSlideSequence();
};

window.removeSlideFromTemplate = function (index) {
  slideSequence.splice(index, 1);
  renderSlideSequence();
};

window.updateSlideSequence = function () {
  const rows = document.querySelectorAll(".slide-row");
  const newSequence = [];
  rows.forEach((row) => {
    const select = row.querySelector(".slide-type-select");
    const text = select.options[select.selectedIndex].text;
    newSequence.push({ type: select.value, label: text });
  });
  slideSequence = newSequence;
  renderSlideSequence();
};

window.loadPresentationSettings = async function () {
  let cloudData = null;

  if (window.db) {
    try {
      const docSnap = await getDoc(
        doc(window.db, "global_settings", "presentation_config"),
      );
      if (docSnap.exists()) cloudData = docSnap.data();
    } catch (e) {
      console.warn(
        "Firestore unreachable for Presentations. Falling back to local storage.",
        e,
      );
    }
  }

  const theme =
    cloudData?.theme || localStorage.getItem("presentation_theme") || "light";
  const logoBase64 =
    cloudData?.logo_base64 || localStorage.getItem("presentation_logo") || "";
  const savedSequence =
    cloudData?.slide_sequence ||
    JSON.parse(localStorage.getItem("presentation_slide_sequence") || "null");

  safeSet("setSlideTheme", theme);
  safeSet("slideLogoBase64", logoBase64);

  if (savedSequence && Array.isArray(savedSequence)) {
    slideSequence = savedSequence;
  }

  renderSlideSequence();
};

window.savePresentationSettings = async function () {
  if (typeof window.showLoader === "function")
    window.showLoader("Saving Presentation Defaults...");

  window.updateSlideSequence();

  const settingsData = {
    theme: document.getElementById("setSlideTheme")
      ? document.getElementById("setSlideTheme").value
      : "light",
    logo_base64: document.getElementById("slideLogoBase64")
      ? document.getElementById("slideLogoBase64").value
      : "",
    slide_sequence: slideSequence,
    updated_at: new Date().toISOString(),
  };

  try {
    // 🚀 Wrapped in try/catch to gracefully handle Quota limits
    localStorage.setItem("presentation_theme", settingsData.theme);
    localStorage.setItem("presentation_logo", settingsData.logo_base64);
    localStorage.setItem(
      "presentation_slide_sequence",
      JSON.stringify(settingsData.slide_sequence),
    );

    if (window.db) {
      await setDoc(
        doc(window.db, "global_settings", "presentation_config"),
        settingsData,
        { merge: true },
      );
      alert("✅ Presentation settings saved locally and synced to Firebase.");
    } else {
      alert("✅ Presentation settings saved locally (Firebase offline).");
    }
  } catch (e) {
    console.error("Save Error:", e);
    if (e.name === "QuotaExceededError" || e.message.includes("quota")) {
      alert(
        "🚨 LOCAL STORAGE FULL! The image is too large. Upload a smaller, compressed image.",
      );
    } else if (e.message.toLowerCase().includes("payload")) {
      alert(
        "🚨 FIREBASE LIMIT EXCEEDED! Firestore has a strict 1MB limit per document. Your image is too large.",
      );
    } else {
      alert(`⚠️ Error saving settings: ${e.message}`);
    }
  } finally {
    if (typeof window.hideLoader === "function") window.hideLoader();
  }
};
