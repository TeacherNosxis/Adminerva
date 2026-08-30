window.templates = [];
window.activeTemplateId = null;
window.editingTemplate = null;

const DEFAULT_TEMPLATES = [{
    id: "default_pct", name: "Standard Grading", scoringType: "percentage", generalPrompt: "",
    criteria: [{ name: "Logic", weight: 50, description: "Checks logic" }]
}];

window.initRubrics = function() {
    const stored = localStorage.getItem('repoReview_grading_templates');
    window.templates = stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    window.activeTemplateId = localStorage.getItem('repoReview_active_template_id') || window.templates[0].id;
    window.editingTemplate = JSON.parse(JSON.stringify(window.templates.find(t => t.id === window.activeTemplateId) || window.templates[0]));
    
    renderTemplateDropdown();
    renderTemplateEditor();
    updateRubricEquippedUI();
};

function renderTemplateDropdown() {
    const select = document.getElementById('templateSelect');
    if (!select) return;
    select.innerHTML = '';
    window.templates.forEach(t => {
        select.insertAdjacentHTML('beforeend', `<option value="${t.id}" ${t.id === window.editingTemplate.id ? 'selected' : ''}>${t.id === window.activeTemplateId ? '⭐ ' : ''}${t.name}</option>`);
    });
}

function updateRubricEquippedUI() {
    const banner = document.getElementById('activeEquippedBanner');
    if (banner) banner.textContent = (window.templates.find(t => t.id === window.activeTemplateId) || window.templates[0]).name;
}

window.changeTemplate = function() {
    const target = window.templates.find(t => t.id === document.getElementById('templateSelect').value);
    if (target) {
        window.editingTemplate = JSON.parse(JSON.stringify(target));
        renderTemplateEditor();
        updateRubricEquippedUI();
    }
};

function renderTemplateEditor() {
    if(document.getElementById('tplName')) document.getElementById('tplName').value = window.editingTemplate.name;
    const container = document.getElementById('criteriaContainer');
    if (!container) return;
    container.innerHTML = '';
    window.editingTemplate.criteria.forEach((crit, index) => {
        container.insertAdjacentHTML('beforeend', `
            <div class="criterion-row bg-white border border-gray-200 rounded p-3 flex gap-3 mb-2">
                <input type="text" class="crit-name w-1/4 p-1 border-b" value="${crit.name}" onchange="updateTemplatePreview()">
                <input type="number" class="crit-weight w-1/6 p-1 border-b" value="${crit.weight}" onchange="updateTemplatePreview()">
                <input type="text" class="crit-desc w-1/2 p-1 border-b" value="${crit.description}" onchange="updateTemplatePreview()">
                <button onclick="removeCriterion(${index})" class="text-red-400">🗑️</button>
            </div>
        `);
    });
}

window.updateTemplatePreview = function() {
    window.editingTemplate.name = document.getElementById('tplName')?.value || "Unnamed";
    window.editingTemplate.criteria = Array.from(document.querySelectorAll('.criterion-row')).map(row => ({
        name: row.querySelector('.crit-name').value,
        weight: Number(row.querySelector('.crit-weight').value),
        description: row.querySelector('.crit-desc').value
    }));
};

window.addCriterion = function() { window.updateTemplatePreview(); window.editingTemplate.criteria.push({ name: "", weight: 10, description: "" }); renderTemplateEditor(); };
window.removeCriterion = function(i) { window.updateTemplatePreview(); window.editingTemplate.criteria.splice(i, 1); renderTemplateEditor(); };

window.saveRubrics = function() {
    window.updateTemplatePreview();
    const idx = window.templates.findIndex(t => t.id === window.editingTemplate.id);
    if (idx >= 0) window.templates[idx] = window.editingTemplate;
    else window.templates.push(window.editingTemplate);
    localStorage.setItem('repoReview_grading_templates', JSON.stringify(window.templates));
    renderTemplateDropdown();
    alert("Saved.");
};