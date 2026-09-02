import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

window.db = null;

const safeSet = (id, val) => {
  if (document.getElementById(id))
    document.getElementById(id).value = val || "";
};
const safeGet = (id) =>
  document.getElementById(id) ? document.getElementById(id).value.trim() : "";

window.loadSecuritySettings = function () {
  safeSet("adminGithubToken", localStorage.getItem("repoReview_github_token"));
  safeSet("adminGeminiKey", localStorage.getItem("repoReview_gemini_token"));
  safeSet(
    "adminAiModel",
    localStorage.getItem("repoReview_ai_model") || "gemini-1.5-flash",
  );
  safeSet(
    "firebaseConfigInput",
    localStorage.getItem("repoReview_firebase_config"),
  );
};

window.saveSecuritySettings = async function () {
  localStorage.setItem(
    "repoReview_firebase_config",
    safeGet("firebaseConfigInput"),
  );
  localStorage.setItem("repoReview_github_token", safeGet("adminGithubToken"));
  localStorage.setItem("repoReview_gemini_token", safeGet("adminGeminiKey"));
  localStorage.setItem(
    "repoReview_ai_model",
    safeGet("adminAiModel") || "gemini-1.5-flash",
  );
  alert(
    "✅ Security Settings Saved Locally! Refresh to apply Firebase changes.",
  );
};

window.initFirebase = function () {
  const configStr = localStorage.getItem("repoReview_firebase_config");

  if (!configStr) {
    if (window.loadLessonReviewSettings) window.loadLessonReviewSettings();
    return;
  }

  try {
    const app = initializeApp(JSON.parse(configStr));
    window.db = getFirestore(app);

    // Trigger RepoReview database pulls
    if (window.loadSectionsAndStudents) window.loadSectionsAndStudents();

    // Trigger LessonReview defaults pulls
    if (window.loadLessonReviewSettings) window.loadLessonReviewSettings();
  } catch (e) {
    console.error("Firebase Init Failed:", e);
    if (window.loadLessonReviewSettings) window.loadLessonReviewSettings();
  }
};
