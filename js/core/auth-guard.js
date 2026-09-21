import { auth } from "./firebase-core.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const currentPath = window.location.pathname.toLowerCase();
const isLoginPage = currentPath.includes("login.html");

// 🚨 TIER 1: The Master Key (Can access system API settings)
const SUPER_ADMIN_EMAIL = "babaynike2013@gmail.com".toLowerCase();

// 🚨 TIER 2: The Instructor (Can access grading and rosters)
const TEACHER_EMAIL = "josephsixson@mcstayuman.edu.ph".toLowerCase();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    if (!isLoginPage) window.location.href = "login.html";
    return;
  }

  const userEmail = user.email.toLowerCase();

  // 1. Determine absolute hardware role based strictly on the verified email
  let actualRole = "student";
  if (userEmail === SUPER_ADMIN_EMAIL) actualRole = "superadmin";
  else if (userEmail === TEACHER_EMAIL) actualRole = "teacher";

  let activeRole = actualRole;

  // 2. The Shape-Shifter Logic (ONLY permitted for authorized admins/teachers)
  if (actualRole === "superadmin" || actualRole === "teacher") {
    const mockRole = localStorage.getItem("Adminerva_Mock_Role");
    if (mockRole) {
      activeRole = mockRole;
    }
    localStorage.setItem("Adminerva_Role", activeRole);
  } else {
    // 🔥 ANTI-HACK MEASURE: Force students back to their assigned role
    // This overwrites any attempts to manually change localStorage to "teacher"
    localStorage.setItem("Adminerva_Role", "student");
    localStorage.removeItem("Adminerva_Mock_Role");
    activeRole = "student";
  }

  // 3. Strict Routing Enforcement
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
    alert(
      "Unauthorized: Super Administrator privileges required for Global Settings.",
    );
    window.location.href = "reporeviewDashboard.html";
  }

  // 4. Security cleared: Display the UI
  const pageBody = document.getElementById("pageBody");
  if (pageBody) pageBody.classList.remove("hidden");

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
