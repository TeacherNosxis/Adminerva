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
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

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
      "teststudent@example.com",
      "password123",
    );
    routeUser(result.user);
  } catch (error) {
    showError(error);
  }
});
