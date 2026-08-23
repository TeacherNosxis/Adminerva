document.addEventListener('DOMContentLoaded', () => {
    loadSchedule();
});

function loadSchedule() {
    const savedSchedule = localStorage.getItem('lessonReview_schedule');
    if (savedSchedule) {
        document.getElementById('scheduleInput').value = savedSchedule;
    }
}

window.saveSchedule = function() {
    const scheduleText = document.getElementById('scheduleInput').value.trim();
    
    if (!scheduleText) {
        return alert("Cannot save an empty schedule.");
    }

    // Save to browser's local storage
    localStorage.setItem('lessonReview_schedule', scheduleText);
    
    // Show a quick success toast
    const toast = document.getElementById('toastNotification');
    toast.classList.remove('opacity-0');
    
    setTimeout(() => {
        toast.classList.add('opacity-0');
    }, 3000);
};