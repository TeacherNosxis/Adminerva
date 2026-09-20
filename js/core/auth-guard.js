import { auth } from "./firebase-core.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const currentPath = window.location.pathname.toLowerCase();
const isLoginPage =
  currentPath.includes("login.html") || currentPath.includes("dev.html");

// 🚨 TIER 1: The Master Key (Can access system API settings)
const SUPER_ADMIN_EMAIL = "testadmin@example.com".toLowerCase();

// 🚨 TIER 2: The Instructor (Can access grading and rosters)
const TEACHER_EMAIL = "josephsixson@mcstayuman.edu.ph".toLowerCase();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    if (!isLoginPage) window.location.href = "login.html";
    return;
  }

  const userEmail = user.email.toLowerCase();

  // Determine their actual hardware role
  let actualRole = "student";
  if (userEmail === SUPER_ADMIN_EMAIL) actualRole = "superadmin";
  else if (userEmail === TEACHER_EMAIL) actualRole = "teacher";

  let activeRole = localStorage.getItem("Adminerva_Role") || actualRole;

  // --- THE SHAPE-SHIFTER FIX ---
  // Allow both Super Admins and Teachers to simulate lower roles
  if (actualRole === "superadmin" || actualRole === "teacher") {
    const mockRole = localStorage.getItem("Adminerva_Mock_Role");
    if (mockRole) {
      activeRole = mockRole;
    } else {
      activeRole = actualRole;
    }
    localStorage.setItem("Adminerva_Role", activeRole);
  }

  // --- ROLE-BASED ROUTING ENFORCEMENT ---
  if (
    activeRole === "student" &&
    !currentPath.includes("student-") &&
    !isLoginPage
  ) {
    window.location.href = "student-dashboard.html";
  } else if (
    activeRole === "teacher" &&
    currentPath.includes("settings.html")
  ) {
    // Block teachers from the system API keys page, but let them into the roster directory
    alert(
      "Unauthorized: Super Administrator privileges required for Global Settings.",
    );
    window.location.href = "reporeviewDashboard.html";
  }

  // Security cleared: Show the page
  const pageBody = document.getElementById("pageBody");
  if (pageBody) pageBody.classList.remove("hidden");

  // Display email and indicate if a simulation is active
  const emailDisplay = document.getElementById("userEmailDisplay");
  if (emailDisplay) {
    const mockNotice = localStorage.getItem("Adminerva_Mock_Role")
      ? ` (Simulating: ${activeRole})`
      : "";
    emailDisplay.textContent = userEmail + mockNotice;
  }
});

// Centralized Sign Out
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "signOutBtn") {
    signOut(auth).then(() => {
      localStorage.removeItem("Adminerva_Role");
      localStorage.removeItem("Adminerva_Mock_Role");
      window.location.href = "login.html";
    });
  }
});
