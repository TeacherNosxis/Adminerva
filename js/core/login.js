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
    const email = result.user.email?.toLowerCase();

    if (!email) {
      await signOut(auth);
      throw new Error(
        "Your GitHub account does not expose a public email. Please make your email public in GitHub settings or sign in with Google.",
      );
    }

    // Role verification against Firestore
    let matchedStudentDocId = null;
    let matchedTeacherDocId = null;
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
                Contact your Instructor or the System Administrator to have your official email added to the Adminerva class list before attempting to log in again.
            </div>
          `;
          errBox.classList.remove("hidden");
        }
        return;
      }
      matchedStudentDocId = studentSnap.docs[0].id;
    } else {
      // Look up Educator Document
      const teacherQuery = query(
        collection(db, "teachers"),
        where("email", "==", email),
      );
      const teacherSnap = await getDocs(teacherQuery);
      if (!teacherSnap.empty) {
        matchedTeacherDocId = teacherSnap.docs[0].id;
      }
    }

    // Auto-save GitHub credentials for BOTH students and teachers
    if (providerType === "github") {
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      const ghUsername =
        result._tokenResponse?.screenName ||
        result.user.reloadUserInfo?.screenName;

      const updatePayload = {};
      if (token) updatePayload.githubToken = token;
      if (ghUsername) updatePayload.githubUsername = ghUsername;

      if (Object.keys(updatePayload).length > 0) {
        try {
          if (matchedStudentDocId) {
            await updateDoc(doc(db, "students", matchedStudentDocId), updatePayload);
          } else if (matchedTeacherDocId) {
            await updateDoc(doc(db, "teachers", matchedTeacherDocId), updatePayload);
          }
        } catch (e) {
          console.warn("Could not auto-save GitHub credentials:", e);
        }
      }
    }

    // Role routing
    if (isEducator) {
      localStorage.setItem("Adminerva_Role", email === SUPER_ADMIN_EMAIL ? "superadmin" : "teacher");
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
