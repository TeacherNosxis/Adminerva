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

        <!-- Sticky Edge Ribbon (Upper Left, Below Navigation) -->
        <button onclick="document.getElementById('bug-modal').classList.remove('hidden')" class="fixed top-24 left-0 bg-slate-800 text-cyan-400 border border-l-0 border-cyan-900 px-1.5 py-3 rounded-r-md shadow-[4px_0_10px_rgba(6,182,212,0.2)] hover:bg-slate-700 hover:text-cyan-300 transition-all z-40" style="writing-mode: vertical-rl; transform: rotate(180deg);">
            <span class="text-xs font-bold tracking-widest uppercase">Report Issue</span>
        </button>
        
        <!-- Bug Modal (Hidden by default) -->
        <div id="bug-modal" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-cyan-900 rounded-xl shadow-2xl max-w-lg w-full p-6 relative text-white text-left">
            <button onclick="document.getElementById('bug-modal').classList.add('hidden')" class="absolute top-4 right-4 text-slate-400 hover:text-cyan-400 transition">✕</button>
            <h2 class="text-xl font-bold mb-4 text-cyan-400">Report an Issue</h2>
            
            <textarea id="bug-description" rows="4" class="w-full bg-slate-900 border border-slate-700 rounded p-2 mb-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-400" placeholder="Describe what went wrong..."></textarea>
            
            <div class="flex justify-between items-center mb-4">
              <button id="capture-screen-btn" class="text-cyan-500 text-sm font-bold hover:text-cyan-300 transition">📸 Capture Screen</button>
              <a href="issues.html" class="text-xs font-medium text-slate-400 hover:text-cyan-400 transition underline">View Known Issues</a>
            </div>
            
            <img id="bug-screenshot-preview" class="hidden w-full h-32 object-cover border border-slate-700 mb-4 rounded" />
            
            <button id="submit-bug-btn" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded transition">Submit Report</button>
          </div>
        </div>
    `;

  document.body.insertAdjacentHTML("beforeend", loaderHTML);
});

// 2. Attach functions to the global 'window' object so any file can use them
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
