window.showLoader = function(msg = "Processing...") {
    const msgEl = document.getElementById('loaderMessage');
    if (msgEl) msgEl.textContent = msg;
    const loader = document.getElementById('globalLoader');
    if (loader) loader.classList.replace('hidden', 'flex');
};

window.hideLoader = function() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.classList.replace('flex', 'hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    if(window.loadSecuritySettings) window.loadSecuritySettings();
    if(window.initRubrics) window.initRubrics();

    // 🚀 Boot Firebase FIRST. It will automatically trigger the settings fetch when connected.
    if(window.initFirebase) window.initFirebase();

    const csvInput = document.getElementById('csvFileInput');
    if(csvInput) csvInput.addEventListener('change', window.handleCsvUpload);
});

window.switchSettingsTab = function(tabName) {
    ['repo', 'lesson'].forEach(t => {
        const pane = document.getElementById('settingsTab-' + t);
        const btn = document.getElementById('settingsTabBtn-' + t);
        if (!pane || !btn) return;
        if (t === tabName) {
            pane.classList.remove('hidden');
            btn.className = `flex-1 py-4 text-sm font-bold border-b-2 transition ${tabName === 'repo' ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-blue-600 text-blue-700 bg-blue-50'}`;
        } else {
            pane.classList.add('hidden');
            btn.className = "flex-1 py-4 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition bg-white";
        }
    });
};

window.switchAdminTab = function(tabId) {
    ['security', 'students', 'rubrics'].forEach(id => {
        const pane = document.getElementById('tab-' + id);
        const btn = document.getElementById('tabBtn-' + id);
        if (!pane || !btn) return;
        pane.classList.replace('block', 'hidden');
        btn.classList.replace('tab-active', 'tab-inactive');
    });
    const activePane = document.getElementById('tab-' + tabId);
    const activeBtn = document.getElementById('tabBtn-' + tabId);
    if (activePane && activeBtn) {
        activePane.classList.replace('hidden', 'block');
        activeBtn.classList.replace('tab-inactive', 'tab-active');
    }
};

window.previewHeaderImage = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 800 * 1024) return alert("Please choose an image under 800KB.");
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64String = e.target.result;
        const hiddenInput = document.getElementById('settingsHeaderBase64');
        if (hiddenInput) hiddenInput.value = base64String;
        const previewImg = document.getElementById('headerPreview');
        const placeholder = document.getElementById('headerPreviewPlaceholder');
        if (previewImg && placeholder) {
            previewImg.src = base64String;
            previewImg.classList.remove('hidden');
            placeholder.classList.add('hidden');
        }
    };
    reader.readAsDataURL(file);
};

window.clearHeaderImage = function() {
    if (document.getElementById('settingsHeaderBase64')) document.getElementById('settingsHeaderBase64').value = '';
    if (document.getElementById('settingsHeaderFile')) document.getElementById('settingsHeaderFile').value = '';
    const previewImg = document.getElementById('headerPreview');
    const placeholder = document.getElementById('headerPreviewPlaceholder');
    if (previewImg && placeholder) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }
};

// Expose modal toggles globally
window.openSectionsModal = () => { window.renderSectionsManagerTable(); document.getElementById('sectionsModal')?.classList.replace('hidden', 'flex'); };
window.closeSectionsModal = () => document.getElementById('sectionsModal')?.classList.replace('flex', 'hidden');
window.closeStudentModal = () => document.getElementById('studentModal')?.classList.replace('flex', 'hidden');