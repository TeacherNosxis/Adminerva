import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const adminEmail = "YOUR_TEACHER_EMAIL@example.com".toLowerCase(); // UPDATE THIS

// UI Elements
const loginBlock = document.getElementById("loginBlock");
const setupBlock = document.getElementById("setupBlock");
const subtitleText = document.getElementById("subtitleText");
const errorDiv = document.getElementById("authError");

function showError(error) {
  let friendlyMessage = "An unexpected error occurred. Please try again.";

  // Check if Firebase returned a specific error code
  if (error && error.code) {
    switch (error.code) {
      case "auth/account-exists-with-different-credential":
        friendlyMessage =
          "An account already exists with this email address, but it is linked to a different provider. Please use the button you originally signed up with (e.g., GitHub instead of Google).";
        break;
      case "auth/popup-closed-by-user":
        friendlyMessage =
          "The login window was closed before finishing. Please try again.";
        break;
      case "auth/cancelled-popup-request":
        friendlyMessage =
          "Multiple login attempts detected. Please wait for the current one to finish.";
        break;
      case "auth/network-request-failed":
        friendlyMessage =
          "Network connection failed. Please check your internet and try again.";
        break;
      case "auth/invalid-credential":
        friendlyMessage = "Invalid login credentials provided.";
        break;
      default:
        // Fallback for any other unexpected Firebase errors
        friendlyMessage = `Authentication failed: ${error.message}`;
    }
  } else if (typeof error === "string") {
    friendlyMessage = error;
  }

  errorDiv.textContent = friendlyMessage;
  errorDiv.classList.remove("hidden");
}

function routeUser(user) {
  const userEmail = user.email ? user.email.toLowerCase() : "";
  if (userEmail === adminEmail) {
    window.location.href = "reporeviewDashboard.html";
  } else {
    window.location.href = "student-dashboard.html";
  }
}

// 1. The Lockout Preventer: Check for credentials before doing anything else
const configStr = localStorage.getItem("Adminerva_firebase_config");

if (!configStr) {
  // Keys are missing. Switch to Setup Mode.
  loginBlock.classList.add("hidden");
  setupBlock.classList.remove("hidden");
  subtitleText.textContent = "First-time device setup required.";

  document.getElementById("saveConfigBtn").addEventListener("click", () => {
    const inputStr = document
      .getElementById("firebaseConfigInput")
      .value.trim();
    try {
      // Validate it's actually JSON before saving
      JSON.parse(inputStr);
      localStorage.setItem("Adminerva_firebase_config", inputStr);
      window.location.reload(); // Reload to boot up Firebase normally
    } catch (err) {
      showError(error);
    }
  });
} else {
  // Keys exist! Boot up Firebase and attach the login listeners.
  try {
    const firebaseConfig = JSON.parse(configStr);
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    const googleProvider = new GoogleAuthProvider();
    const githubProvider = new GithubAuthProvider();

    document
      .getElementById("githubBtn")
      ?.addEventListener("click", async () => {
        try {
          const result = await signInWithPopup(auth, githubProvider);
          routeUser(result.user);
        } catch (error) {
          showError(error);
        }
      });

    document
      .getElementById("googleBtn")
      ?.addEventListener("click", async () => {
        try {
          const result = await signInWithPopup(auth, googleProvider);
          routeUser(result.user);
        } catch (error) {
          showError(error);
        }
      });

    document.getElementById("anonBtn")?.addEventListener("click", async () => {
      try {
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
  } catch (e) {
    // If the saved JSON is corrupted, clear it and force a setup next reload
    localStorage.removeItem("Adminerva_firebase_config");
    showError(error);
  }
}
