document.addEventListener("DOMContentLoaded", () => {
  const navContainer = document.getElementById("adminerva-nav");
  if (!navContainer) return;

  const activeModule = navContainer.getAttribute("data-module") || "lesson";
  const activePage = navContainer.getAttribute("data-page") || "planner";

  // Identify Role
  const userRole = localStorage.getItem("Adminerva_Role") || "student";
  const isSuperAdmin = userRole === "superadmin";

  let centerLinks = "";
  let rightSide = "";
  let logoBlock = "";

  const getStyle = (pageId) =>
    activePage === pageId
      ? "text-white border-b-2 border-cyan-400 pb-1 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
      : "text-gray-400 hover:text-cyan-300 transition-colors duration-300";

  // 🚀 CONDITIONAL RENDER VARIABLES (Empty for standard teachers)
  const adminDirLink = isSuperAdmin
    ? `<a href="users.html" class="${getStyle("directory")}">Directory</a>`
    : "";
  const adminSetLink = isSuperAdmin
    ? `<a href="settings.html" class="${getStyle("settings")}">System Settings</a>`
    : "";
  const adminSetIcon = isSuperAdmin
    ? `
        <a href="settings.html" class="bg-gray-800/80 border border-cyan-900 hover:border-cyan-400 p-2.5 rounded text-gray-300 hover:text-cyan-50 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all duration-300 flex items-center justify-center" title="Global Settings">
            <span class="text-xl leading-none">⚙️</span>
        </a>`
    : "";

  const adminLogoBlock = `
        <div class="relative group cursor-pointer py-1">
            <div class="flex items-center gap-3 text-xl font-bold transition">
                <img src="assets/New Adminerva logo.png" alt="Adminerva Logo" class="h-10 w-auto object-contain mix-blend-lighten hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                <span class="tracking-widest font-extrabold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 drop-shadow-md">ADMINERVA</span>
                <span class="text-[10px] text-cyan-500 ml-1 opacity-70 group-hover:opacity-100 transition-opacity">▼</span>
            </div>
            <div class="absolute left-0 top-full w-64 hidden group-hover:block z-[100] pt-3">
                <div class="bg-gray-900/95 backdrop-blur-xl rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-cyan-900/50 overflow-hidden">
                    <div class="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Adminerva Modules</div>
                    <a href="reporeviewDashboard.html" class="block px-4 py-3 text-sm font-bold text-gray-300 hover:bg-cyan-900/30 hover:text-cyan-300 border-b border-gray-800 transition-all flex items-center gap-2">
                        <span class="text-cyan-500">💻</span> Educator Hub
                    </a>
                    <a href="lesson-planner.html" class="block px-4 py-3 text-sm font-bold text-gray-300 hover:bg-cyan-900/30 hover:text-cyan-300 transition-all flex items-center gap-2">
                        <span class="text-cyan-500">📘</span> Lesson Planner
                    </a>
                </div>
            </div>
        </div>
    `;

  if (activeModule === "student") {
    centerLinks = `
            <a href="student-dashboard.html" class="${getStyle("dashboard")}">Dashboard</a>
            <a href="student-settings.html" class="${getStyle("settings")}">Settings</a>
        `;
    rightSide = `
            <span id="userEmailDisplay" class="text-sm font-medium text-slate-300 hidden sm:block mr-4"></span>
            <button id="signOutBtn" class="text-sm px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 font-bold rounded transition border border-red-500/20">Sign Out</button>
        `;
    logoBlock = `
            <div class="flex items-center gap-3 text-xl font-bold">
                <img src="assets/New Adminerva logo.png" alt="Adminerva Logo" class="h-10 w-auto object-contain mix-blend-lighten drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                <span class="tracking-widest font-extrabold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 drop-shadow-md">ADMINERVA</span>
            </div>
        `;
  } else if (activeModule === "educator") {
    centerLinks = `
            <a href="reporeviewDashboard.html" class="${getStyle("dashboard")}">Dashboard</a>
            <a href="grading.html" class="${getStyle("grader")}">AutoGrader</a>
            ${adminDirLink}${adminSetLink}
        `;
    rightSide = `
            <a href="dev.html" target="_blank" class="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded hover:bg-emerald-500/20 transition hidden sm:flex items-center gap-2 mr-4">
                <span>👀</span> Student View
            </a>
            <span class="text-sm font-medium text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 rounded hidden sm:block mr-4">${isSuperAdmin ? "Super Admin" : "Teacher Mode"}</span>
            <button id="signOutBtn" class="text-sm px-3 py-1.5 text-gray-400 hover:text-white font-bold transition">Sign Out</button>
        `;
    logoBlock = adminLogoBlock;
  } else if (activeModule === "repo") {
    centerLinks = `
            <a href="index.html" class="${getStyle("dashboard")}">Analytics</a>
            <a href="grading.html" class="${getStyle("grader")}">AutoGrader</a>
            <a href="gradebook.html" class="${getStyle("gradebook")}">Gradebook</a>
            ${adminDirLink}
        `;
    rightSide = adminSetIcon;
    logoBlock = adminLogoBlock;
  } else if (activeModule === "lesson") {
    centerLinks = `
            <a href="lesson-planner.html" class="${getStyle("planner")}">AI Planner</a>
            <a href="presentation.html" class="${getStyle("presentation")}">Slide Editor</a>
            <a href="schedule.html" class="${getStyle("schedule")}">Teacher's Schedule</a>
            <a href="library.html" class="${getStyle("library")}">Reference Library</a>
        `;
    rightSide = adminSetIcon;
    logoBlock = adminLogoBlock;
  } else if (activeModule === "settings") {
    centerLinks = `<span class="italic text-gray-500 font-semibold tracking-wide">System Configuration</span>`;
    rightSide = ``;
    logoBlock = adminLogoBlock;
  }

  navContainer.innerHTML = `
    <nav class="bg-gray-900/95 backdrop-blur-md text-white shadow-[0_4px_20px_rgba(0,0,0,0.5)] relative z-50 border-b border-cyan-900/50 sticky top-0">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
            ${logoBlock}
            <div class="hidden md:flex gap-8 text-sm font-bold tracking-wide items-center">${centerLinks}</div>
            <div class="flex items-center">${rightSide}</div>
        </div>
    </nav>`;
});
