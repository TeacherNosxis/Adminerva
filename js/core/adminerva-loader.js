document.addEventListener("DOMContentLoaded", () => {
  const loaderHTML = `
        <!-- Existing Subtle Loader -->
        <div id="subtleLoader" class="fixed bottom-6 left-6 z-[100] bg-slate-900 border border-slate-700 shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-lg p-4 flex items-center gap-4 transition-all duration-300 transform translate-y-20 opacity-0 hidden">
            <svg class="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span id="subtleLoaderText" class="text-sm font-bold text-slate-200 tracking-wide">Fetching data...</span>
        </div>

        <!-- Sticky Edge Ribbon -->
        <button onclick="document.getElementById('bug-modal').classList.remove('hidden')" class="fixed top-28 left-0 bg-slate-800 text-cyan-400 border border-l-0 border-cyan-900 px-2 py-4 rounded-r-lg shadow-[4px_0_10px_rgba(6,182,212,0.2)] hover:bg-slate-700 hover:text-cyan-300 transition-all z-40" style="writing-mode: vertical-rl;">
            <span class="text-sm font-bold tracking-widest uppercase">Report Issue</span>
        </button>
        
        <!-- ✨ ENHANCED Bug Modal -->
        <div id="bug-modal" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-cyan-900 rounded-xl shadow-2xl max-w-xl w-full p-6 relative text-white text-left max-h-[90vh] flex flex-col">
            <button onclick="document.getElementById('bug-modal').classList.add('hidden')" class="absolute top-4 right-4 text-slate-400 hover:text-cyan-400 transition text-xl">&times;</button>
            
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
              <h2 class="text-xl font-bold text-cyan-400 flex items-center gap-2"><span>🚨</span> Report an Issue</h2>
              <a href="issues.html" class="text-xs font-bold text-slate-400 hover:text-cyan-400 transition underline">View Known Issues</a>
            </div>
            
            <div class="overflow-y-auto pr-2 flex-1 space-y-4">
                <!-- Categorization -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                        <select id="bug-category" class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer">
                            <option value="Bug">🐛 Bug / System Error</option>
                            <option value="Access">🔐 Login / Access Issue</option>
                            <option value="Feature">✨ Feature Request</option>
                            <option value="UI">📱 UI / Display Issue</option>
                            <option value="Other">❓ Other</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                        <select id="bug-priority" class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer">
                            <option value="Low">🟢 Low</option>
                            <option value="Medium" selected>🟡 Medium</option>
                            <option value="High">🟠 High</option>
                            <option value="Critical">🔴 Critical (Blocks Work)</option>
                        </select>
                    </div>
                </div>

                <!-- Text Inputs -->
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Issue Summary</label>
                    <input type="text" id="bug-title" class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-400" placeholder="A brief title of the problem...">
                </div>

                <div>
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Detailed Description</label>
                    <textarea id="bug-description" rows="3" class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-400" placeholder="Please provide details or steps to reproduce the issue..."></textarea>
                </div>

                <!-- Multiple Screenshots Engine -->
                <div class="bg-slate-900/50 p-3 rounded border border-slate-700 border-dashed">
                    <div class="flex justify-between items-center mb-2">
                        <label class="block text-[10px] font-bold text-cyan-500 uppercase tracking-wider">
                            Screenshots (<span id="bug-img-count">0</span>/5)
                        </label>
                        <div class="flex gap-2">
                            <span class="text-[10px] text-slate-500 hidden sm:inline pt-1 mr-2">Tip: You can press Ctrl+V to paste</span>
                            <button onclick="document.getElementById('bug-image-upload').click()" type="button" class="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition font-bold shadow-sm">
                                📸 Browse / Capture
                            </button>
                        </div>
                        <input type="file" id="bug-image-upload" multiple accept="image/*" class="hidden" />
                    </div>
                    
                    <div id="bug-screenshots-container" class="flex gap-3 overflow-x-auto py-2 min-h-[4.5rem]">
                        <span id="bug-img-placeholder" class="text-xs text-slate-500 italic mt-2">No screenshots attached yet.</span>
                    </div>
                </div>
            </div>
            
            <div class="mt-4 pt-3 border-t border-slate-700">
                <button onclick="window.submitBugReport()" id="submit-bug-btn" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded transition shadow-lg">Submit Report</button>
            </div>
          </div>
        </div>
    `;

  document.body.insertAdjacentHTML("beforeend", loaderHTML);
  bindBugReporterLogic();
});

// ==========================================
// GLOBAL LOADER FUNCTIONS
// ==========================================
window.showSubtleLoader = function (message = "Processing...") {
  const loader = document.getElementById("subtleLoader");
  const text = document.getElementById("subtleLoaderText");
  if (loader && text) {
    text.textContent = message;
    loader.classList.remove("hidden");
    setTimeout(() => {
      loader.classList.remove("translate-y-20", "opacity-0");
      loader.classList.add("translate-y-0", "opacity-100");
    }, 10);
  }
};

window.hideSubtleLoader = function () {
  const loader = document.getElementById("subtleLoader");
  if (loader) {
    loader.classList.remove("translate-y-0", "opacity-100");
    loader.classList.add("translate-y-20", "opacity-0");
    setTimeout(() => loader.classList.add("hidden"), 300);
  }
};

// ==========================================
// BUG REPORTER LOGIC (Max 5 Images + Paste)
// ==========================================
function bindBugReporterLogic() {
  window.bugImages = [];

  const fileInput = document.getElementById("bug-image-upload");
  const modal = document.getElementById("bug-modal");

  // Handle File Browse
  fileInput.addEventListener("change", (e) => {
    processBugFiles(Array.from(e.target.files));
    e.target.value = ""; // Reset input
  });

  // Handle Ctrl+V Paste anywhere while modal is open
  window.addEventListener("paste", (e) => {
    if (modal.classList.contains("hidden")) return;

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const files = [];
    for (let item of items) {
      if (item.type.indexOf("image") === 0) files.push(item.getAsFile());
    }
    if (files.length > 0) processBugFiles(files);
  });
}

function processBugFiles(files) {
  let availableSlots = 5 - window.bugImages.length;
  if (availableSlots <= 0)
    return alert("Maximum 5 screenshots allowed per report.");

  const filesToProcess = files.slice(0, availableSlots);

  filesToProcess.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      window.bugImages.push(e.target.result);
      renderBugThumbnails();
    };
    reader.readAsDataURL(file);
  });
}

window.removeBugImage = function (index) {
  window.bugImages.splice(index, 1);
  renderBugThumbnails();
};

function renderBugThumbnails() {
  const container = document.getElementById("bug-screenshots-container");
  const count = document.getElementById("bug-img-count");
  const placeholder = document.getElementById("bug-img-placeholder");

  count.textContent = window.bugImages.length;

  // Clear thumbnails but keep the placeholder logic
  container.innerHTML = "";

  if (window.bugImages.length === 0) {
    container.innerHTML = `<span id="bug-img-placeholder" class="text-xs text-slate-500 italic mt-2">No screenshots attached yet.</span>`;
    return;
  }

  window.bugImages.forEach((imgBase64, index) => {
    container.insertAdjacentHTML(
      "beforeend",
      `
      <div class="relative w-16 h-16 shrink-0 rounded border-2 border-slate-600 overflow-hidden group shadow-sm">
          <img src="${imgBase64}" class="w-full h-full object-cover" />
          <button onclick="window.removeBugImage(${index})" class="absolute top-0 right-0 bg-red-600/90 hover:bg-red-500 text-white w-5 h-5 flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition shadow">✕</button>
      </div>
    `,
    );
  });
}

// ==========================================
// FIRESTORE SUBMISSION (Dynamic Import)
// ==========================================
window.submitBugReport = async function () {
  const category = document.getElementById("bug-category").value;
  const priority = document.getElementById("bug-priority").value;
  const title = document.getElementById("bug-title").value.trim();
  const description = document.getElementById("bug-description").value.trim();

  if (!title || !description)
    return alert(
      "Please provide both an Issue Summary and a Detailed Description.",
    );

  const btn = document.getElementById("submit-bug-btn");
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-pulse">Submitting Report...</span>`;

  try {
    // Dynamically import Firestore methods so this loader doesn't crash pages without Firebase
    const { collection, addDoc, serverTimestamp } =
      await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");

    if (!window.db)
      throw new Error(
        "Database connection not found. Please refresh the page and try again.",
      );

    const payload = {
      category,
      priority,
      title,
      description,
      images: window.bugImages, // Array containing up to 5 base64 strings
      urlContext: window.location.href, // Records exactly which page the user was on
      reporterEmail: window.auth?.currentUser?.email || "Anonymous",
      reporterRole: localStorage.getItem("Adminerva_Role") || "Unknown",
      status: "Open",
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(window.db, "issues"), payload);

    // Reset Form & Close
    document.getElementById("bug-title").value = "";
    document.getElementById("bug-description").value = "";
    document.getElementById("bug-category").value = "Bug";
    document.getElementById("bug-priority").value = "Medium";
    window.bugImages = [];
    renderBugThumbnails();

    document.getElementById("bug-modal").classList.add("hidden");

    // Quick success toast using the existing loader
    window.showSubtleLoader("Report submitted successfully!");
    setTimeout(() => window.hideSubtleLoader(), 3000);
  } catch (error) {
    console.error(error);
    alert("Failed to submit report: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Report";
  }
};
