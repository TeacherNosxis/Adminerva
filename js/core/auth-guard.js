import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const configStr = localStorage.getItem("Adminerva_firebase_config");
const currentPath = window.location.pathname.toLowerCase();
const isLoginPage =
  currentPath.includes("login.html") || currentPath.includes("dev.html");

if (!configStr && !isLoginPage) {
  window.location.href = "login.html";
} else if (configStr) {
  const app = initializeApp(JSON.parse(configStr));
  const auth = getAuth(app);

  // 🚨 THE VAULT KEY: Hardcode your real Super Admin email here
  const SUPER_ADMIN_EMAIL = "YOUR_REAL_TEACHER_EMAIL@example.com".toLowerCase();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      if (!isLoginPage) window.location.href = "login.html";
      return;
    }

    const userEmail = user.email.toLowerCase();

    // Auto-assign Super Admin if emails match, otherwise rely on the login token
    let role = localStorage.getItem("Adminerva_Role") || "student";
    if (userEmail === SUPER_ADMIN_EMAIL) {
      role = "superadmin";
      localStorage.setItem("Adminerva_Role", "superadmin");
    }

    // --- ROLE-BASED ROUTING ENFORCEMENT ---

    // 1. Student Restrictions
    if (role === "student") {
      if (!currentPath.includes("student-") && !isLoginPage) {
        window.location.href = "student-dashboard.html";
      }
    }

    // 2. Standard Teacher Restrictions
    else if (role === "teacher") {
      if (
        currentPath.includes("student-") ||
        currentPath.includes("users.html") ||
        currentPath.includes("settings.html")
      ) {
        alert("Unauthorized: Administrator privileges required.");
        window.location.href = "reporeviewDashboard.html";
      }
    }

    // 3. Super Admin has unrestricted access everywhere

    // Security cleared: Show the page
    const pageBody = document.getElementById("pageBody");
    if (pageBody) pageBody.classList.remove("hidden");

    // Populate email in the top right if the element exists
    const emailDisplay = document.getElementById("userEmailDisplay");
    if (emailDisplay) emailDisplay.textContent = userEmail;
  });

  // Centralized Event Delegation for Sign Out
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "signOutBtn") {
      signOut(auth).then(() => {
        localStorage.removeItem("Adminerva_Role");
        window.location.href = "login.html";
      });
    }
  });
}
