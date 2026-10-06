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
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const SUPER_ADMIN_EMAIL = "babaynike2013@gmail.com".toLowerCase();
const TEACHER_EMAIL = "josephsixson@mcstayuman.edu.ph".toLowerCase();

const errBox = document.getElementById("loginErrorBox");

// Reusable UI error display function
const showError = (title, message) => {
  if (!errBox) return;
  errBox.innerHTML = `
    <div class="text-red-500 text-3xl mb-2">⛔</div>
    <h3 class="text-red-400 font-black text-lg uppercase tracking-wider mb-1">${title}</h3>
    <p class="text-slate-300 text-sm font-medium mb-4">${message}</p>
  `;
  errBox.classList.remove("hidden");
};

// ==========================================
// 1. THE REDIRECT CATCHER 
// (Runs automatically when the page loads after a redirect)
// ==========================================
getRedirectResult(auth)
  .then(async (result) => {
    if (!result) return; // Normal page load, do nothing until user clicks a button

    const user = result.user;
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

    // Check if the current redirect resulted in a GitHub token
    const credential = GithubAuthProvider.credentialFromResult(result);
    let currentToken = credential?.accessToken || userData.githubToken;
    const ghUsername = result._tokenResponse?.screenName || result.user.reloadUserInfo?.screenName;

    // If we just got a fresh GitHub token, save it to Firestore
    if (credential?.accessToken) {
      await updateDoc(doc(db, targetCollection, matchedDocId), {
        githubToken: credential.accessToken,
        githubUsername: ghUsername || userData.githubUsername || "",
      });
      currentToken = credential.accessToken;
    }

    // MULTI-STEP AUTH: If they logged in with Google, but we don't have a GitHub token in the DB yet
    if (!currentToken) {
      const ghProvider = new GithubAuthProvider();
      ghProvider.addScope("repo");
      ghProvider.addScope("read:user");
      
      // Automatically redirect them to GitHub to link their account
      return linkWithRedirect(user, ghProvider); 
    }

    // Route to appropriate dashboard
    localStorage.setItem(
      "Adminerva_Role",
      isEducator ? (email === SUPER_ADMIN_EMAIL ? "superadmin" : "teacher") : "student"
    );
    window.location.href = isEducator ? "reporeviewDashboard.html" : "student-dashboard.html";
  })
  .catch(async (error) => {
    await signOut(auth);
    let errorMessage = error.message.replace("Firebase:", "").trim();

    if (error.code === "auth/account-exists-with-different-credential") {
      errorMessage =
        "You already created an account using Google. Please click 'Sign in with Google' instead. You will be prompted to connect your GitHub automatically.";
    } else if (error.code === "auth/credential-already-in-use") {
      errorMessage = 
        "This GitHub account is already connected to a different student's profile. Please use your own GitHub account.";
    }

    showError("Login Failed", errorMessage);
  });

// ==========================================
// 2. BUTTON LISTENERS (Initiates the Redirects)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
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
});