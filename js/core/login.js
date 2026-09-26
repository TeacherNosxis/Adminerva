import { auth, db } from "./firebase-core.js";
import {
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signOut,
  linkWithPopup
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const SUPER_ADMIN_EMAIL = "babaynike2013@gmail.com".toLowerCase();
const TEACHER_EMAIL = "josephsixson@mcstayuman.edu.ph".toLowerCase();

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const errorType = urlParams.get("error");

  if (errorType === "unauthorized") {
    const errBox = document.getElementById("loginErrorBox");
    if (errBox) errBox.classList.remove("hidden");
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

const handleOAuthLogin = async (provider, providerType) => {
  const errBox = document.getElementById("loginErrorBox");
  if (errBox) errBox.classList.add("hidden");

  try {
    if (providerType === "github") {
      provider.addScope("repo");
      provider.addScope("read:user");
    }

    const result = await signInWithPopup(auth, provider);
    const email = result.user.email?.toLowerCase().trim();

    if (!email) {
      await signOut(auth);
      throw new Error(
        "Your GitHub account does not expose a public email. Please make your email public in GitHub settings or sign in with Google."
      );
    }

    // Role verification against Firestore
    let matchedStudentDocId = null;
    let matchedTeacherDocId = null;
    let userData = null;
    const isEducator = (email === SUPER_ADMIN_EMAIL || email === TEACHER_EMAIL);

    if (!isEducator) {
      const studentQuery = query(
        collection(db, "students"),
        where("email", "==", email),
      );
      const studentSnap = await getDocs(studentQuery);

      if (studentSnap.empty) {
        await signOut(auth);

        if (errBox) {
          errBox.innerHTML = `
            <div class="text-red-500 text-3xl mb-2">⛔</div>
            <h3 class="text-red-400 font-black text-lg uppercase tracking-wider mb-1">Access Denied</h3>
            <p class="text-slate-300 text-sm font-medium mb-4">Your email address (${email}) is not recognized by the system.</p>
            <div class="bg-slate-900/80 p-4 rounded text-xs text-slate-400 border border-slate-700/50 text-left">
                <span class="block text-slate-200 font-bold mb-1">Required Action:</span>
                If you clicked "Sign in with GitHub", your GitHub email might not match the official class list. <strong>Please click "Sign in with Google" instead</strong> to verify your identity.
            </div>
          `;
          errBox.classList.remove("hidden");
        }
        return;
      }
      matchedStudentDocId = studentSnap.docs[0].id;
      userData = studentSnap.docs[0].data();
    } else {
      // Look up Educator Document
      const teacherQuery = query(
        collection(db, "teachers"),
        where("email", "==", email),
      );
      const teacherSnap = await getDocs(teacherQuery);
      if (!teacherSnap.empty) {
        matchedTeacherDocId = teacherSnap.docs[0].id;
        userData = teacherSnap.docs[0].data();
      }
    }

    // --- GITHUB RE-AUTH & TOKEN CAPTURE CHAIN ---
    let currentToken = userData?.githubToken;

    // If they logged in via Google, but we don't have their GitHub token yet, force the link
    if (!currentToken && providerType !== "github") {
        try {
            // Show a subtle notification that the second popup is coming
            if (errBox) {
                errBox.innerHTML = `
                    <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-3 mt-2"></div>
                    <p class="text-blue-400 font-bold text-sm">Verifying GitHub Access...</p>
                    <p class="text-slate-400 text-xs mt-1">Please accept the GitHub popup to complete login.</p>
                `;
                errBox.classList.remove("hidden");
            }

            const ghProvider = new GithubAuthProvider();
            ghProvider.addScope("repo");
            ghProvider.addScope("read:user");

            // Automatically spawn the second popup to link the GitHub account to the Google session
            const linkResult = await linkWithPopup(result.user, ghProvider);
            const credential = GithubAuthProvider.credentialFromResult(linkResult);
            currentToken = credential?.accessToken;

            const ghUsername = linkResult._tokenResponse?.screenName || linkResult.user.reloadUserInfo?.screenName;

            if (currentToken) {
                const updatePayload = {
                    githubToken: currentToken,
                    githubUsername: ghUsername || ""
                };
                if (matchedStudentDocId) await updateDoc(doc(db, "students", matchedStudentDocId), updatePayload);
                else if (matchedTeacherDocId) await updateDoc(doc(db, "teachers", matchedTeacherDocId), updatePayload);
            }

        } catch (linkError) {
            if (linkError.code === 'auth/credential-already-in-use') {
                throw new Error("This GitHub account is already connected to a different student's profile. Please use your own GitHub account.");
            } else {
                throw new Error("GitHub authorization is required to access the platform. Please try logging in again and accept the GitHub popup.");
            }
        }
    } else if (providerType === "github") {
        // They logged in directly via GitHub (and their email perfectly matched the CSV)
        const credential = GithubAuthProvider.credentialFromResult(result);
        currentToken = credential?.accessToken;
        const ghUsername = result._tokenResponse?.screenName || result.user.reloadUserInfo?.screenName;

        if (currentToken) {
            const updatePayload = { githubToken: currentToken, githubUsername: ghUsername || "" };
            if (matchedStudentDocId) await updateDoc(doc(db, "students", matchedStudentDocId), updatePayload);
            else if (matchedTeacherDocId) await updateDoc(doc(db, "teachers", matchedTeacherDocId), updatePayload);
        }
    }

    if (errBox) errBox.classList.add("hidden");

    // Role routing
    if (isEducator) {
      localStorage.setItem("Adminerva_Role", email === SUPER_ADMIN_EMAIL ? "superadmin" : "teacher");
      window.location.href = "reporeviewDashboard.html";
    } else {
      localStorage.setItem("Adminerva_Role", "student");
      window.location.href = "student-dashboard.html";
    }

  } catch (error) {
    await signOut(auth); // Wipe the ghost session if they cancel the flow mid-way
    
    let errorMessage = error.message.replace("Firebase:", "").trim();
    
    // Friendly translation for the most common Firebase OAuth collisions
    if (error.code === "auth/account-exists-with-different-credential") {
        errorMessage = "You already created an account using Google. Please click 'Sign in with Google' instead. You will be prompted to connect your GitHub automatically.";
    } else if (error.code === "auth/popup-closed-by-user") {
        errorMessage = "The login popup was closed before finishing. Please try again.";
    }

    if (errBox) {
      errBox.innerHTML = `
        <div class="text-red-500 text-3xl mb-2">⛔</div>
        <h3 class="text-red-400 font-black text-lg uppercase tracking-wider mb-1">Login Failed</h3>
        <p class="text-slate-300 text-sm font-medium mb-4">${errorMessage}</p>
      `;
      errBox.classList.remove("hidden");
    }
  }
};

const googleBtn = document.getElementById("googleLoginBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", () =>
    handleOAuthLogin(new GoogleAuthProvider(), "google"),
  );
}

const githubBtn = document.getElementById("githubLoginBtn");
if (githubBtn) {
  githubBtn.addEventListener("click", () =>
    handleOAuthLogin(new GithubAuthProvider(), "github"),
  );
}
