import { auth } from "./firebase-core.js";
import {
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// 🚨 HARDCODE YOUR SUPER ADMIN EMAIL
const SUPER_ADMIN_EMAIL = "YOUR_REAL_TEACHER_EMAIL@example.com".toLowerCase();

// Redirect automatically if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    const role = localStorage.getItem("Adminerva_Role") || "student";
    if (role === "student") window.location.href = "student-dashboard.html";
    else window.location.href = "reporeviewDashboard.html";
  }
});

// Universal handler for both Google and GitHub OAuth
const handleOAuthLogin = (provider) => {
  const errBox = document.getElementById("loginError");
  errBox.classList.add("hidden");

  signInWithPopup(auth, provider)
    .then((result) => {
      const email = result.user.email;

      // GitHub sometimes hides emails depending on the user's privacy settings
      if (!email) {
        throw new Error(
          "No email address provided by the authentication service. Please check your GitHub privacy settings.",
        );
      }

      // Assign RBAC Role securely upon login
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
    });
};

document.getElementById("googleLoginBtn").addEventListener("click", () => {
  handleOAuthLogin(new GoogleAuthProvider());
});

document.getElementById("githubLoginBtn").addEventListener("click", () => {
  handleOAuthLogin(new GithubAuthProvider());
});
