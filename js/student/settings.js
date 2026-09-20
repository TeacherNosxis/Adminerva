import { db, auth } from "../core/firebase-core.js";
import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // Wait for the centralized auth engine to confirm the user
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const email = user.email.toLowerCase();
      const docRef = doc(db, "students", email);

      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Pre-fill the form if they already saved their GitHub info
          if (document.getElementById("githubUsername")) {
            document.getElementById("githubUsername").value =
              data.githubUsername || "";
          }
          if (document.getElementById("repoUrl")) {
            document.getElementById("repoUrl").value = data.repoUrl || "";
          }
        } else {
          // If the student isn't in the roster you uploaded via CSV, show the error
          const errorBox = document.getElementById("rosterError");
          if (errorBox) errorBox.classList.remove("hidden");
        }
      } catch (error) {
        console.error("Error fetching student record:", error);
      }
    }
  });
});

// Handle saving the GitHub configuration
const repoForm = document.getElementById("repoForm");
if (repoForm) {
  repoForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) return;

    const btn = document.getElementById("saveRepoBtn");
    const statusBox = document.getElementById("saveStatus");

    btn.disabled = true;
    btn.textContent = "Saving to Database...";

    try {
      const docRef = doc(db, "students", user.email.toLowerCase());
      await setDoc(
        docRef,
        {
          githubUsername: document
            .getElementById("githubUsername")
            .value.trim(),
          repoUrl: document.getElementById("repoUrl").value.trim(),
        },
        { merge: true },
      );

      statusBox.textContent = "✅ Repository Connection Saved!";
      statusBox.className =
        "text-xs font-bold text-center text-emerald-500 mt-2 block";
    } catch (error) {
      statusBox.textContent = "❌ Error saving settings: " + error.message;
      statusBox.className =
        "text-xs font-bold text-center text-red-500 mt-2 block";
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Configuration";
    }
  });
}
