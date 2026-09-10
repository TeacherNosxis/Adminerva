let quillEditor = null;
let currentPresentationDeck = [];
let activeSlideIndex = -1;

document.addEventListener("DOMContentLoaded", () => {
  initEditor();
  initPresentationDeck();
  applyPresentationTheme();
});

// ==========================================
// 1. INITIALIZE EDITOR & OVERFLOW DETECTION
// ==========================================
function initEditor() {
  const editorEl = document.getElementById("editor-container");
  if (!editorEl) return;

  quillEditor = new Quill("#editor-container", {
    modules: { formula: true, toolbar: "#presentation-toolbar" },
    theme: "snow",
  });

  quillEditor.on("text-change", (delta, oldDelta, source) => {
    if (source !== "user") return;

    const canvas = document.getElementById("slide-canvas");
    const editorRoot = document.querySelector(".ql-editor");
    const warning = document.getElementById("overflowWarning");

    if (!canvas || !editorRoot) return;
    const maxSafeHeight = canvas.clientHeight * 0.85;

    // 🚀 THE BLOCKER: Revert keystroke if too tall
    if (editorRoot.scrollHeight > maxSafeHeight) {
      quillEditor.setContents(oldDelta);

      if (warning) {
        warning.classList.remove("hidden");
        warning.classList.add("flex", "text-red-600", "font-bold");
        setTimeout(
          () => warning.classList.remove("text-red-600", "font-bold"),
          1500,
        );
      }
    } else {
      // Save valid content
      if (activeSlideIndex >= 0) {
        currentPresentationDeck[activeSlideIndex].content =
          quillEditor.root.innerHTML;
      }
      if (warning) {
        warning.classList.add("hidden");
        warning.classList.remove("flex");
      }
    }
  });
}

function checkOverflow() {
  const canvas = document.getElementById("slide-canvas");
  const editorRoot = document.querySelector(".ql-editor");
  const warning = document.getElementById("overflowWarning");

  if (!canvas || !editorRoot) return;

  // The header ribbon takes up 12%. We warn if the text pushes past 85% of the total canvas height.
  const maxSafeHeight = canvas.clientHeight * 0.85;

  if (editorRoot.scrollHeight > maxSafeHeight) {
    warning?.classList.remove("hidden");
    warning?.classList.add("flex"); // Assuming Tailwind classes
  } else {
    warning?.classList.add("hidden");
    warning?.classList.remove("flex");
  }
}

// ==========================================
// 2. SLIDE BLOCK NAVIGATION
// ==========================================
function initPresentationDeck() {
  // Fallback deck for testing the UI if no AI data is loaded yet
  if (currentPresentationDeck.length === 0) {
    currentPresentationDeck = [
      {
        type: "title",
        label: "Title Slide",
        content: "<h1>Main Lesson Title</h1><p>Subtopic goes here...</p>",
      },
      {
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

    // Tailwind styling logic matching your light theme
    const activeStyles = "bg-blue-50 border-l-4 border-blue-600";
    const inactiveStyles =
      "bg-white border border-gray-100 hover:border-gray-300";

    const activeTextLabel = "text-blue-800";
    const inactiveTextLabel = "text-gray-500";

    const activeTitle = "text-gray-900";
    const inactiveTitle = "text-gray-700";

    const html = `
            <div onclick="selectSlide(${index})" class="p-3 rounded cursor-pointer transition ${isActive ? activeStyles : inactiveStyles}">
                <div class="text-xs font-bold uppercase ${isActive ? activeTextLabel : inactiveTextLabel}">Slide ${index + 1}</div>
                <div class="text-sm font-semibold ${isActive ? activeTitle : inactiveTitle}">${slide.label}</div>
            </div>
        `;
    listContainer.insertAdjacentHTML("beforeend", html);
  });
}

window.selectSlide = function (index) {
  if (index < 0 || index >= currentPresentationDeck.length) return;

  activeSlideIndex = index;
  renderSlideBlocks();

  // Load content into editor silently without triggering an overflow false-positive
  if (quillEditor) {
    quillEditor.root.innerHTML = currentPresentationDeck[index].content || "";
    checkOverflow();
  }
};

window.addNewSlide = function () {
  currentPresentationDeck.push({
    type: "blank",
    label: "Blank Slide",
    content: "",
  });
  renderSlideBlocks();
  selectSlide(currentPresentationDeck.length - 1);
};
async function applyPresentationTheme() {
  let bgBase64 = localStorage.getItem("presentation_logo");
  const canvasEl = document.getElementById("slide-canvas");

  const applyToCanvas = (b64) => {
    if (canvasEl && b64 && b64.length > 50) {
      canvasEl.style.backgroundImage = `url('${b64}')`;
      canvasEl.style.backgroundColor = "transparent";
    }
  };

  // 1. Instant load if found in local storage
  if (bgBase64 && bgBase64.length > 50) {
    applyToCanvas(bgBase64);
    return;
  }

  // 2. Wait up to 2 seconds for Firebase to initialize
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
