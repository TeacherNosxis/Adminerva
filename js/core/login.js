import { auth } from "./firebase-core.js";
import {
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const SUPER_ADMIN_EMAIL = "babaynike2013@gmail.com".toLowerCase();
const TEACHER_EMAIL = "josephsixson@mcstayuman.edu.ph".toLowerCase();

onAuthStateChanged(auth, (user) => {
  if (user) {
    const role = localStorage.getItem("Adminerva_Role") || "student";
    if (role === "student") window.location.href = "student-dashboard.html";
    else window.location.href = "reporeviewDashboard.html";
  }
});

const handleOAuthLogin = (provider) => {
  const errBox = document.getElementById("loginError");
  errBox.classList.add("hidden");

  signInWithPopup(auth, provider)
    .then((result) => {
      const email = result.user.email.toLowerCase();

      if (!email)
        throw new Error(
          "No email address provided by the authentication service.",
        );

      if (email === SUPER_ADMIN_EMAIL) {
        localStorage.setItem("Adminerva_Role", "superadmin");
        window.location.href = "reporeviewDashboard.html";
      } else if (email === TEACHER_EMAIL) {
        localStorage.setItem("Adminerva_Role", "teacher");
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

document
  .getElementById("googleLoginBtn")
  .addEventListener("click", () => handleOAuthLogin(new GoogleAuthProvider()));
document
  .getElementById("githubLoginBtn")
  .addEventListener("click", () => handleOAuthLogin(new GithubAuthProvider()));
