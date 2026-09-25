import { auth, db } from "./firebase-core.js";
import {
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const SUPER_ADMIN_EMAIL = "babaynike2013@gmail.com".toLowerCase();
const TEACHER_EMAIL = "josephsixson@mcstayuman.edu.ph".toLowerCase();

// 1. Check for URL errors immediately when the page loads
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const errorType = urlParams.get("error");

  if (errorType === "unauthorized") {
    const errBox = document.getElementById("loginErrorBox");
    if (errBox) errBox.classList.remove("hidden");

    // Clean the URL so the error doesn't persist if they refresh
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

// 2. Handle the login process and whitelist verification
const handleOAuthLogin = async (provider) => {
  const errBox = document.getElementById("loginErrorBox");
  if (errBox) errBox.classList.add("hidden");

  try {
    const result = await signInWithPopup(auth, provider);
    const email = result.user.email.toLowerCase();

    if (!email) {
      throw new Error(
        "No email address provided by the authentication service.",
      );
    }

    // The Gatekeeper: Check the database before any routing occurs
    if (email !== SUPER_ADMIN_EMAIL && email !== TEACHER_EMAIL) {
      const studentQuery = query(
        collection(db, "students"),
        where("email", "==", email),
      );
      const studentSnap = await getDocs(studentQuery);

      const teacherQuery = query(
        collection(db, "teachers"),
        where("email", "==", email),
      );
      const teacherSnap = await getDocs(teacherQuery);

      if (studentSnap.empty && teacherSnap.empty) {
        // Unauthorized. Terminate session instantly.
        await signOut(auth);

        // Show error immediately without needing to reload the page
        if (errBox) {
          errBox.innerHTML = `
                    <div class="text-red-500 text-3xl mb-2">⛔</div>
                    <h3 class="text-red-400 font-black text-lg uppercase tracking-wider mb-1">Access Denied</h3>
                    <p class="text-slate-300 text-sm font-medium mb-4">Your email address is not recognized by the system.</p>
                    <div class="bg-slate-900/80 p-4 rounded text-xs text-slate-400 border border-slate-700/50 text-left">
                        <span class="block text-slate-200 font-bold mb-1">Required Action:</span>
                        Contact your Instructor or the System Administrator to have your official email added to the Adminerva class list before attempting to log in again.
                    </div>
                `;
          errBox.classList.remove("hidden");
        }
        return;
      }
    }

    // Authorized User: Route to the correct dashboard
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
  } catch (error) {
    if (errBox) {
      errBox.innerHTML = `
            <div class="text-red-500 text-3xl mb-2">⛔</div>
            <h3 class="text-red-400 font-black text-lg uppercase tracking-wider mb-1">Login Failed</h3>
            <p class="text-slate-300 text-sm font-medium mb-4">${error.message.replace("Firebase:", "").trim()}</p>
        `;
      errBox.classList.remove("hidden");
    }
  }
};

document
  .getElementById("googleLoginBtn")
  .addEventListener("click", () => handleOAuthLogin(new GoogleAuthProvider()));
document
  .getElementById("githubLoginBtn")
  .addEventListener("click", () => handleOAuthLogin(new GithubAuthProvider()));
