document.addEventListener('DOMContentLoaded', () => {
    const navContainer = document.getElementById('adminerva-nav');
    if (!navContainer) return;

    // Read where we are from the HTML attributes
    const activeModule = navContainer.getAttribute('data-module') || 'lesson'; 
    const activePage = navContainer.getAttribute('data-page') || 'planner';

    let centerLinks = "";
    let rightSide = "";

    // 🚀 ROUTING: Determine Links & Active States (With Cyber-Cyan Glowing Effects)
    if (activeModule === 'lesson') {
        const getStyle = (pageId) => activePage === pageId 
            ? "text-white border-b-2 border-cyan-400 pb-1 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" 
            : "text-gray-400 hover:text-cyan-300 transition-colors duration-300";

        centerLinks = `
            <a href="lesson-planner.html" class="${getStyle('planner')}">AI Planner</a>
            <a href="schedule.html" class="${getStyle('schedule')}">Teacher's Schedule</a>
            <a href="library.html" class="${getStyle('library')}">Reference Library</a>
        `;
        rightSide = `
            <a href="settings.html" class="bg-gray-800/80 border border-cyan-900 hover:border-cyan-400 px-4 py-2 rounded text-gray-300 hover:text-cyan-50 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all duration-300 flex items-center gap-2 font-bold text-sm">
                <span>⚙️</span> Global Settings
            </a>
        `;
    } else if (activeModule === 'repo') {
        const getStyle = (pageId) => activePage === pageId 
            ? "text-white border-b-2 border-cyan-400 pb-1 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" 
            : "text-gray-400 hover:text-cyan-300 transition-colors duration-300";

        // 🚀 RESTORED GRADEBOOK AND ADMIN HUB
        centerLinks = `
            <a href="index.html" class="${getStyle('dashboard')}">Analytics Dashboard</a>
            <a href="grading.html" class="${getStyle('grader')}">AutoGrader</a>
            <a href="gradebook.html" class="${getStyle('gradebook')}">Gradebook</a>
            <a href="admin.html" class="${getStyle('admin')}">Admin Hub</a>
        `;
        rightSide = `
            <a href="settings.html" class="bg-gray-800/80 border border-cyan-900 hover:border-cyan-400 px-4 py-2 rounded text-gray-300 hover:text-cyan-50 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all duration-300 flex items-center gap-2 font-bold text-sm">
                <span>⚙️</span> Global Settings
            </a>
        `;
    } else if (activeModule === 'settings') {
        centerLinks = `<span class="italic text-gray-500 font-semibold tracking-wide">System Configuration</span>`;
        rightSide = `
            <span class="bg-cyan-950/50 border border-cyan-400 px-4 py-2 rounded text-cyan-50 font-bold text-sm shadow-[0_0_15px_rgba(6,182,212,0.5)] flex items-center gap-2">
                <span>⚙️</span> Control Center
            </span>
        `;
    }

    // 🚀 INJECT: Build the unified HTML with Sticky Glassmorphism Header
    navContainer.innerHTML = `
    <nav class="bg-gray-900/95 backdrop-blur-md text-white shadow-[0_4px_20px_rgba(0,0,0,0.5)] relative z-50 border-b border-cyan-900/50 sticky top-0">
        <div class="max-w-screen-2xl mx-auto px-6 py-2 flex justify-between items-center">
            
            <div class="relative group cursor-pointer py-1">
                <div class="flex items-center gap-3 text-xl font-bold transition">
                    <!-- 🚀 FIXED .PNG EXTENSION -->
                    <img src="New Adminerva logo.png" alt="Adminerva Logo" class="h-16 w-auto object-contain mix-blend-lighten hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                    
                    <span class="tracking-widest font-extrabold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 drop-shadow-md">ADMINERVA</span>
                    <span class="text-[10px] text-cyan-500 ml-1 opacity-70 group-hover:opacity-100 transition-opacity">▼</span>
                </div>
                
                <div class="absolute left-0 top-full w-64 hidden group-hover:block z-[100] pt-3">
                    <div class="bg-gray-900/95 backdrop-blur-xl rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-cyan-900/50 overflow-hidden">
                        <div class="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Adminerva Modules</div>
                        <a href="index.html" class="block px-4 py-3 text-sm font-bold text-gray-300 hover:bg-cyan-900/30 hover:text-cyan-300 border-b border-gray-800 transition-all flex items-center gap-2">
                            <span class="text-cyan-500">💻</span> RepoReview System
                        </a>
                        <a href="lesson-planner.html" class="block px-4 py-3 text-sm font-bold text-gray-300 hover:bg-cyan-900/30 hover:text-cyan-300 transition-all flex items-center gap-2">
                            <span class="text-cyan-500">📘</span> Lesson Planner
                        </a>
                    </div>
                </div>
            </div>

            <div class="flex gap-8 text-sm font-bold tracking-wide">${centerLinks}</div>
            <div>${rightSide}</div>

        </div>
    </nav>`;
});