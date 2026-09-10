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
    modules: {
      formula: true, // Requires KaTeX to be loaded in the HTML
      toolbar: "#presentation-toolbar",
    },
    theme: "snow",
  });

  quillEditor.on("text-change", () => {
    if (activeSlideIndex >= 0) {
      currentPresentationDeck[activeSlideIndex].content =
        quillEditor.root.innerHTML;
    }
    checkOverflow();
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
function applyPresentationTheme() {
  const bgBase64 = localStorage.getItem("presentation_logo");
  const canvasEl = document.getElementById("slide-canvas");

  // Only apply if the base64 string actually exists and isn't empty
  if (canvasEl && bgBase64 && bgBase64.length > 50) {
    canvasEl.style.backgroundImage = `url('${bgBase64}')`;
    canvasEl.style.backgroundColor = "transparent"; // Kill the fallback color
  } else {
    console.warn("No background image found in localStorage.");
  }
}
