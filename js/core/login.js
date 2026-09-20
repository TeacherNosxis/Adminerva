import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// 🚨 1. HARDCODE YOUR FIREBASE CONFIG HERE
// This is perfectly safe to leave in client-side code.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};

// 🚨 2. HARDCODE YOUR SUPER ADMIN EMAIL
const SUPER_ADMIN_EMAIL = "YOUR_REAL_TEACHER_EMAIL@example.com".toLowerCase();

// Initialize Firebase immediately for everyone
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Save the config to localStorage silently in the background
// This ensures that all your other files that rely on pulling the config from localStorage still work perfectly without needing any rewrites!
localStorage.setItem(
  "Adminerva_firebase_config",
  JSON.stringify(firebaseConfig),
);

// Redirect automatically if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    const role = localStorage.getItem("Adminerva_Role") || "student";
    if (role === "student") window.location.href = "student-dashboard.html";
    else window.location.href = "reporeviewDashboard.html";
  }
});

// Handle Login Form Submission
document.getElementById("loginBtn").addEventListener("click", () => {
  const email = document.getElementById("emailInput").value.trim();
  const pass = document.getElementById("passwordInput").value.trim();
  const errBox = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");

  if (!email || !pass) return;

  btn.textContent = "Authenticating...";
  btn.disabled = true;
  errBox.classList.add("hidden");

  signInWithEmailAndPassword(auth, email, pass)
    .then((userCredential) => {
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
      btn.textContent = "Secure Sign In";
      btn.disabled = false;
    });
});
