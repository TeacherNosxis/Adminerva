import { auth } from "../core/firebase-core.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const SUPER_ADMIN_EMAIL = "testadmin@example.com".toLowerCase();
const TEACHER_EMAIL = "josephsixson@mcstayuman.edu.ph".toLowerCase();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const email = user.email.toLowerCase();

  // Allow both Super Admin and Teacher to manage the roster
  if (email !== SUPER_ADMIN_EMAIL && email !== TEACHER_EMAIL) {
    window.location.href = "student-dashboard.html";
  } else {
    const pageBody = document.getElementById("pageBody");
    if (pageBody) pageBody.classList.remove("hidden");
  }
});

// Trigger file input when dropzone is clicked
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("csvFile");

if (dropzone && fileInput) {
  dropzone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      dropzone.innerHTML = `<span class="text-3xl block mb-2">✅</span><p class="text-sm font-bold text-green-600">${e.target.files[0].name}</p>`;
    }
  });
}

const signOutBtn = document.getElementById("signOutBtn");
if (signOutBtn) {
  signOutBtn.addEventListener("click", () => {
    signOut(auth).then(() => (window.location.href = "login.html"));
  });
}
