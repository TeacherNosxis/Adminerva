// js/core/login.js
import { auth } from "./firebase-core.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const SUPER_ADMIN_EMAIL = "YOUR_REAL_TEACHER_EMAIL@example.com".toLowerCase();

onAuthStateChanged(auth, (user) => {
  if (user) {
    const role = localStorage.getItem("Adminerva_Role") || "student";
    if (role === "student") window.location.href = "student-dashboard.html";
    else window.location.href = "reporeviewDashboard.html";
  }
});

document.getElementById("loginBtn").addEventListener("click", () => {
  const email = document.getElementById("emailInput").value.trim();
  const pass = document.getElementById("passwordInput").value.trim();
  const errBox = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");

  if (!email || !pass) return;

  btn.textContent = "Authenticating...";
  btn.disabled = true;
  errBox.classList.add("hidden");

  signInWithEmailAndPassword(auth, email, pass)
    .then(() => {
      if (email.toLowerCase() === SUPER_ADMIN_EMAIL) {
        localStorage.setItem("Adminerva_Role", "superadmin");
        window.location.href = "reporeviewDashboard.html";
      } else {
        localStorage.setItem("Adminerva_Role", "student");
        window.location.href = "student-dashboard.html";
      }
    })
    .catch((error) => {
      errBox.textContent = error.message.replace("Firebase:", "").trim();
      errBox.classList.remove("hidden");
      btn.textContent = "Secure Sign In";
      btn.disabled = false;
    });
});
