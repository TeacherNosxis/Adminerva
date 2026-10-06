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
  signInWithRedirect,
  linkWithRedirect,
  getRedirectResult,
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const SUPER_ADMIN_EMAIL = "babaynike2013@gmail.com".toLowerCase();
const TEACHER_EMAIL = "josephsixson@mcstayuman.edu.ph".toLowerCase();
const errBox = document.getElementById("loginErrorBox");

// UI Helpers
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

const showLoading = (message) => {
  if (!errBox) return;
  errBox.innerHTML = `
    <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-3 mt-2"></div>
    <p class="text-blue-400 font-bold text-sm">${message}</p>
  `;
  errBox.classList.remove("hidden");
};

const resetButtons = () => {
  const gBtn = document.getElementById("googleLoginBtn");
  const ghBtn = document.getElementById("githubLoginBtn");
  if (gBtn) gBtn.disabled = false;
  if (ghBtn) ghBtn.disabled = false;
};

// State flag to prevent double-processing
let isProcessing = false;

// ==========================================
// 1. THE CORE ROUTING ENGINE
// ==========================================
async function authenticateUser(user, redirectResult = null) {
  if (isProcessing) return;
  isProcessing = true;
  
  showLoading("Verifying your account...");

  try {
    const email = user.email?.toLowerCase().trim();
    if (!email) {
      await signOut(auth);
      return showError("Login Failed", "Your GitHub account does not expose a public email. Please sign in with Google instead.");
    }

    // Role verification against Firestore
    const isEducator = email === SUPER_ADMIN_EMAIL || email === TEACHER_EMAIL;
    const targetCollection = isEducator ? "teachers" : "students";

    const q = query(collection(db, targetCollection), where("email", "==", email));
    const snap = await getDocs(q);

    if (snap.empty) {
      await signOut(auth);
      return showError("Access Denied", `Your email (${email}) is not recognized. If you clicked GitHub, your personal email might not match the school records. Please click "Continue with Google" instead.`);
    }

    const docId = snap.docs[0].id;
    const userData = snap.docs[0].data();

    let currentToken = userData.githubToken;
    let ghUsername = userData.githubUsername || "";

    // Extract fresh GitHub token if returning from a redirect
    if (redirectResult) {
      const credential = GithubAuthProvider.credentialFromResult(redirectResult);
      if (credential?.accessToken) {
        currentToken = credential.accessToken;
        ghUsername = redirectResult._tokenResponse?.screenName || redirectResult.user.reloadUserInfo?.screenName || ghUsername;
        
        await updateDoc(doc(db, targetCollection, docId), {
          githubToken: currentToken,
          githubUsername: ghUsername,
        });
      }
    }

    // MULTI-STEP AUTH: If logged in with Google but no GitHub token exists
    if (!currentToken) {
       showLoading("Linking GitHub Account...");
       const ghProvider = new GithubAuthProvider();
       ghProvider.addScope("repo");
       ghProvider.addScope("read:user");
       await linkWithRedirect(user, ghProvider);
       return; // Browser leaves the page here
    }

    // Route to appropriate dashboard
    localStorage.setItem("Adminerva_Role", isEducator ? (email === SUPER_ADMIN_EMAIL ? "superadmin" : "teacher") : "student");
    window.location.href = isEducator ? "reporeviewDashboard.html" : "student-dashboard.html";

  } catch (error) {
    console.error(error);
    isProcessing = false;
    showError("Authentication Error", error.message);
  }
}

// ==========================================
// 2. THE CATCHERS (Running in parallel)
// ==========================================

// Catcher A: Grabs the OAuth payload (Tokens)
getRedirectResult(auth)
  .then((result) => {
    if (result && result.user) {
      authenticateUser(result.user, result);
    }
  })
  .catch(async (error) => {
    await signOut(auth);
    isProcessing = false;
    let msg = error.message.replace("Firebase:", "").trim();
    if (error.code === "auth/account-exists-with-different-credential") {
      msg = "You already created an account using Google. Please click 'Continue with Google'.";
    }
    showError("Login Failed", msg);
  });

// Catcher B: Grabs the Auth State (Fallback if payload drops)
onAuthStateChanged(auth, (user) => {
  if (user && !isProcessing) {
    authenticateUser(user, null);
  }
});

// ==========================================
// 3. BUTTON LISTENERS (Triggering Redirects)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("error") === "unauthorized") {
     showError("Session Expired", "Please sign in again to continue.");
     window.history.replaceState({}, document.title, window.location.pathname);
  }

  document.getElementById("googleLoginBtn")?.addEventListener("click", (e) => {
    e.target.disabled = true;
    showLoading("Redirecting to Google...");
    const provider = new GoogleAuthProvider();
    signInWithRedirect(auth, provider);
  });

  document.getElementById("githubLoginBtn")?.addEventListener("click", (e) => {
    e.target.disabled = true;
    showLoading("Redirecting to GitHub...");
    const provider = new GithubAuthProvider();
    provider.addScope("repo");
    provider.addScope("read:user");
    signInWithRedirect(auth, provider);
  });
});