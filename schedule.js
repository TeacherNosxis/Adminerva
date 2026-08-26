import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let db = null;
let mySections = [];
let mySubjects = [];
let myEvents = [];
let isEditing = false; 

// --- CLOUD SYNC HELPERS ---
window.showLoader = function(msg = "Syncing...") {
    document.getElementById('loaderMessage').textContent = msg;
    document.getElementById('globalLoader').classList.replace('hidden', 'flex');
};
window.hideLoader = function() {
    document.getElementById('globalLoader').classList.replace('flex', 'hidden');
};

document.addEventListener('DOMContentLoaded', async () => {
    loadConfig();
    initFirebase();
});

// --- FIREBASE INITIALIZATION & FETCH ---
async function initFirebase() {
    const configStr = localStorage.getItem('repoReview_firebase_config');
    if (!configStr) {
        alert("Firebase is not configured! Please configure it in Global Settings.");
        renderTable();
        return;
    }

    try {
        const firebaseConfig = JSON.parse(configStr);
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        
        await fetchScheduleFromCloud();
    } catch (e) {
        console.error("Firebase Initialization Failed:", e);
        alert("Failed to connect to Firebase. Using local cache.");
        renderTable();
    }
}

async function fetchScheduleFromCloud() {
    if (!db) return;
    window.showLoader("Loading schedule from cloud...");
    try {
        const docRef = doc(db, "app_config", "master_schedule");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            localStorage.setItem('lessonReview_schedule_json', data.json_data || "[]");
            localStorage.setItem('lessonReview_schedule', data.raw_text || "");
        }
    } catch (e) {
        console.error("Error fetching schedule:", e);
    } finally {
        window.hideLoader();
        renderTable();
    }
}

// --- MODAL & CONFIG LOGIC ---
window.openSettingsModal = function() {
    document.getElementById('configSections').value = localStorage.getItem('lessonReview_sections') || "";
    document.getElementById('configSubjects').value = localStorage.getItem('lessonReview_subjects') || "";
    document.getElementById('configEvents').value = localStorage.getItem('lessonReview_events') || "";
    
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeSettingsModal = function() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
};

window.saveSettingsConfig = async function() {
    localStorage.setItem('lessonReview_sections', document.getElementById('configSections').value);
    localStorage.setItem('lessonReview_subjects', document.getElementById('configSubjects').value);
    localStorage.setItem('lessonReview_events', document.getElementById('configEvents').value);
    
    loadConfig();
    if(isEditing) await saveScheduleData(true); 
    renderTable();
    closeSettingsModal();
};

function loadConfig() {
    mySections = (localStorage.getItem('lessonReview_sections') || "").split(',').map(s => s.trim()).filter(s => s !== "");
    mySubjects = (localStorage.getItem('lessonReview_subjects') || "").split(',').map(s => s.trim()).filter(s => s !== "");
    myEvents = (localStorage.getItem('lessonReview_events') || "").split(',').map(s => s.trim()).filter(s => s !== "");
}

// --- EDIT/LOCK ENGINE ---
window.toggleEditMode = async function() {
    if (isEditing) {
        const saveSuccess = await saveScheduleData();
        if (!saveSuccess) return; 

        isEditing = false;
        document.getElementById('editSaveBtn').innerHTML = '<span>✏️</span> Edit Schedule';
        document.getElementById('editSaveBtn').className = 'bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition shadow-sm flex items-center gap-2';
        document.getElementById('modeBadge').className = 'bg-gray-200 text-gray-700 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider';
        document.getElementById('modeBadge').textContent = '🔒 Read-Only';
        
        document.getElementById('addClassBtn').classList.add('hidden');
        document.getElementById('addEventBtn').classList.add('hidden');
    } else {
        isEditing = true;
        document.getElementById('editSaveBtn').innerHTML = '<span>💾</span> Save to Cloud';
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

// --- TIME CALCULATIONS ---
window.autoFillEndTime = function(startInput) {
    if (!startInput.value) return;
    const row = startInput.closest('tr');
    
    // Target the actual flatpickr instance element, not just the visual input
    const endInput = row.querySelector('.time-end');
    
    const [hours, minutes] = startInput.value.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes + 50, 0, 0); // Adds exactly 50 mins
    
    const endHours = String(date.getHours()).padStart(2, '0');
    const endMinutes = String(date.getMinutes()).padStart(2, '0');
    const finalTime = `${endHours}:${endMinutes}`;
    
    endInput.value = finalTime;
    
    // Command the new Flatpickr UI to visually update
    if (endInput._flatpickr) {
        endInput._flatpickr.setDate(finalTime);
    }
};

function formatTimeToAMPM(time24) {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${hours}:${m} ${ampm}`;
}

// --- TABLE RENDERING & DATA MANAGEMENT ---
window.addRow = function(type) {
    const savedJson = getTableDataFromDOM();
    let inheritedStartTime = '';
    let inheritedEndTime = '';

    const allEndInputs = document.querySelectorAll('.time-end');
    if (allEndInputs.length > 0) {
        const lastEndInput = allEndInputs[allEndInputs.length - 1];
        if (lastEndInput && lastEndInput.value) {
            inheritedStartTime = lastEndInput.value;
        }
    } 
    
    if (!inheritedStartTime && savedJson.length > 0) {
        const lastRow = savedJson[savedJson.length - 1];
        if (lastRow.endTime) {
            inheritedStartTime = lastRow.endTime;
        }
    }

    if (inheritedStartTime) {
        const [hours, minutes] = inheritedStartTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes + 50, 0, 0);
        
        const endHours = String(date.getHours()).padStart(2, '0');
        const endMinutes = String(date.getMinutes()).padStart(2, '0');
        inheritedEndTime = `${endHours}:${endMinutes}`;
    }

    if (type === 'class') {
        savedJson.push({ type: 'class', startTime: inheritedStartTime, endTime: inheritedEndTime, mon: {sec:'', sub:''}, tue: {sec:'', sub:''}, wed: {sec:'', sub:''}, thu: {sec:'', sub:''}, fri: {sec:'', sub:''} });
    } else {
        savedJson.push({ type: 'constant', startTime: inheritedStartTime, endTime: inheritedEndTime, eventName: '' });
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
        tr.dataset.rowType = row.type;

        // CRITICAL FIX: Changed type="time" to type="text" to bypass Chrome's ugly native picker.
        // Flatpickr will automatically attach to these text inputs.
        const timeInputHtml = isEditing 
            ? `<div class="flex flex-col gap-1 items-center justify-center">
                   <input type="text" class="time-start w-full p-1 border border-gray-300 rounded text-xs focus:ring-blue-500 font-bold text-gray-700 text-center cursor-pointer bg-white" value="${row.startTime || ''}" placeholder="Start Time">
                   <span class="text-[9px] text-gray-400 font-bold uppercase">To</span>
                   <input type="text" class="time-end w-full p-1 border border-gray-300 rounded text-xs focus:ring-blue-500 font-bold text-gray-700 text-center cursor-pointer bg-white" value="${row.endTime || ''}" placeholder="End Time">
               </div>`
            : `<div class="flex flex-col items-center justify-center text-center">
                   <span class="font-bold text-gray-800 text-xs">${formatTimeToAMPM(row.startTime) || '<span class="text-gray-300">--</span>'}</span>
                   <span class="text-[9px] text-gray-400 font-bold uppercase my-0.5">To</span>
                   <span class="font-bold text-gray-800 text-xs">${formatTimeToAMPM(row.endTime) || '<span class="text-gray-300">--</span>'}</span>
               </div>`;

        if (row.type === 'constant') {
            if (isEditing) {
                let options = `<option value="">-- Select Event --</option>`;
                myEvents.forEach(e => { options += `<option value="${e}" ${row.eventName === e ? 'selected' : ''}>${e}</option>`; });
                tr.innerHTML = `
                    <td class="p-2 border-r bg-gray-50 align-middle text-center w-[15%]">${timeInputHtml}</td>
                    <td colspan="5" class="p-2 border-r align-middle bg-amber-50 border-y border-amber-200">
                        <select class="event-input w-full p-2 border border-amber-300 rounded text-sm focus:ring-amber-500 font-bold text-amber-800 text-center bg-white">${options}</select>
                    </td>
                    <td class="p-2 text-center align-middle"><button onclick="deleteRow(${rowIndex})" class="text-red-400 hover:text-red-600 font-bold px-2 transition">✖</button></td>
                `;
            } else {
                tr.innerHTML = `
                    <td class="p-3 border-r bg-gray-50 text-center align-middle w-[15%]">${timeInputHtml}</td>
                    <td colspan="5" class="p-3 border-r align-middle bg-amber-50 border-y border-amber-200 text-center shadow-inner">
                        <span class="font-extrabold text-amber-700 text-sm uppercase tracking-widest">${row.eventName || 'UNASSIGNED EVENT'}</span>
                    </td>
                    <td class="p-3 text-center align-middle text-gray-300">-</td>
                `;
            }
        } else {
            if (isEditing) {
                tr.innerHTML = `
                    <td class="p-2 border-r bg-gray-50 align-middle text-center w-[15%]">${timeInputHtml}</td>
                    <td class="p-2 border-r align-top">${buildCellEdit('mon', row.mon)}</td>
                    <td class="p-2 border-r align-top">${buildCellEdit('tue', row.tue)}</td>
                    <td class="p-2 border-r align-top">${buildCellEdit('wed', row.wed)}</td>
                    <td class="p-2 border-r align-top">${buildCellEdit('thu', row.thu)}</td>
                    <td class="p-2 border-r align-top">${buildCellEdit('fri', row.fri)}</td>
                    <td class="p-2 text-center align-middle"><button onclick="deleteRow(${rowIndex})" class="text-red-400 hover:text-red-600 font-bold px-2 transition">✖</button></td>
                `;
            } else {
                tr.innerHTML = `
                    <td class="p-3 border-r bg-gray-50 text-center align-middle w-[15%]">${timeInputHtml}</td>
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

    // --- FLATPICKR INITIALIZATION ---
    // This runs after all rows are drawn on the screen
    if (isEditing) {
        flatpickr(".time-start", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i", // Under-the-hood 24h format for saving
            altInput: true,
            altFormat: "h:i K", // Visual 12h AM/PM format for the user
            minuteIncrement: 5, // STRICTLY forces 5-minute jumps!
            onChange: function(selectedDates, dateStr, instance) {
                window.autoFillEndTime(instance.element);
            }
        });
        
        flatpickr(".time-end", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            altInput: true,
            altFormat: "h:i K",
            minuteIncrement: 5 // STRICTLY forces 5-minute jumps!
        });
    }
}

function buildCellEdit(dayPrefix, savedData = {}) {
    let secHtml = `<select class="w-full p-1 border border-gray-300 rounded text-xs focus:ring-blue-500 font-bold text-gray-800 mb-1 ${dayPrefix}-sec bg-white"><option value="">-- Section --</option>${mySections.map(s => `<option value="${s}" ${savedData.sec === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
    let subHtml = `<select class="w-full p-1 border border-gray-300 rounded text-xs focus:ring-blue-500 text-gray-600 ${dayPrefix}-sub bg-white"><option value="">-- Subject --</option>${mySubjects.map(s => `<option value="${s}" ${savedData.sub === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
    let eventHtml = `<select class="w-full p-1 border border-amber-300 rounded text-[10px] focus:ring-amber-500 text-amber-700 bg-amber-50 mt-1 ${dayPrefix}-evt"><option value="">-- Periodic Event --</option>${myEvents.map(e => `<option value="${e}" ${savedData.evt === e ? 'selected' : ''}>${e}</option>`).join('')}</select>`;
    return `<div class="flex flex-col">${secHtml}${subHtml}${eventHtml}</div>`;
}

function buildCellView(savedData = {}) {
    if (savedData.evt) return `<div class="flex flex-col bg-amber-50 border border-amber-200 p-2 rounded shadow-sm text-center h-full justify-center"><span class="font-extrabold text-amber-700 text-[10px] uppercase tracking-wider">${savedData.evt}</span></div>`;
    if (!savedData.sec && !savedData.sub) return `<span class="text-gray-300 text-xs italic">-</span>`;
    return `<div class="flex flex-col bg-blue-50 border border-blue-100 p-2 rounded shadow-sm"><span class="font-bold text-blue-900 text-xs">${savedData.sec || ''}</span><span class="text-gray-600 text-[11px]">${savedData.sub || ''}</span></div>`;
}

function getTableDataFromDOM() {
    const rows = document.querySelectorAll('#scheduleTableBody tr');
    const jsonData = [];
    rows.forEach(tr => {
        const type = tr.dataset.rowType;
        const startInput = tr.querySelector('.time-start');
        const endInput = tr.querySelector('.time-end');
        if (!startInput) return; 

        const startTime = startInput.value;
        const endTime = endInput.value;

        if (type === 'constant') {
            jsonData.push({ type: 'constant', startTime, endTime, eventName: tr.querySelector('.event-input').value });
        } else {
            const extractCell = (day) => ({
                sec: tr.querySelector(`.${day}-sec`).value,
                sub: tr.querySelector(`.${day}-sub`).value,
                evt: tr.querySelector(`.${day}-evt`).value
            });
            jsonData.push({
                type: 'class', startTime, endTime,
                mon: extractCell('mon'), tue: extractCell('tue'), wed: extractCell('wed'), thu: extractCell('thu'), fri: extractCell('fri')
            });
        }
    });
    return jsonData;
}

window.saveScheduleData = async function(bypassValidation = false) {
    const jsonData = getTableDataFromDOM();

    if (!bypassValidation) {
        const intervals = [];
        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row.startTime || !row.endTime) {
                alert(`Row ${i + 1} is missing a start or end time.`);
                return false;
            }
            
            const startMins = Number(row.startTime.split(':')[0]) * 60 + Number(row.startTime.split(':')[1]);
            const endMins = Number(row.endTime.split(':')[0]) * 60 + Number(row.endTime.split(':')[1]);

            if (startMins >= endMins) {
                alert(`Row ${i + 1} has an invalid time (End time must be after Start time).`);
                return false;
            }
            intervals.push({ start: startMins, end: endMins, rowNum: i + 1 });
        }

        intervals.sort((a, b) => a.start - b.start);
        
        for (let i = 0; i < intervals.length - 1; i++) {
            if (intervals[i].end > intervals[i + 1].start) {
                alert(`🚨 Time Overlap Detected!\nRow ${intervals[i].rowNum} conflicts with Row ${intervals[i + 1].rowNum}. Please fix this before saving.`);
                return false;
            }
        }
    }

    // FORMAT FOR THE AI
    let rawTextForAI = "TEACHER WEEKLY SCHEDULE:\n\n";
    const dayData = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };
    const daysMap = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };

    jsonData.forEach(row => {
        if (!row.startTime) return;
        const timeBlock = `${formatTimeToAMPM(row.startTime)} - ${formatTimeToAMPM(row.endTime)}`;

        if (row.type === 'constant' && row.eventName) {
            const eventStr = `[EVENT: ${row.eventName}]`;
            Object.values(daysMap).forEach(day => dayData[day].push(`${timeBlock}: ${eventStr}`));
        } else if (row.type === 'class') {
            Object.keys(daysMap).forEach(key => {
                const cell = row[key];
                let cellText = null;
                if (cell.evt) cellText = `[EVENT: ${cell.evt}]`;
                else if (cell.sec && cell.sub) cellText = `${cell.sec} (${cell.sub})`;

                if (cellText) dayData[daysMap[key]].push(`${timeBlock}: ${cellText}`);
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

    // Save locally
    localStorage.setItem('lessonReview_schedule_json', JSON.stringify(jsonData));
    localStorage.setItem('lessonReview_schedule', rawTextForAI);

    // Save to Firebase (Cloud Sync)
    if (!db) {
        alert("Saved locally, but Firebase is not connected. Check Global Settings to enable cloud sync.");
        return true; 
    }

    window.showLoader("Saving schedule to Firebase...");
    try {
        const docRef = doc(db, "app_config", "master_schedule");
        await setDoc(docRef, {
            json_data: JSON.stringify(jsonData),
            raw_text: rawTextForAI,
            last_updated: new Date().toISOString()
        });
    } catch (e) {
        console.error("Firebase save error:", e);
        alert("Error saving to cloud. Data saved locally only. " + e.message);
    } finally {
        window.hideLoader();
    }

    return true; 
};