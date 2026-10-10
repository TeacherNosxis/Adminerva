import { db, auth } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

let userProfiles = [];

// 🔒 Security Patch
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // ✨ UX FIX: Remove the white screen instantly!
      const pageBody = document.getElementById("pageBody");
      if (pageBody) pageBody.classList.remove("hidden");

      const email = user.email.toLowerCase();
      try {
        const q = query(
          collection(db, "students"),
          where("email", "==", email),
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          const errorBox = document.getElementById("rosterError");
          if (errorBox) errorBox.classList.remove("hidden");
          document.getElementById("saveRepoBtn").disabled = true;
          return;
        }

        userProfiles = [];
        let globalGhUser = "";

        // 🚀 THE FIX: Find any existing GitHub username
        snap.forEach((d) => {
          const data = d.data();
          if (data.githubUsername) globalGhUser = data.githubUsername;
          userProfiles.push({ id: d.id, ...data });
        });

        // 🚀 THE FIX: Apply that username to all profiles in memory
        userProfiles.forEach((p) => {
          if (!p.githubUsername && globalGhUser)
            p.githubUsername = globalGhUser;
        });

        const selector = document.getElementById("sectionSelectorSettings");
        const container = document.getElementById("sectionContainer");

        if (userProfiles.length > 0) {
          container.classList.remove("hidden");
          selector.innerHTML = "";

          userProfiles.forEach((profile, index) => {
            selector.insertAdjacentHTML(
              "beforeend",
              `<option value="${index}">${escapeHTML(profile.section)}</option>`,
            );
          });

          loadProfileData(0);

          selector.addEventListener("change", (e) => {
            loadProfileData(e.target.value);
          });
        }
      } catch (error) {
        console.error("Error fetching student record:", error);
      }
    }
  });
});

function loadProfileData(index) {
  const profile = userProfiles[index];
  if (!profile) return;

  if (document.getElementById("githubUsername")) {
    document.getElementById("githubUsername").value =
      profile.githubUsername || "";
  }
  if (document.getElementById("repoUrl")) {
    document.getElementById("repoUrl").value = profile.repoUrl || "";
  }

  const statusBox = document.getElementById("saveStatus");
  if (statusBox) statusBox.classList.add("hidden");
}

const repoForm = document.getElementById("repoForm");
if (repoForm) {
  repoForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) return;

    const selector = document.getElementById("sectionSelectorSettings");
    const selectedIndex = selector.value;
    const profile = userProfiles[selectedIndex];

    if (!profile) return;

    const btn = document.getElementById("saveRepoBtn");
    const statusBox = document.getElementById("saveStatus");

    btn.disabled = true;
    btn.textContent = "Saving to Database...";
    statusBox.classList.remove("hidden");
    statusBox.textContent = "Saving...";
    statusBox.className =
      "text-xs font-medium text-center text-slate-500 mt-2 block";

    try {
      const newUsername = document
        .getElementById("githubUsername")
        .value.trim();
      const newRepoUrl = document.getElementById("repoUrl").value.trim();

      // 🚀 THE FIX: Use Promise.all to save the username globally, but the repo locally
      const updatePromises = userProfiles.map((p) => {
        const payload = { githubUsername: newUsername };

        // Only update the Repo URL for the specifically selected class
        if (p.id === profile.id) {
          payload.repoUrl = newRepoUrl;
          p.repoUrl = newRepoUrl;
        }

        p.githubUsername = newUsername;
        return setDoc(doc(db, "students", p.id), payload, { merge: true });
      });

      await Promise.all(updatePromises);

      statusBox.textContent = `✅ Saved configuration for ${profile.section}!`;
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
