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

        <!-- Sticky Edge Ribbon (Responsive Size & Transparency) -->
        <button onclick="document.getElementById('bug-modal').classList.remove('hidden')" class="fixed top-24 sm:top-28 left-0 bg-slate-800 text-cyan-400 border border-l-0 border-cyan-900 px-1 py-2.5 sm:px-2 sm:py-4 rounded-r-lg shadow-[4px_0_10px_rgba(6,182,212,0.2)] hover:bg-slate-700 hover:text-cyan-300 transition-all z-40 opacity-70 hover:opacity-100" style="writing-mode: vertical-rl;">
            <span class="text-[9px] sm:text-sm font-bold tracking-wider sm:tracking-widest uppercase">Report<span class="hidden sm:inline"> Issue</span></span>
        </button>
        
        <!-- Bug Modal (Hidden by default) -->
        <div id="bug-modal" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-cyan-900 rounded-xl shadow-2xl max-w-lg w-full p-6 relative text-white text-left flex flex-col max-h-[90vh]">
            <button onclick="document.getElementById('bug-modal').classList.add('hidden')" class="absolute top-4 right-4 text-slate-400 hover:text-cyan-400 transition">✕</button>
            <h2 class="text-xl font-bold mb-4 text-cyan-400">Report an Issue</h2>
            
            <textarea id="bug-description" rows="4" class="w-full bg-slate-900 border border-slate-700 rounded p-2 mb-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-400 shrink-0" placeholder="Describe what went wrong..."></textarea>
            
            <div class="flex justify-between items-center mb-2 shrink-0">
              <label for="bug-image-upload" class="cursor-pointer text-cyan-500 text-sm font-bold hover:text-cyan-300 transition flex items-center gap-1">
                <span class="text-lg">📎</span> Attach Screenshot
              </label>
              <input type="file" id="bug-image-upload" accept="image/*" class="hidden" />
              
              <a href="issues.html" class="text-xs font-medium text-slate-400 hover:text-cyan-400 transition underline">View Known Issues</a>
            </div>
            
            <div class="text-[10px] text-slate-500 mb-4 italic hidden sm:block shrink-0">Tip: You can also press Ctrl+V (or Cmd+V) to paste a screenshot here.</div>
            
            <!-- Image Preview Area -->
            <div class="overflow-y-auto flex-1 mb-4 flex justify-center">
              <div class="relative group inline-block">
                <img id="bug-screenshot-preview" class="hidden max-w-full h-auto max-h-48 object-contain border border-slate-700 rounded bg-slate-900" />
                <button id="remove-screenshot-btn" class="hidden absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full p-1 shadow-lg transition">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>
            
            <button id="submit-bug-btn" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded transition shrink-0">Submit Report</button>
          </div>
        </div>
    `;

  document.body.insertAdjacentHTML("beforeend", loaderHTML);

  // --- Image Upload & Paste Logic ---
  const fileInput = document.getElementById("bug-image-upload");
  const previewImg = document.getElementById("bug-screenshot-preview");
  const bugModal = document.getElementById("bug-modal");
  const removeBtn = document.getElementById("remove-screenshot-btn");

  const handleImageFile = (file) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = function (event) {
        previewImg.src = event.target.result;
        previewImg.classList.remove("hidden");
        removeBtn.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    }
  };

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      handleImageFile(e.target.files[0]);
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      previewImg.src = "";
      previewImg.classList.add("hidden");
      removeBtn.classList.add("hidden");
      if (fileInput) fileInput.value = ""; // Reset the input
    });
  }

  // Allow users to paste a screenshot directly into the modal
  if (bugModal) {
    bugModal.addEventListener("paste", (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let index in items) {
        const item = items[index];
        if (item.kind === "file") {
          handleImageFile(item.getAsFile());
        }
      }
    });
  }
});

// Attach functions to the global 'window' object so any file can use them
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

    setTimeout(() => {
      loader.classList.add("hidden");
    }, 300);
  }
};
