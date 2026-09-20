// js/core/auth-guard.js
import { auth } from "./firebase-core.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const currentPath = window.location.pathname.toLowerCase();
const isLoginPage =
  currentPath.includes("login.html") || currentPath.includes("dev.html");

// 🚨 THE VAULT KEY: Hardcode your real Super Admin email here
const SUPER_ADMIN_EMAIL = "YOUR_REAL_TEACHER_EMAIL@example.com".toLowerCase();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    if (!isLoginPage) window.location.href = "login.html";
    return;
  }

  const userEmail = user.email.toLowerCase();

  let role = localStorage.getItem("Adminerva_Role") || "student";
  if (userEmail === SUPER_ADMIN_EMAIL) {
    role = "superadmin";
    localStorage.setItem("Adminerva_Role", "superadmin");
  }

  // --- ROLE-BASED ROUTING ENFORCEMENT ---
  if (role === "student" && !currentPath.includes("student-") && !isLoginPage) {
    window.location.href = "student-dashboard.html";
  } else if (
    role === "teacher" &&
    (currentPath.includes("student-") ||
      currentPath.includes("users.html") ||
      currentPath.includes("settings.html"))
  ) {
    alert("Unauthorized: Administrator privileges required.");
    window.location.href = "reporeviewDashboard.html";
  }

  // Security cleared: Show the page
  const pageBody = document.getElementById("pageBody");
  if (pageBody) pageBody.classList.remove("hidden");

  const emailDisplay = document.getElementById("userEmailDisplay");
  if (emailDisplay) emailDisplay.textContent = userEmail;
});

// Centralized Sign Out
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "signOutBtn") {
    signOut(auth).then(() => {
      localStorage.removeItem("Adminerva_Role");
      window.location.href = "login.html";
    });
  }
});
