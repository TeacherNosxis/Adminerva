import { db } from "../core/firebase-core.js";
import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

window.initFirebase = function () {
  // Use centralized db directly
  window.db = db;

  // Trigger database pulls
  if (window.loadSectionsAndStudents) window.loadSectionsAndStudents();
  if (window.loadLessonReviewSettings) window.loadLessonReviewSettings();
};
window.db = db;

const safeSet = (id, val) => {
  if (document.getElementById(id))
    document.getElementById(id).value = val || "";
};

const safeGet = (id) =>
  document.getElementById(id) ? document.getElementById(id).value.trim() : "";

window.saveSecuritySettings = async function () {
  const fbConfigStr = safeGet("firebaseConfigInput");
  const githubToken = safeGet("adminGithubToken");
  const geminiKey = safeGet("adminGeminiKey");
  const aiModel = safeGet("adminAiModel") || "gemini-1.5-flash";
  const engineMode = safeGet("globalAiEngine") || "cloud";

  const originalBtnText = document.getElementById("saveSettingsBtn")
    ? document.getElementById("saveSettingsBtn").innerText
    : "Save";
  if (document.getElementById("saveSettingsBtn")) {
    document.getElementById("saveSettingsBtn").innerText =
      "Verifying Connections...";
  }

  try {
    // 🚀 1. FIREBASE VALIDATION
    if (fbConfigStr) {
      try {
        const fbJson = JSON.parse(fbConfigStr);
        if (!fbJson.projectId || !fbJson.apiKey) {
          throw new Error(
            "Missing required Firebase properties (projectId or apiKey).",
          );
        }
      } catch (e) {
        throw new Error("Invalid Firebase Configuration: " + e.message);
      }
    }

    // 🚀 2. GEMINI API LIVE CONNECTION TEST
    if (geminiKey) {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const testResponse = await fetch(testUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Connection test." }] }],
        }),
      });

      if (!testResponse.ok) {
        if (testResponse.status === 400)
          throw new Error("Gemini API Key is invalid.");
        if (testResponse.status === 404)
          throw new Error(`AI Model '${aiModel}' not found.`);
        if (testResponse.status === 503)
          console.warn(
            "Gemini is currently overloaded, but the credentials appear structurally valid.",
          );
        else
          throw new Error(`Gemini API returned status ${testResponse.status}`);
      }
    }

    // 🚀 3. SAVE IF VALIDATIONS PASS
    localStorage.setItem("Adminerva_firebase_config", fbConfigStr);
    localStorage.setItem("Adminerva_github_token", githubToken);
    localStorage.setItem("Adminerva_gemini_token", geminiKey);
    localStorage.setItem("Adminerva_ai_model", aiModel);
    localStorage.setItem("Adminerva_engine_mode", engineMode);

    alert(
      "✅ Connections Verified & Settings Saved! Refresh the page to apply changes.",
    );
  } catch (error) {
    alert("❌ Save Aborted: " + error.message);
  } finally {
    if (document.getElementById("saveSettingsBtn")) {
      document.getElementById("saveSettingsBtn").innerText = originalBtnText;
    }
  }
};

window.loadSecuritySettings = function () {
  safeSet(
    "firebaseConfigInput",
    localStorage.getItem("Adminerva_firebase_config") || "",
  );
  safeSet(
    "adminGithubToken",
    localStorage.getItem("Adminerva_github_token") || "",
  );
  safeSet(
    "adminGeminiKey",
    localStorage.getItem("Adminerva_gemini_token") || "",
  );
  safeSet(
    "adminAiModel",
    localStorage.getItem("Adminerva_ai_model") || "gemini-1.5-flash",
  );
  safeSet(
    "globalAiEngine",
    localStorage.getItem("Adminerva_engine_mode") || "cloud",
  );
};
