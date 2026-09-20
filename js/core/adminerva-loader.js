document.addEventListener("DOMContentLoaded", () => {
  // 1. Automatically inject the loader HTML into the bottom of the page
  const loaderHTML = `
        <div id="subtleLoader" class="fixed bottom-6 left-6 z-[100] bg-slate-900 border border-slate-700 shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-lg p-4 flex items-center gap-4 transition-all duration-300 transform translate-y-20 opacity-0 hidden">
            <!-- Glowing Cyan Spinner -->
            <svg class="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span id="subtleLoaderText" class="text-sm font-bold text-slate-200 tracking-wide">Fetching data...</span>
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
