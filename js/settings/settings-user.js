import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const configStr = localStorage.getItem("Adminerva_firebase_config");
if (!configStr) window.location.href = "login.html";

const app = initializeApp(JSON.parse(configStr));
const auth = getAuth(app);

// Security Check: Ensure only the teacher can view this page
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // NOTE: Update this to match your real teacher email
  const adminEmail = "testadmin@example.com".toLowerCase();

  if (user.email.toLowerCase() !== adminEmail) {
    // If a student tries to access the users page, kick them to their dashboard
    window.location.href = "student-dashboard.html";
  } else {
    document.getElementById("pageBody").classList.remove("hidden");
  }
});

// Trigger file input when dropzone is clicked
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("csvFile");

dropzone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    dropzone.innerHTML = `<span class="text-3xl block mb-2">✅</span><p class="text-sm font-bold text-green-600">${e.target.files[0].name}</p>`;
  }
});

document.getElementById("signOutBtn").addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});
