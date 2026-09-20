import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const configStr = localStorage.getItem("Adminerva_firebase_config");
if (!configStr) window.location.href = "login.html";

const app = initializeApp(JSON.parse(configStr));
const auth = getAuth(app);
const db = getFirestore(app);
let currentStudentDocId = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");
  document.getElementById("pageBody").classList.remove("hidden");
  document.getElementById("userEmailDisplay").textContent = user.email;

  try {
    const q = query(
      collection(db, "students"),
      where("email", "==", user.email.toLowerCase()),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      document.getElementById("rosterError").classList.remove("hidden");
      document.getElementById("saveRepoBtn").disabled = true;
      return;
    }
    snap.forEach((d) => {
      currentStudentDocId = d.id;
      const data = d.data();
      if (data.githubUsername)
        document.getElementById("githubUsername").value = data.githubUsername;
      if (data.repoUrl) document.getElementById("repoUrl").value = data.repoUrl;
    });
  } catch (error) {
    console.error(error);
  }
});

document.getElementById("repoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentStudentDocId) return;
  const btn = document.getElementById("saveRepoBtn");
  const status = document.getElementById("saveStatus");
  btn.disabled = true;
  btn.textContent = "Saving...";
  status.classList.add("hidden");

  try {
    await updateDoc(doc(db, "students", currentStudentDocId), {
      githubUsername: document.getElementById("githubUsername").value.trim(),
      repoUrl: document.getElementById("repoUrl").value.trim(),
    });
    status.textContent = "✅ Settings saved successfully!";
    status.className =
      "text-xs font-bold text-center text-green-600 mt-2 block";
  } catch (error) {
    status.textContent = "❌ Error saving data.";
    status.className = "text-xs font-bold text-center text-red-600 mt-2 block";
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Configuration";
  }
});
// PASTE THIS INSTEAD:
// Event Delegation for dynamically injected Sign Out button
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "signOutBtn") {
    signOut(auth).then(() => (window.location.href = "login.html"));
  }
});
