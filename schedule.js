document.addEventListener('DOMContentLoaded', () => {
    loadSchedule();
});

// Creates a new flexible row in the table
window.addRow = function(time = '', mon = '', tue = '', wed = '', thu = '', fri = '') {
    const tbody = document.getElementById('scheduleTableBody');
    const tr = document.createElement('tr');
    
    // Using a group class so the delete button only shows when hovering over the row
    tr.className = "border-b hover:bg-gray-50 group transition";
    tr.innerHTML = `
        <td class="p-2 border-r bg-gray-50">
            <input type="text" class="w-full p-2 border border-gray-300 rounded text-sm focus:ring-blue-500 font-bold text-gray-700 text-center" placeholder="e.g. 12:40 - 1:30" value="${time}">
        </td>
        <td class="p-2 border-r"><textarea class="w-full p-2 border border-gray-200 rounded text-xs focus:ring-blue-500 mon-input" rows="2" placeholder="Subject / Room">${mon}</textarea></td>
        <td class="p-2 border-r"><textarea class="w-full p-2 border border-gray-200 rounded text-xs focus:ring-blue-500 tue-input" rows="2" placeholder="Subject / Room">${tue}</textarea></td>
        <td class="p-2 border-r"><textarea class="w-full p-2 border border-gray-200 rounded text-xs focus:ring-blue-500 wed-input" rows="2" placeholder="Subject / Room">${wed}</textarea></td>
        <td class="p-2 border-r"><textarea class="w-full p-2 border border-gray-200 rounded text-xs focus:ring-blue-500 thu-input" rows="2" placeholder="Subject / Room">${thu}</textarea></td>
        <td class="p-2 border-r"><textarea class="w-full p-2 border border-gray-200 rounded text-xs focus:ring-blue-500 fri-input" rows="2" placeholder="Subject / Room">${fri}</textarea></td>
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
        data.forEach(row => addRow(row.time, row.mon, row.tue, row.wed, row.thu, row.fri));
    }
    
    // Generate 3 empty rows by default if the schedule is totally empty
    if (document.getElementById('scheduleTableBody').children.length === 0) {
        addRow();
        addRow();
        addRow();
    }
}

window.saveSchedule = function() {
    const rows = document.querySelectorAll('#scheduleTableBody tr');
    const jsonData = []; // Used to rebuild the table UI
    
    let rawTextForAI = "TEACHER WEEKLY SCHEDULE:\n\n"; // Used to feed the AI
    const dayData = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };

    rows.forEach(tr => {
        // Grab values from the inputs in this specific row
        const time = tr.querySelector('input').value.trim();
        const mon = tr.querySelector('.mon-input').value.trim();
        const tue = tr.querySelector('.tue-input').value.trim();
        const wed = tr.querySelector('.wed-input').value.trim();
        const thu = tr.querySelector('.thu-input').value.trim();
        const fri = tr.querySelector('.fri-input').value.trim();
        
        jsonData.push({ time, mon, tue, wed, thu, fri });

        // Map the data into daily arrays for the AI to read clearly
        if (time) {
            if (mon) dayData.Monday.push(`${time}: ${mon}`);
            if (tue) dayData.Tuesday.push(`${time}: ${tue}`);
            if (wed) dayData.Wednesday.push(`${time}: ${wed}`);
            if (thu) dayData.Thursday.push(`${time}: ${thu}`);
            if (fri) dayData.Friday.push(`${time}: ${fri}`);
        }
    });

    // Format the daily arrays into a clean text block for the AI prompt
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    days.forEach(day => {
        if (dayData[day].length > 0) {
            rawTextForAI += `[${day}]\n`;
            dayData[day].forEach(entry => {
                rawTextForAI += `- ${entry}\n`;
            });
            rawTextForAI += `\n`;
        }
    });

    // Save the structured JSON to rebuild the table when you refresh
    localStorage.setItem('lessonReview_schedule_json', JSON.stringify(jsonData));
    
    // Save the formatted text string for the AI Planner to use!
    localStorage.setItem('lessonReview_schedule', rawTextForAI);
    
    // Show notification
    const toast = document.getElementById('toastNotification');
    toast.classList.remove('opacity-0');
    setTimeout(() => toast.classList.add('opacity-0'), 3000);
};