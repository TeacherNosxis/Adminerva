import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInAnonymously,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// IMPORTANT: Paste your actual Firebase config object here!
const configStr = localStorage.getItem("Adminerva_firebase_config");

if (!configStr) {
  const errorDiv = document.getElementById("authError");
  if (errorDiv) {
    errorDiv.textContent =
      "System offline: Firebase not configured. Please set up API keys in the Admin settings.";
    errorDiv.classList.remove("hidden");
  }
  throw new Error("Missing Firebase Configuration in localStorage.");
}

const firebaseConfig = JSON.parse(configStr);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Define your teacher email here for role-based routing
const adminEmail = "YOUR_TEACHER_EMAIL@example.com".toLowerCase();

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();
const errorDiv = document.getElementById("authError");

function routeUser(user) {
  const userEmail = user.email ? user.email.toLowerCase() : "";
  if (userEmail === adminEmail) {
    window.location.href = "reporeviewDashboard.html";
  } else {
    window.location.href = "student-dashboard.html";
  }
}

function showError(error) {
  errorDiv.textContent = error.message || "Failed to sign in.";
  errorDiv.classList.remove("hidden");
}

// Event Listeners
document.getElementById("githubBtn")?.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, githubProvider);
    routeUser(result.user);
  } catch (error) {
    showError(error);
  }
});

document.getElementById("googleBtn")?.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    routeUser(result.user);
  } catch (error) {
    showError(error);
  }
});

document.getElementById("anonBtn")?.addEventListener("click", async () => {
  try {
    // Hijacked button for dev testing with a hardcoded user
    const result = await signInWithEmailAndPassword(
      auth,
      "test1@g.com",
      "admin123",
    );
    routeUser(result.user);
  } catch (error) {
    showError(error);
  }
});
