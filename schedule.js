let mySections = [];
let mySubjects = [];
let isEditing = false; 

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    renderTable();
});

function loadConfig() {
    const savedSec = localStorage.getItem('lessonReview_sections') || "";
    const savedSub = localStorage.getItem('lessonReview_subjects') || "";
    
    document.getElementById('configSections').value = savedSec;
    document.getElementById('configSubjects').value = savedSub;
    
    mySections = savedSec.split(',').map(s => s.trim()).filter(s => s !== "");
    mySubjects = savedSub.split(',').map(s => s.trim()).filter(s => s !== "");
}

window.updateDropdownConfig = function() {
    const secVal = document.getElementById('configSections').value;
    const subVal = document.getElementById('configSubjects').value;
    
    localStorage.setItem('lessonReview_sections', secVal);
    localStorage.setItem('lessonReview_subjects', subVal);
    
    loadConfig();
    renderTable();
    alert("Dropdown lists updated!");
};

// Toggle between Read-Only and Edit Mode
window.toggleEditMode = function() {
    if (isEditing) {
        // Currently editing -> Save the data and lock it
        saveScheduleData();
        isEditing = false;
        document.getElementById('editSaveBtn').innerHTML = '<span>✏️</span> Edit Schedule';
        document.getElementById('editSaveBtn').className = 'bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition shadow-sm flex items-center gap-2';
        document.getElementById('modeBadge').className = 'bg-gray-200 text-gray-700 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider';
        document.getElementById('modeBadge').textContent = '🔒 Read-Only';
        document.getElementById('addSlotBtn').classList.add('hidden');
        document.getElementById('configPanel').classList.add('hidden');
    } else {
        // Currently locked -> Unlock and show editable dropdowns/inputs
        isEditing = true;
        document.getElementById('editSaveBtn').innerHTML = '<span>💾</span> Save Schedule';
        document.getElementById('editSaveBtn').className = 'bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 transition shadow-sm flex items-center gap-2';
        document.getElementById('modeBadge').className = 'bg-green-100 text-green-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider animate-pulse';
        document.getElementById('modeBadge').textContent = '🛠️ Editing Mode';
        document.getElementById('addSlotBtn').classList.remove('hidden');
        document.getElementById('addSlotBtn').classList.add('flex');
        document.getElementById('configPanel').classList.remove('hidden');
        document.getElementById('configPanel').classList.add('grid');
    }
    renderTable();
};

window.addRow = function() {
    const savedJson = getTableDataFromDOM();
    savedJson.push({ time: '', mon: {sec:'', sub:''}, tue: {sec:'', sub:''}, wed: {sec:'', sub:''}, thu: {sec:'', sub:''}, fri: {sec:'', sub:''} });
    localStorage.setItem('lessonReview_schedule_json', JSON.stringify(savedJson));
    renderTable();
};

function renderTable() {
    const tbody = document.getElementById('scheduleTableBody');
    tbody.innerHTML = '';

    const savedJson = JSON.parse(localStorage.getItem('lessonReview_schedule_json') || '[]');
    
    if (savedJson.length === 0 && isEditing) {
        savedJson.push({ time: '', mon: {sec:'', sub:''}, tue: {sec:'', sub:''}, wed: {sec:'', sub:''}, thu: {sec:'', sub:''}, fri: {sec:'', sub:''} });
    }

    if (savedJson.length === 0 && !isEditing) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-gray-400 italic">No schedule configured. Click 'Edit Schedule' to begin.</td></tr>`;
        return;
    }

    savedJson.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-gray-50 transition group";

        if (isEditing) {
            // --- EDIT MODE (Render Inputs & Dropdowns) ---
            tr.innerHTML = `
                <td class="p-2 border-r bg-gray-50">
                    <input type="text" class="time-input w-full p-2 border border-gray-300 rounded text-sm focus:ring-blue-500 font-bold text-gray-700 text-center" placeholder="12:40 - 1:30" value="${row.time || ''}">
                </td>
                <td class="p-2 border-r align-top">${buildCellEdit('mon', row.mon)}</td>
                <td class="p-2 border-r align-top">${buildCellEdit('tue', row.tue)}</td>
                <td class="p-2 border-r align-top">${buildCellEdit('wed', row.wed)}</td>
                <td class="p-2 border-r align-top">${buildCellEdit('thu', row.thu)}</td>
                <td class="p-2 border-r align-top">${buildCellEdit('fri', row.fri)}</td>
                <td class="p-2 text-center align-middle">
                    <button onclick="deleteRow(${rowIndex})" class="text-red-400 hover:text-red-600 font-bold px-2 transition" title="Delete Row">✖</button>
                </td>
            `;
        } else {
            // --- READ-ONLY MODE (Render Clean Text Blocks) ---
            tr.innerHTML = `
                <td class="p-3 border-r bg-gray-50 font-bold text-gray-800 text-sm text-center align-middle">
                    ${row.time || '<span class="text-gray-300">No Time</span>'}
                </td>
                <td class="p-3 border-r align-top">${buildCellView(row.mon)}</td>
                <td class="p-3 border-r align-top">${buildCellView(row.tue)}</td>
                <td class="p-3 border-r align-top">${buildCellView(row.wed)}</td>
                <td class="p-3 border-r align-top">${buildCellView(row.thu)}</td>
                <td class="p-3 border-r align-top">${buildCellView(row.fri)}</td>
                <td class="p-3 text-center align-middle text-gray-300">-</td>
            `;
        }
        tbody.appendChild(tr);
    });
}

function buildCellEdit(dayPrefix, savedData = {}) {
    let secHtml = `<select class="w-full p-1 border border-gray-300 rounded text-xs focus:ring-blue-500 font-bold text-gray-800 mb-1 ${dayPrefix}-sec bg-white">`;
    secHtml += `<option value="">-- Section --</option>`;
    mySections.forEach(sec => {
        const selected = (savedData.sec === sec) ? 'selected' : '';
        secHtml += `<option value="${sec}" ${selected}>${sec}</option>`;
    });
    secHtml += `</select>`;

    let subHtml = `<select class="w-full p-1 border border-gray-300 rounded text-xs focus:ring-blue-500 text-gray-600 ${dayPrefix}-sub bg-white">`;
    subHtml += `<option value="">-- Subject --</option>`;
    mySubjects.forEach(sub => {
        const selected = (savedData.sub === sub) ? 'selected' : '';
        subHtml += `<option value="${sub}" ${selected}>${sub}</option>`;
    });
    subHtml += `</select>`;

    return `<div class="flex flex-col">${secHtml}${subHtml}</div>`;
}

function buildCellView(savedData = {}) {
    if (!savedData.sec && !savedData.sub) {
        return `<span class="text-gray-300 text-xs italic">-</span>`;
    }
    return `
        <div class="flex flex-col bg-blue-50 border border-blue-100 p-2 rounded shadow-2xs">
            <span class="font-bold text-blue-900 text-xs">${savedData.sec || ''}</span>
            <span class="text-gray-600 text-[11px]">${savedData.sub || ''}</span>
        </div>
    `;
}

window.deleteRow = function(index) {
    const data = getTableDataFromDOM();
    data.splice(index, 1);
    localStorage.setItem('lessonReview_schedule_json', JSON.stringify(data));
    renderTable();
};

function getTableDataFromDOM() {
    const rows = document.querySelectorAll('#scheduleTableBody tr');
    const jsonData = [];
    rows.forEach(tr => {
        const timeInput = tr.querySelector('.time-input');
        if (!timeInput) return; // Skip if in view mode
        
        const time = timeInput.value.trim();
        const extractCell = (day) => {
            const sec = tr.querySelector(`.${day}-sec`).value;
            const sub = tr.querySelector(`.${day}-sub`).value;
            return { sec, sub };
        };

        jsonData.push({
            time,
            mon: extractCell('mon'),
            tue: extractCell('tue'),
            wed: extractCell('wed'),
            thu: extractCell('thu'),
            fri: extractCell('fri')
        });
    });
    return jsonData;
}

window.saveScheduleData = function() {
    const jsonData = getTableDataFromDOM();
    localStorage.setItem('lessonReview_schedule_json', JSON.stringify(jsonData));

    // Compile text string for AI Planner
    let rawTextForAI = "TEACHER WEEKLY SCHEDULE:\n\n";
    const dayData = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };
    const daysMap = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };

    jsonData.forEach(row => {
        if (!row.time) return;
        Object.keys(daysMap).forEach(key => {
            const cell = row[key];
            if (cell.sec && cell.sub) {
                dayData[daysMap[key]].push(`${row.time}: ${cell.sec} (${cell.sub})`);
            }
        });
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