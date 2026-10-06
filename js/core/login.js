import { db, auth } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  signOut,
  GithubAuthProvider,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const SUPER_ADMIN_EMAIL = "babaynike2013@gmail.com".toLowerCase();
const TEACHER_EMAIL = "josephsixson@mcstayuman.edu.ph".toLowerCase();
const errBox = document.getElementById("loginErrorBox");

// ==========================================
// UI STATE MANAGERS
// ==========================================
const showError = (title, message) => {
  if (!errBox) return;
  errBox.innerHTML = `
    <div class="text-red-500 text-3xl mb-2">⛔</div>
    <h3 class="text-red-400 font-black text-lg uppercase tracking-wider mb-1">${title}</h3>
    <p class="text-slate-300 text-sm font-medium mb-4">${message}</p>
  `;
  errBox.classList.remove("hidden");
  resetButtons();
};

const resetButtons = () => {
  const gBtn = document.getElementById("googleLoginBtn");
  const ghBtn = document.getElementById("githubLoginBtn");
  if (gBtn) { gBtn.disabled = false; gBtn.innerHTML = gBtn.dataset.originalHtml; }
  if (ghBtn) { ghBtn.disabled = false; ghBtn.innerHTML = ghBtn.dataset.originalHtml; }
};

const setLoading = (btnId, text) => {
  const btn = document.getElementById(btnId);
  if (btn) {
    if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current mr-2 inline-block align-middle"></div> <span class="align-middle">${text}...</span>`;
  }
};

// ==========================================
// THE LOGIN ENGINE (Popups tied directly to clicks)
// ==========================================
const handleOAuthLogin = async (provider, providerType, btnId) => {
  if (errBox) errBox.classList.add("hidden");
  setLoading(btnId, "Connecting");

  try {
    if (providerType === "github") {
      provider.addScope("repo");
      provider.addScope("read:user");
    }

    // 1. INSTANT POPUP: Fires immediately on click, bypassing most blockers
    const result = await signInWithPopup(auth, provider);
    const email = result.user.email?.toLowerCase().trim();

    if (!email) {
      await signOut(auth);
      throw new Error("no-email");
    }

    setLoading(btnId, "Verifying User");

    // 2. VERIFY IDENTITY against Firestore Directory
    const isEducator = email === SUPER_ADMIN_EMAIL || email === TEACHER_EMAIL;
    let targetCollection = isEducator ? "teachers" : "students";

    const q = query(collection(db, targetCollection), where("email", "==", email));
    const snap = await getDocs(q);

    if (snap.empty) {
      await signOut(auth);
      throw new Error("unrecognized-email:" + email);
    }

    const matchedDocId = snap.docs[0].id;

    // 3. TOKEN CAPTURE (Only needed here if they logged directly into GitHub)
    if (providerType === "github") {
      const credential = GithubAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        const ghUsername = result._tokenResponse?.screenName || result.user.reloadUserInfo?.screenName || "";
        await updateDoc(doc(db, targetCollection, matchedDocId), {
          githubToken: credential.accessToken,
          githubUsername: ghUsername
        });
      }
    }

    // 4. ROUTE TO DASHBOARD
    localStorage.setItem(
      "Adminerva_Role",
      isEducator ? (email === SUPER_ADMIN_EMAIL ? "superadmin" : "teacher") : "student"
    );
    window.location.href = isEducator ? "reporeviewDashboard.html" : "student-dashboard.html";

  } catch (error) {
    await signOut(auth);
    
    let errorTitle = "Login Failed";
    let errorMessage = error.message.replace("Firebase:", "").trim();

    // 🚀 TARGETED ERROR TRANSLATIONS
    if (error.message === "no-email") {
      errorMessage = "Your GitHub account does not expose a public email. Please sign in with Google.";
    } else if (error.message.startsWith("unrecognized-email:")) {
      errorTitle = "Access Denied";
      const failedEmail = error.message.split(":")[1];
      errorMessage = `Your email (${failedEmail}) is not recognized. If you clicked GitHub, your personal email might not match the school records. <strong>Please click "Continue with Google" instead.</strong>`;
    } else if (error.code === "auth/popup-blocked") {
      errorMessage = "Your browser aggressively blocked the login window. <strong>Please check the URL bar, allow popups for teachernosxis.github.io</strong>, and try again.";
    } else if (error.code === "auth/popup-closed-by-user") {
      errorMessage = "The login window was closed before finishing. Please try again.";
    } else if (error.code === "auth/account-exists-with-different-credential") {
      errorMessage = "You already registered this account using Google. Please click 'Continue with Google'.";
    } else if (error.code === "auth/network-request-failed") {
      errorMessage = "Network error. Please check your internet connection and try again.";
    }

    showError(errorTitle, errorMessage);
  }
};

// ==========================================
// EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("error") === "unauthorized") {
    showError("Session Expired", "Please sign in again to continue.");
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const googleBtn = document.getElementById("googleLoginBtn");
  if (googleBtn) {
    googleBtn.addEventListener("click", () => handleOAuthLogin(new GoogleAuthProvider(), "google", "googleLoginBtn"));
  }

  const githubBtn = document.getElementById("githubLoginBtn");
  if (githubBtn) {
    githubBtn.addEventListener("click", () => handleOAuthLogin(new GithubAuthProvider(), "github", "githubLoginBtn"));
  }
});