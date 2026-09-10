window.currentPresentationDeck = [];
window.activeSlideIndex = -1;

let quillStandard = null;
let quillLeft = null;
let quillRight = null;

document.addEventListener("DOMContentLoaded", () => {
  initEditors();
  initPresentationDeck();
  applyPresentationTheme();
});

// ==========================================
// 0. RIBBON METADATA UPDATER
// ==========================================
window.updateRibbon = function () {
  let subject =
    localStorage.getItem("lessonReview_defaultSubject") || "MAIN LESSON TITLE";
  let topic = "Subtopic Context";

  // 🚀 Update based on the selected Firebase lesson plan
  if (window.selectedPlanData) {
    subject = window.selectedPlanData.subject_title || subject;
    if (
      window.selectedPlanData.weekly_overview &&
      window.selectedPlanData.weekly_overview.topic
    ) {
      topic = window.selectedPlanData.weekly_overview.topic;
    }
  }

  const titleEl = document.getElementById("ribbon-title");
  const subtitleEl = document.getElementById("ribbon-subtitle");
  if (titleEl) titleEl.textContent = subject.toUpperCase();
  if (subtitleEl) subtitleEl.textContent = topic;
};

// ==========================================
// 1. MULTI-EDITOR INITIALIZATION
// ==========================================
function initEditors() {
  if (document.getElementById("editor-container"))
    quillStandard = new Quill("#editor-container", {
      theme: "snow",
      modules: { formula: true, toolbar: "#toolbar-standard" },
    });
  if (document.getElementById("editor-left"))
    quillLeft = new Quill("#editor-left", {
      theme: "snow",
      modules: { formula: true, toolbar: "#toolbar-left" },
    });
  if (document.getElementById("editor-right"))
    quillRight = new Quill("#editor-right", {
      theme: "snow",
      modules: { formula: true, toolbar: "#toolbar-right" },
    });

  // 🚀 FOCUS TRACKING FOR UNIFIED TOOLBAR EFFECT
  if (quillLeft) {
    quillLeft.root.addEventListener("focus", () => {
      if (
        window.currentPresentationDeck[window.activeSlideIndex]?.layout ===
        "split"
      ) {
        document.getElementById("toolbar-left").classList.remove("hidden");
        document.getElementById("toolbar-right").classList.add("hidden");
      }
    });
  }
  if (quillRight) {
    quillRight.root.addEventListener("focus", () => {
      if (
        window.currentPresentationDeck[window.activeSlideIndex]?.layout ===
        "split"
      ) {
        document.getElementById("toolbar-right").classList.remove("hidden");
        document.getElementById("toolbar-left").classList.add("hidden");
      }
    });
  }

  const checkAndSave = (source, editorObj, key) => {
    if (source !== "user" || window.activeSlideIndex < 0) return;

    const canvas = document.getElementById("slide-canvas");
    const editorRoot = editorObj.root;
    const maxSafeHeight = canvas.clientHeight * 0.85;

    if (editorRoot.scrollHeight > maxSafeHeight) {
      editorObj.history.undo();
      flashWarning();
    } else {
      window.currentPresentationDeck[window.activeSlideIndex][key] =
        editorRoot.innerHTML;
    }
  };

  if (quillStandard)
    quillStandard.on("text-change", (d, od, s) =>
      checkAndSave(s, quillStandard, "content"),
    );
  if (quillLeft)
    quillLeft.on("text-change", (d, od, s) =>
      checkAndSave(s, quillLeft, "contentLeft"),
    );
  if (quillRight)
    quillRight.on("text-change", (d, od, s) =>
      checkAndSave(s, quillRight, "contentRight"),
    );
}

function flashWarning() {
  const warning = document.getElementById("overflowWarning");
  if (warning) {
    warning.classList.remove("hidden");
    setTimeout(() => warning.classList.add("hidden"), 1500);
  }
}

// ==========================================
// 2. LAYOUT SWITCHER ENGINE
// ==========================================
window.changeSlideLayout = function (layout) {
  if (window.activeSlideIndex < 0) return;
  window.currentPresentationDeck[window.activeSlideIndex].layout = layout;
  applyLayoutView(layout);
};

function applyLayoutView(layout) {
  const layoutStandard = document.getElementById("layout-standard");
  const layoutSplit = document.getElementById("layout-split");
  const layoutMedia = document.getElementById("layout-media");
  const ribbon = document.getElementById("slide-ribbon");

  const masterToolbar = document.getElementById("master-toolbar-container");
  const tStd = document.getElementById("toolbar-standard");
  const tLeft = document.getElementById("toolbar-left");
  const tRight = document.getElementById("toolbar-right");

  layoutStandard.classList.remove("flex", "hidden");
  layoutSplit.classList.remove("flex", "hidden");
  layoutMedia.classList.remove("flex", "hidden");
  ribbon.classList.remove("hidden");

  tStd.classList.add("hidden");
  tLeft.classList.add("hidden");
  tRight.classList.add("hidden");
  masterToolbar.style.opacity = "1";
  masterToolbar.style.pointerEvents = "auto";

  if (layout === "split") {
    layoutStandard.classList.add("hidden");
    layoutSplit.classList.add("flex");
    layoutMedia.classList.add("hidden");
    tLeft.classList.remove("hidden"); // Default to left toolbar visually
  } else if (layout === "media") {
    layoutStandard.classList.add("hidden");
    layoutSplit.classList.add("hidden");
    layoutMedia.classList.add("flex");
    ribbon.classList.add("hidden");
    masterToolbar.style.opacity = "0.3";
    masterToolbar.style.pointerEvents = "none";
    tStd.classList.remove("hidden");
    renderMediaPreview();
  } else {
    layoutStandard.classList.add("flex");
    layoutSplit.classList.add("hidden");
    layoutMedia.classList.add("hidden");
    tStd.classList.remove("hidden");
  }
}

// ==========================================
// 3. MEDIA UPLOAD ENGINE (Images Only)
// ==========================================
window.handleMediaUpload = function (event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 800 * 1024) {
    alert("🚨 IMAGE TOO LARGE! Compress to under 800KB.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    window.currentPresentationDeck[window.activeSlideIndex].mediaUrl =
      e.target.result;
    renderMediaPreview();
  };
  reader.readAsDataURL(file);
};

function renderMediaPreview() {
  if (window.activeSlideIndex < 0) return;
  const slide = window.currentPresentationDeck[window.activeSlideIndex];
  const previewImg = document.getElementById("media-preview-img");
  const uploadUi = document.getElementById("media-upload-ui");

  if (slide.mediaUrl) {
    previewImg.src = slide.mediaUrl;
    previewImg.classList.remove("hidden");
    uploadUi.classList.add("hidden");
  } else {
    previewImg.src = "";
    previewImg.classList.add("hidden");
    uploadUi.classList.remove("hidden");
  }
}

window.clearMediaSlide = function () {
  if (window.activeSlideIndex < 0) return;
  window.currentPresentationDeck[window.activeSlideIndex].mediaUrl = "";
  document.getElementById("mediaFileInput").value = "";
  renderMediaPreview();
};

// ==========================================
// 4. SLIDE BLOCK NAVIGATION
// ==========================================
function initPresentationDeck() {
  if (window.currentPresentationDeck.length === 0) {
    window.currentPresentationDeck = [
      {
        layout: "standard",
        type: "title",
        label: "Title Slide",
        content: "<h1>Main Lesson Title</h1>",
      },
      {
        layout: "standard",
        type: "objectives",
        label: "Objectives",
        content: "<ul><li>Objective 1</li></ul>",
      },
    ];
  }
  renderSlideBlocks();
  window.selectSlide(0);
}

function renderSlideBlocks() {
  const listContainer = document.getElementById("slideBlockList");
  if (!listContainer) return;
  listContainer.innerHTML = "";

  window.currentPresentationDeck.forEach((slide, index) => {
    const isActive = index === window.activeSlideIndex;
    const activeStyles = "bg-blue-50 border-l-4 border-blue-600";
    const inactiveStyles =
      "bg-white border border-gray-100 hover:border-gray-300";

    let layoutIcon = "📄";
    if (slide.layout === "split") layoutIcon = "🪟";
    if (slide.layout === "media") layoutIcon = "🖼️";

    const html = `
      <div onclick="selectSlide(${index})" class="p-3 rounded cursor-pointer transition flex items-center justify-between ${isActive ? activeStyles : inactiveStyles}">
          <div>
              <div class="text-xs font-bold uppercase ${isActive ? "text-blue-800" : "text-gray-500"}">Slide ${index + 1}</div>
              <div class="text-sm font-semibold ${isActive ? "text-gray-900" : "text-gray-700"}">${slide.label}</div>
          </div>
          <div class="text-gray-400 text-lg opacity-50">${layoutIcon}</div>
      </div>
    `;
    listContainer.insertAdjacentHTML("beforeend", html);
  });
}

window.selectSlide = function (index) {
  if (index < 0 || index >= window.currentPresentationDeck.length) return;
  window.activeSlideIndex = index;

  // 🚀 FORCE RIBBON UPDATE
  window.updateRibbon();

  renderSlideBlocks();

  const slide = window.currentPresentationDeck[index];
  const layout = slide.layout || "standard";

  document.getElementById("slideLayoutSelector").value = layout;
  applyLayoutView(layout);

  if (quillStandard) quillStandard.root.innerHTML = slide.content || "";
  if (quillLeft) quillLeft.root.innerHTML = slide.contentLeft || "";
  if (quillRight) quillRight.root.innerHTML = slide.contentRight || "";
};

window.addNewSlide = function () {
  window.currentPresentationDeck.push({
    layout: "standard",
    type: "blank",
    label: "Blank Slide",
    content: "",
  });
  renderSlideBlocks();
  window.selectSlide(window.currentPresentationDeck.length - 1);
};

// ==========================================
// 5. BACKGROUND THEME INJECTION
// ==========================================
async function applyPresentationTheme() {
  let bgBase64 = localStorage.getItem("presentation_logo");
  const canvasEl = document.getElementById("slide-canvas");

  const applyToCanvas = (b64) => {
    if (canvasEl && b64 && b64.length > 50) {
      canvasEl.style.backgroundImage = `url('${b64}')`;
      canvasEl.style.backgroundColor = "transparent";
    }
  };

  if (bgBase64 && bgBase64.length > 50) {
    applyToCanvas(bgBase64);
    return;
  }

  let attempts = 0;
  const checkDb = setInterval(async () => {
    if (window.db) {
      clearInterval(checkDb);
      try {
        const { doc, getDoc } =
          await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
        const docSnap = await getDoc(
          doc(window.db, "global_settings", "presentation_config"),
        );
        if (docSnap.exists() && docSnap.data().logo_base64) {
          bgBase64 = docSnap.data().logo_base64;
          localStorage.setItem("presentation_logo", bgBase64);
          applyToCanvas(bgBase64);
        }
      } catch (e) {
        console.warn("Failed to fetch theme from Firebase:", e);
      }
    }
    attempts++;
    if (attempts > 20) clearInterval(checkDb);
  }, 100);
}
