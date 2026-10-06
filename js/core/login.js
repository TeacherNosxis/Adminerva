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
  onAuthStateChanged // 🚀 NEW: Required for the routing safety net
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const SUPER_ADMIN_EMAIL = "babaynike2013@gmail.com".toLowerCase();
const TEACHER_EMAIL = "josephsixson@mcstayuman.edu.ph".toLowerCase();
const errBox = document.getElementById("loginErrorBox");

// Reusable UI error display
const showError = (title, message) => {
  if (!errBox) return;
  errBox.innerHTML = `
    <div class="text-red-500 text-3xl mb-2">⛔</div>
    <h3 class="text-red-400 font-black text-lg uppercase tracking-wider mb-1">${title}</h3>
    <p class="text-slate-300 text-sm font-medium mb-4">${message}</p>
  `;
  errBox.classList.remove("hidden");
};

// Prevents routing logic from firing twice if both Auth events trigger
let authProcessing = false;

// ==========================================
// 1. THE CORE ROUTING ENGINE
// ==========================================
async function processAuthStatus(user, redirectResult) {
  if (authProcessing) return;
  authProcessing = true;

  try {
    const email = user.email?.toLowerCase().trim();
    if (!email) {
      await signOut(auth);
      return showError(
        "Login Failed",
        "Your GitHub account does not expose a public email. Please make your email public in GitHub settings or sign in with Google."
      );
    }

    // Role verification against Firestore
    const isEducator = email === SUPER_ADMIN_EMAIL || email === TEACHER_EMAIL;
    let targetCollection = isEducator ? "teachers" : "students";
    
    const q = query(collection(db, targetCollection), where("email", "==", email));
    const snap = await getDocs(q);

    if (snap.empty) {
      await signOut(auth);
      return showError(
        "Access Denied",
        `Your email address (${email}) is not recognized. If you clicked "Sign in with GitHub", please click "Sign in with Google" instead to verify your identity.`
      );
    }

    const matchedDocId = snap.docs[0].id;
    const userData = snap.docs[0].data();

    let currentToken = userData.githubToken;
    let ghUsername = userData.githubUsername || "";

    // 🚀 THE FIX: If we caught the redirect payload, extract and save the fresh token
    if (redirectResult) {
      const credential = GithubAuthProvider.credentialFromResult(redirectResult);
      if (credential?.accessToken) {
        currentToken = credential.accessToken;
        ghUsername = redirectResult._tokenResponse?.screenName || redirectResult.user.reloadUserInfo?.screenName || ghUsername;
        
        await updateDoc(doc(db, targetCollection, matchedDocId), {
          githubToken: currentToken,
          githubUsername: ghUsername,
        });
      }
    }

    // MULTI-STEP AUTH: If they logged in with Google, but lack a GitHub token in the DB
    if (!currentToken) {
      // Visual feedback before leaving the page
      if (errBox) {
        errBox.innerHTML = `
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-3 mt-2"></div>
          <p class="text-blue-400 font-bold text-sm">Linking GitHub...</p>
          <p class="text-slate-400 text-xs mt-1">Redirecting you to GitHub to authorize access.</p>
        `;
        errBox.classList.remove("hidden");
      }

      const ghProvider = new GithubAuthProvider();
      ghProvider.addScope("repo");
      ghProvider.addScope("read:user");
      
      await linkWithRedirect(user, ghProvider);
      return; // Stop execution; browser will navigate away
    }

    // Route to appropriate dashboard
    localStorage.setItem(
      "Adminerva_Role",
      isEducator ? (email === SUPER_ADMIN_EMAIL ? "superadmin" : "teacher") : "student"
    );
    window.location.href = isEducator ? "reporeviewDashboard.html" : "student-dashboard.html";

  } catch (error) {
    console.error(error);
    authProcessing = false;
    showError("Authentication Error", error.message);
  }
}

// ==========================================
// 2. THE REDIRECT CATCHER & SAFETY NET
// ==========================================
getRedirectResult(auth)
  .then((result) => {
    if (result && result.user) {
      // Scenario A: The redirect was cleanly caught
      processAuthStatus(result.user, result);
    } else {
      // 🚀 THE FIX: Scenario B: The payload was dropped, but Firebase knows they are logged in.
      // We check their auth state and route them so they don't get stuck.
      onAuthStateChanged(auth, (user) => {
        if (user) {
          processAuthStatus(user, null);
        }
      });
    }
  })
  .catch(async (error) => {
    await signOut(auth);
    let errorMessage = error.message.replace("Firebase:", "").trim();

    if (error.code === "auth/account-exists-with-different-credential") {
      errorMessage = "You already created an account using Google. Please click 'Sign in with Google' instead. You will be prompted to connect your GitHub automatically.";
    } else if (error.code === "auth/credential-already-in-use") {
      errorMessage = "This GitHub account is already connected to a different student's profile. Please use your own GitHub account.";
    }

    showError("Login Failed", errorMessage);
  });

// ==========================================
// 3. BUTTON LISTENERS 
// 🚀 THE FIX: Removed DOMContentLoaded wrapper so they attach instantly
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("error") === "unauthorized") {
  if (errBox) errBox.classList.remove("hidden");
  window.history.replaceState({}, document.title, window.location.pathname);
}

const googleBtn = document.getElementById("googleLoginBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", () => {
    if (errBox) errBox.classList.add("hidden");
    const provider = new GoogleAuthProvider();
    signInWithRedirect(auth, provider);
  });
}

const githubBtn = document.getElementById("githubLoginBtn");
if (githubBtn) {
  githubBtn.addEventListener("click", () => {
    if (errBox) errBox.classList.add("hidden");
    const provider = new GithubAuthProvider();
    provider.addScope("repo");
    provider.addScope("read:user");
    signInWithRedirect(auth, provider);
  });
}