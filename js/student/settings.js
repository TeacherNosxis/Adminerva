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

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const email = user.email.toLowerCase();
      try {
        // Query for ALL documents matching the student's email
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
        snap.forEach((d) => {
          userProfiles.push({ id: d.id, ...d.data() });
        });

        const selector = document.getElementById("sectionSelectorSettings");
        const container = document.getElementById("sectionContainer");

        if (userProfiles.length > 0) {
          container.classList.remove("hidden");
          selector.innerHTML = "";

          userProfiles.forEach((profile, index) => {
            selector.insertAdjacentHTML(
              "beforeend",
              `<option value="${index}">${profile.section}</option>`,
            );
          });

          // Pre-fill the form with the first class's info
          loadProfileData(0);

          // Listen for dropdown changes to swap the displayed repo info
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

  // Clear previous success/error messages
  const statusBox = document.getElementById("saveStatus");
  if (statusBox) statusBox.classList.add("hidden");
}

// Handle saving the GitHub configuration
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
      // Save directly to the Composite ID associated with the selected class
      const docRef = doc(db, "students", profile.id);

      const newUsername = document
        .getElementById("githubUsername")
        .value.trim();
      const newRepoUrl = document.getElementById("repoUrl").value.trim();

      await setDoc(
        docRef,
        {
          githubUsername: newUsername,
          repoUrl: newRepoUrl,
        },
        { merge: true },
      );

      // Update the local array so switching dropdowns remembers the new data instantly
      userProfiles[selectedIndex].githubUsername = newUsername;
      userProfiles[selectedIndex].repoUrl = newRepoUrl;

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
