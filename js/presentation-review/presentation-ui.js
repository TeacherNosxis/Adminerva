let quillStandard = null;
let quillLeft = null;
let quillRight = null;
let currentPresentationDeck = [];
let activeSlideIndex = -1;

document.addEventListener("DOMContentLoaded", () => {
  initEditors();
  initPresentationDeck();
  applyPresentationTheme();
});

// ==========================================
// 1. MULTI-EDITOR INITIALIZATION
// ==========================================
function initEditors() {
  const config = {
    modules: { formula: true, toolbar: "#presentation-toolbar" },
    theme: "snow",
  };

  if (document.getElementById("editor-container"))
    quillStandard = new Quill("#editor-container", config);
  if (document.getElementById("editor-left"))
    quillLeft = new Quill("#editor-left", config);
  if (document.getElementById("editor-right"))
    quillRight = new Quill("#editor-right", config);

  const checkAndSave = (source, editorObj, key) => {
    if (source !== "user" || activeSlideIndex < 0) return;

    // Overflow Blocker
    const canvas = document.getElementById("slide-canvas");
    const editorRoot = editorObj.root;
    const maxSafeHeight = canvas.clientHeight * 0.85;

    if (editorRoot.scrollHeight > maxSafeHeight) {
      editorObj.history.undo(); // Instant revert
      flashWarning();
    } else {
      currentPresentationDeck[activeSlideIndex][key] = editorRoot.innerHTML;
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
  if (activeSlideIndex < 0) return;
  currentPresentationDeck[activeSlideIndex].layout = layout;
  applyLayoutView(layout);
};

function applyLayoutView(layout) {
  const layoutStandard = document.getElementById("layout-standard");
  const layoutSplit = document.getElementById("layout-split");
  const layoutMedia = document.getElementById("layout-media");
  const ribbon = document.getElementById("slide-ribbon");
  const toolbar = document.getElementById("presentation-toolbar");

  // Hide all
  layoutStandard.classList.add("hidden");
  layoutSplit.classList.add("hidden");
  layoutMedia.classList.add("hidden");

  // Reset UI Overlays
  ribbon.classList.remove("hidden");
  toolbar.style.opacity = "1";
  toolbar.style.pointerEvents = "auto";

  if (layout === "split") {
    layoutSplit.classList.remove("hidden");
    layoutSplit.classList.add("flex");
  } else if (layout === "media") {
    layoutMedia.classList.remove("hidden");
    ribbon.classList.add("hidden"); // Maximize canvas
    toolbar.style.opacity = "0.3"; // Disable text tools
    toolbar.style.pointerEvents = "none";
    renderMediaPreview();
  } else {
    layoutStandard.classList.remove("hidden");
  }
}

// ==========================================
// 3. MEDIA UPLOAD ENGINE (Images Only)
// ==========================================
window.handleMediaUpload = function (event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 800 * 1024) {
    alert(
      "🚨 IMAGE TOO LARGE! Please compress your image to under 800KB before uploading to prevent database crashes.",
    );
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    currentPresentationDeck[activeSlideIndex].mediaUrl = e.target.result;
    renderMediaPreview();
  };
  reader.readAsDataURL(file);
};

function renderMediaPreview() {
  if (activeSlideIndex < 0) return;
  const slide = currentPresentationDeck[activeSlideIndex];
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
  if (activeSlideIndex < 0) return;
  currentPresentationDeck[activeSlideIndex].mediaUrl = "";
  document.getElementById("mediaFileInput").value = "";
  renderMediaPreview();
};

// ==========================================
// 4. SLIDE BLOCK NAVIGATION
// ==========================================
function initPresentationDeck() {
  if (currentPresentationDeck.length === 0) {
    currentPresentationDeck = [
      {
        layout: "standard",
        type: "title",
        label: "Title Slide",
        content: "<h1>Main Lesson Title</h1><p>Subtopic goes here...</p>",
      },
      {
        layout: "standard",
        type: "objectives",
        label: "Objectives",
        content: "<ul><li>Objective 1</li><li>Objective 2</li></ul>",
      },
    ];
  }
  renderSlideBlocks();
  selectSlide(0);
}

function renderSlideBlocks() {
  const listContainer = document.getElementById("slideBlockList");
  if (!listContainer) return;

  listContainer.innerHTML = "";

  currentPresentationDeck.forEach((slide, index) => {
    const isActive = index === activeSlideIndex;
    const activeStyles = "bg-blue-50 border-l-4 border-blue-600";
    const inactiveStyles =
      "bg-white border border-gray-100 hover:border-gray-300";
    const activeTextLabel = "text-blue-800";
    const inactiveTextLabel = "text-gray-500";
    const activeTitle = "text-gray-900";
    const inactiveTitle = "text-gray-700";

    let layoutIcon = "📄";
    if (slide.layout === "split") layoutIcon = "🪟";
    if (slide.layout === "media") layoutIcon = "🖼️";

    const html = `
            <div onclick="selectSlide(${index})" class="p-3 rounded cursor-pointer transition flex items-center justify-between ${isActive ? activeStyles : inactiveStyles}">
                <div>
                    <div class="text-xs font-bold uppercase ${isActive ? activeTextLabel : inactiveTextLabel}">Slide ${index + 1}</div>
                    <div class="text-sm font-semibold ${isActive ? activeTitle : inactiveTitle}">${slide.label}</div>
                </div>
                <div class="text-gray-400 text-lg opacity-50">${layoutIcon}</div>
            </div>
        `;
    listContainer.insertAdjacentHTML("beforeend", html);
  });
}

window.selectSlide = function (index) {
  if (index < 0 || index >= currentPresentationDeck.length) return;
  activeSlideIndex = index;
  renderSlideBlocks();

  const slide = currentPresentationDeck[index];
  const layout = slide.layout || "standard";

  document.getElementById("slideLayoutSelector").value = layout;
  applyLayoutView(layout);

  // Silently inject text without triggering overflow alarms
  if (quillStandard) quillStandard.root.innerHTML = slide.content || "";
  if (quillLeft) quillLeft.root.innerHTML = slide.contentLeft || "";
  if (quillRight) quillRight.root.innerHTML = slide.contentRight || "";
};

window.addNewSlide = function () {
  currentPresentationDeck.push({
    layout: "standard",
    type: "blank",
    label: "Blank Slide",
    content: "",
  });
  renderSlideBlocks();
  selectSlide(currentPresentationDeck.length - 1);
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
