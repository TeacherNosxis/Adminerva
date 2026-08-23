let mySections = [];
let mySubjects = [];

// Initialize data instantly
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadSchedule();
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
    
    alert("Dropdowns updated! Your grid will now reflect the new choices.");
    location.reload(); // Refresh to rebuild the existing dropdowns safely
};

// HTML Builder for the stacked dropdowns
function buildCell(dayPrefix, savedData = {}) {
    let secHtml = `<select class="w-full p-1 border border-gray-300 rounded text-xs focus:ring-blue-500 font-bold text-gray-800 mb-1 ${dayPrefix}-sec bg-gray-50">`;
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

window.addRow = function(data = { time: '', mon: {}, tue: {}, wed: {}, thu: {}, fri: {} }) {
    const tbody = document.getElementById('scheduleTableBody');
    const tr = document.createElement('tr');
    
    tr.className = "border-b hover:bg-gray-100 group transition";
    tr.innerHTML = `
        <td class="p-2 border-r bg-gray-50">
            <input type="text" class="w-full p-2 border border-gray-300 rounded text-sm focus:ring-blue-500 font-bold text-gray-700 text-center" placeholder="12:40 - 1:30" value="${data.time || ''}">
        </td>
        <td class="p-2 border-r align-top">${buildCell('mon', data.mon)}</td>
        <td class="p-2 border-r align-top">${buildCell('tue', data.tue)}</td>
        <td class="p-2 border-r align-top">${buildCell('wed', data.wed)}</td>
        <td class="p-2 border-r align-top">${buildCell('thu', data.thu)}</td>
        <td class="p-2 border-r align-top">${buildCell('fri', data.fri)}</td>
        <td class="p-2 text-center align-middle">
            <button onclick="this.closest('tr').remove()" class="text-red-400 hover:text-red-600 font-bold px-2 hidden group-hover:inline-block transition" title="Delete Row">✖</button>
        </td>
    `;
    tbody.appendChild(tr);
};

function loadSchedule() {
    const savedJson = localStorage.getItem('lessonReview_schedule_json');
    
    if (savedJson) {
        const data = JSON.parse(savedJson);
        data.forEach(row => addRow(row));
    } else {
        // Generate 3 empty rows by default
        addRow(); addRow(); addRow();
    }
}

window.saveSchedule = function() {
    const rows = document.querySelectorAll('#scheduleTableBody tr');
    const jsonData = []; 
    let rawTextForAI = "TEACHER WEEKLY SCHEDULE:\n\n"; 
    const dayData = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };

    rows.forEach(tr => {
        const time = tr.querySelector('input').value.trim();
        
        const extractCell = (day) => {
            const sec = tr.querySelector(`.${day}-sec`).value;
            const sub = tr.querySelector(`.${day}-sub`).value;
            return { sec, sub };
        };

        const mon = extractCell('mon');
        const tue = extractCell('tue');
        const wed = extractCell('wed');
        const thu = extractCell('thu');
        const fri = extractCell('fri');
        
        jsonData.push({ time, mon, tue, wed, thu, fri });

        // Map it beautifully for the AI (e.g. "12:40pm: St. Isidore (Comprog)")
        const formatForAi = (cell) => (cell.sec && cell.sub) ? `${cell.sec} (${cell.sub})` : null;

        if (time) {
            if (formatForAi(mon)) dayData.Monday.push(`${time}: ${formatForAi(mon)}`);
            if (formatForAi(tue)) dayData.Tuesday.push(`${time}: ${formatForAi(tue)}`);
            if (formatForAi(wed)) dayData.Wednesday.push(`${time}: ${formatForAi(wed)}`);
            if (formatForAi(thu)) dayData.Thursday.push(`${time}: ${formatForAi(thu)}`);
            if (formatForAi(fri)) dayData.Friday.push(`${time}: ${formatForAi(fri)}`);
        }
    });

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    days.forEach(day => {
        if (dayData[day].length > 0) {
            rawTextForAI += `[${day}]\n`;
            dayData[day].forEach(entry => rawTextForAI += `- ${entry}\n`);
            rawTextForAI += `\n`;
        }
    });

    localStorage.setItem('lessonReview_schedule_json', JSON.stringify(jsonData));
    localStorage.setItem('lessonReview_schedule', rawTextForAI);
    
    const toast = document.getElementById('toastNotification');
    if(toast) {
        toast.classList.remove('opacity-0');
        setTimeout(() => toast.classList.add('opacity-0'), 3000);
    }
};