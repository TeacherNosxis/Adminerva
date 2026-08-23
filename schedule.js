let mySections = [];
let mySubjects = [];
let myEvents = [];
let isEditing = false; 

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    renderTable();
});

// --- MODAL & CONFIG LOGIC ---
window.openSettingsModal = function() {
    // 1. Load the current saved values into the inputs
    document.getElementById('configSections').value = localStorage.getItem('lessonReview_sections') || "";
    document.getElementById('configSubjects').value = localStorage.getItem('lessonReview_subjects') || "";
    document.getElementById('configEvents').value = localStorage.getItem('lessonReview_events') || "";
    
    // 2. Force the modal to show
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeSettingsModal = function() {
    // Force the modal to hide
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
};

window.saveSettingsConfig = function() {
    // Save to local storage
    localStorage.setItem('lessonReview_sections', document.getElementById('configSections').value);
    localStorage.setItem('lessonReview_subjects', document.getElementById('configSubjects').value);
    localStorage.setItem('lessonReview_events', document.getElementById('configEvents').value);
    
    // Reload the arrays and table
    loadConfig();
    if(isEditing) saveScheduleData(); 
    renderTable();
    
    // Close the modal
    closeSettingsModal();
};

function loadConfig() {
    mySections = (localStorage.getItem('lessonReview_sections') || "").split(',').map(s => s.trim()).filter(s => s !== "");
    mySubjects = (localStorage.getItem('lessonReview_subjects') || "").split(',').map(s => s.trim()).filter(s => s !== "");
    myEvents = (localStorage.getItem('lessonReview_events') || "").split(',').map(s => s.trim()).filter(s => s !== "");
}

// --- EDIT/LOCK ENGINE ---
window.toggleEditMode = function() {
    if (isEditing) {
        saveScheduleData();
        isEditing = false;
        document.getElementById('editSaveBtn').innerHTML = '<span>✏️</span> Edit Schedule';
        document.getElementById('editSaveBtn').className = 'bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition shadow-sm flex items-center gap-2';
        document.getElementById('modeBadge').className = 'bg-gray-200 text-gray-700 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider';
        document.getElementById('modeBadge').textContent = '🔒 Read-Only';
        
        document.getElementById('addClassBtn').classList.add('hidden');
        document.getElementById('addEventBtn').classList.add('hidden');
    } else {
        isEditing = true;
        document.getElementById('editSaveBtn').innerHTML = '<span>💾</span> Save Schedule';
        document.getElementById('editSaveBtn').className = 'bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 transition shadow-sm flex items-center gap-2';
        document.getElementById('modeBadge').className = 'bg-green-100 text-green-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider animate-pulse';
        document.getElementById('modeBadge').textContent = '🛠️ Editing Mode';
        
        document.getElementById('addClassBtn').classList.remove('hidden');
        document.getElementById('addClassBtn').classList.add('flex');
        document.getElementById('addEventBtn').classList.remove('hidden');
        document.getElementById('addEventBtn').classList.add('flex');
    }
    renderTable();
};

// --- TABLE RENDERING ---
window.addRow = function(type) {
    const savedJson = getTableDataFromDOM();
    if (type === 'class') {
        savedJson.push({ type: 'class', time: '', mon: {sec:'', sub:''}, tue: {sec:'', sub:''}, wed: {sec:'', sub:''}, thu: {sec:'', sub:''}, fri: {sec:'', sub:''} });
    } else {
        savedJson.push({ type: 'constant', time: '', eventName: '' });
    }
    localStorage.setItem('lessonReview_schedule_json', JSON.stringify(savedJson));
    renderTable();
};

window.deleteRow = function(index) {
    const data = getTableDataFromDOM();
    data.splice(index, 1);
    localStorage.setItem('lessonReview_schedule_json', JSON.stringify(data));
    renderTable();
};

function renderTable() {
    const tbody = document.getElementById('scheduleTableBody');
    tbody.innerHTML = '';

    const savedJson = JSON.parse(localStorage.getItem('lessonReview_schedule_json') || '[]');
    
    if (savedJson.length === 0 && !isEditing) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-gray-400 italic">No schedule configured. Click 'Edit Schedule' to begin.</td></tr>`;
        return;
    }

    savedJson.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-gray-50 transition group";

        const timeInputHtml = isEditing 
            ? `<input type="text" class="time-input w-full p-2 border border-gray-300 rounded text-sm focus:ring-blue-500 font-bold text-gray-700 text-center" placeholder="Time" value="${row.time || ''}">`
            : `<span class="font-bold text-gray-800 text-sm">${row.time || '<span class="text-gray-300">No Time</span>'}</span>`;

        // INJECT TYPE AS HIDDEN DATA
        tr.dataset.rowType = row.type;

        if (row.type === 'constant') {
            // FULL-WIDTH CONSTANT EVENT ROW
            if (isEditing) {
                let options = `<option value="">-- Select Event --</option>`;
                myEvents.forEach(e => { options += `<option value="${e}" ${row.eventName === e ? 'selected' : ''}>${e}</option>`; });
                
                tr.innerHTML = `
                    <td class="p-2 border-r bg-gray-50 align-middle text-center">${timeInputHtml}</td>
                    <td colspan="5" class="p-2 border-r align-middle bg-amber-50 border-y border-amber-200">
                        <select class="event-input w-full p-2 border border-amber-300 rounded text-sm focus:ring-amber-500 font-bold text-amber-800 text-center bg-white">${options}</select>
                    </td>
                    <td class="p-2 text-center align-middle">
                        <button onclick="deleteRow(${rowIndex})" class="text-red-400 hover:text-red-600 font-bold px-2 transition">✖</button>
                    </td>
                `;
            } else {
                tr.innerHTML = `
                    <td class="p-3 border-r bg-gray-50 text-center align-middle">${timeInputHtml}</td>
                    <td colspan="5" class="p-3 border-r align-middle bg-amber-50 border-y border-amber-200 text-center shadow-inner">
                        <span class="font-extrabold text-amber-700 text-sm uppercase tracking-widest">${row.eventName || 'UNASSIGNED EVENT'}</span>
                    </td>
                    <td class="p-3 text-center align-middle text-gray-300">-</td>
                `;
            }
        } else {
            // STANDARD CLASS ROW (Mon-Fri)
            if (isEditing) {
                tr.innerHTML = `
                    <td class="p-2 border-r bg-gray-50 align-middle text-center">${timeInputHtml}</td>
                    <td class="p-2 border-r align-top">${buildCellEdit('mon', row.mon)}</td>
                    <td class="p-2 border-r align-top">${buildCellEdit('tue', row.tue)}</td>
                    <td class="p-2 border-r align-top">${buildCellEdit('wed', row.wed)}</td>
                    <td class="p-2 border-r align-top">${buildCellEdit('thu', row.thu)}</td>
                    <td class="p-2 border-r align-top">${buildCellEdit('fri', row.fri)}</td>
                    <td class="p-2 text-center align-middle">
                        <button onclick="deleteRow(${rowIndex})" class="text-red-400 hover:text-red-600 font-bold px-2 transition">✖</button>
                    </td>
                `;
            } else {
                tr.innerHTML = `
                    <td class="p-3 border-r bg-gray-50 text-center align-middle">${timeInputHtml}</td>
                    <td class="p-3 border-r align-top">${buildCellView(row.mon)}</td>
                    <td class="p-3 border-r align-top">${buildCellView(row.tue)}</td>
                    <td class="p-3 border-r align-top">${buildCellView(row.wed)}</td>
                    <td class="p-3 border-r align-top">${buildCellView(row.thu)}</td>
                    <td class="p-3 border-r align-top">${buildCellView(row.fri)}</td>
                    <td class="p-3 text-center align-middle text-gray-300">-</td>
                `;
            }
        }
        tbody.appendChild(tr);
    });
}

// --- CELL BUILDERS ---
function buildCellEdit(dayPrefix, savedData = {}) {
    let secHtml = `<select class="w-full p-1 border border-gray-300 rounded text-xs focus:ring-blue-500 font-bold text-gray-800 mb-1 ${dayPrefix}-sec bg-white">
        <option value="">-- Section --</option>${mySections.map(s => `<option value="${s}" ${savedData.sec === s ? 'selected' : ''}>${s}</option>`).join('')}
    </select>`;

    let subHtml = `<select class="w-full p-1 border border-gray-300 rounded text-xs focus:ring-blue-500 text-gray-600 ${dayPrefix}-sub bg-white">
        <option value="">-- Subject --</option>${mySubjects.map(s => `<option value="${s}" ${savedData.sub === s ? 'selected' : ''}>${s}</option>`).join('')}
    </select>`;

    // Add optional event override to class cells for "Periodic Events"
    let eventHtml = `<select class="w-full p-1 border border-amber-300 rounded text-[10px] focus:ring-amber-500 text-amber-700 bg-amber-50 mt-1 ${dayPrefix}-evt">
        <option value="">-- Periodic Event --</option>${myEvents.map(e => `<option value="${e}" ${savedData.evt === e ? 'selected' : ''}>${e}</option>`).join('')}
    </select>`;

    return `<div class="flex flex-col">${secHtml}${subHtml}${eventHtml}</div>`;
}

function buildCellView(savedData = {}) {
    if (savedData.evt) {
        return `<div class="flex flex-col bg-amber-50 border border-amber-200 p-2 rounded shadow-sm text-center h-full justify-center">
            <span class="font-extrabold text-amber-700 text-[10px] uppercase tracking-wider">${savedData.evt}</span>
        </div>`;
    }
    if (!savedData.sec && !savedData.sub) return `<span class="text-gray-300 text-xs italic">-</span>`;
    
    return `<div class="flex flex-col bg-blue-50 border border-blue-100 p-2 rounded shadow-sm">
        <span class="font-bold text-blue-900 text-xs">${savedData.sec || ''}</span>
        <span class="text-gray-600 text-[11px]">${savedData.sub || ''}</span>
    </div>`;
}

// --- DATA PARSING ---
function getTableDataFromDOM() {
    const rows = document.querySelectorAll('#scheduleTableBody tr');
    const jsonData = [];
    rows.forEach(tr => {
        const type = tr.dataset.rowType;
        const timeInput = tr.querySelector('.time-input');
        if (!timeInput) return; 

        if (type === 'constant') {
            jsonData.push({ type: 'constant', time: timeInput.value.trim(), eventName: tr.querySelector('.event-input').value });
        } else {
            const extractCell = (day) => ({
                sec: tr.querySelector(`.${day}-sec`).value,
                sub: tr.querySelector(`.${day}-sub`).value,
                evt: tr.querySelector(`.${day}-evt`).value
            });
            jsonData.push({
                type: 'class', time: timeInput.value.trim(),
                mon: extractCell('mon'), tue: extractCell('tue'), wed: extractCell('wed'), thu: extractCell('thu'), fri: extractCell('fri')
            });
        }
    });
    return jsonData;
}

window.saveScheduleData = function() {
    const jsonData = getTableDataFromDOM();
    localStorage.setItem('lessonReview_schedule_json', JSON.stringify(jsonData));

    let rawTextForAI = "TEACHER WEEKLY SCHEDULE:\n\n";
    const dayData = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };
    const daysMap = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };

    jsonData.forEach(row => {
        if (!row.time) return;

        if (row.type === 'constant' && row.eventName) {
            // AUTOMATICALLY DUPLICATE ACROSS ALL 5 DAYS FOR THE AI
            const eventStr = `[EVENT: ${row.eventName}]`;
            Object.values(daysMap).forEach(day => dayData[day].push(`${row.time}: ${eventStr}`));
        } else if (row.type === 'class') {
            Object.keys(daysMap).forEach(key => {
                const cell = row[key];
                let cellText = null;
                if (cell.evt) cellText = `[EVENT: ${cell.evt}]`;
                else if (cell.sec && cell.sub) cellText = `${cell.sec} (${cell.sub})`;

                if (cellText) dayData[daysMap[key]].push(`${row.time}: ${cellText}`);
            });
        }
    });

    Object.keys(dayData).forEach(day => {
        if (dayData[day].length > 0) {
            rawTextForAI += `[${day}]\n`;
            dayData[day].forEach(entry => rawTextForAI += `- ${entry}\n`);
            rawTextForAI += `\n`;
        }
    });
    localStorage.setItem('lessonReview_schedule', rawTextForAI);
};