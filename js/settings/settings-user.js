import { auth, db } from "../core/firebase-core.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const SUPER_ADMIN_EMAIL = "testadmin@example.com".toLowerCase();
const TEACHER_EMAIL = "josephsixson@mcstayuman.edu.ph".toLowerCase();

// ==========================================
// SECURITY & INITIALIZATION
// ==========================================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const email = user.email.toLowerCase();

  if (email !== SUPER_ADMIN_EMAIL && email !== TEACHER_EMAIL) {
    window.location.href = "student-dashboard.html";
  } else {
    const pageBody = document.getElementById("pageBody");
    if (pageBody) {
      pageBody.classList.remove("hidden");
      loadDirectory();
    }
  }
});

const signOutBtn = document.getElementById("signOutBtn");
if (signOutBtn) {
  signOutBtn.addEventListener("click", () => {
    signOut(auth).then(() => (window.location.href = "login.html"));
  });
}

// ==========================================
// CSV PARSING & UPLOAD
// ==========================================
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("csvFile");
const uploadBtn = document.getElementById("uploadBtn");
const uploadStatus = document.getElementById("uploadStatus");

let selectedCsvFile = null;

if (dropzone && fileInput) {
  dropzone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      selectedCsvFile = e.target.files[0];
      dropzone.innerHTML = `<span class="text-3xl block mb-2">✅</span><p class="text-sm font-bold text-green-600">${selectedCsvFile.name}</p>`;
      uploadBtn.disabled = false;
    }
  });
}

if (uploadBtn) {
  uploadBtn.addEventListener("click", () => {
    if (!selectedCsvFile) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = "Parsing CSV...";
    uploadStatus.classList.remove("hidden");
    uploadStatus.className = "text-xs font-bold text-center mt-3 text-blue-500";
    uploadStatus.textContent = "Reading file data...";

    const reader = new FileReader();
    reader.onload = async function (e) {
      const text = e.target.result;
      await processCSV(text);
    };
    reader.readAsText(selectedCsvFile);
  });
}

async function processCSV(csvText) {
  const rows = csvText
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row.length > 0);
  if (rows.length < 2) {
    return showUploadError("CSV is empty or missing headers.");
  }

  // Attempt to dynamically find the email and name columns
  const headers = rows[0].toLowerCase().split(",");
  const emailIdx = headers.findIndex((h) => h.includes("email"));
  const firstIdx = headers.findIndex((h) => h.includes("first"));
  const lastIdx = headers.findIndex((h) => h.includes("last"));
  const sectionIdx = headers.findIndex((h) => h.includes("section")); // Optional

  if (emailIdx === -1) {
    return showUploadError("CSV must contain a column named 'email'.");
  }

  uploadBtn.textContent = "Syncing to Database...";

  try {
    const batch = writeBatch(db);
    let count = 0;

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split(",");
      const rawEmail = cols[emailIdx]?.trim().toLowerCase();

      if (!rawEmail || !rawEmail.includes("@")) continue;

      const studentData = {
        email: rawEmail,
        firstName: firstIdx !== -1 ? cols[firstIdx]?.trim() : "",
        lastName: lastIdx !== -1 ? cols[lastIdx]?.trim() : "",
        section: sectionIdx !== -1 ? cols[sectionIdx]?.trim() : "Unassigned",
        role: "student",
        enrolledAt: new Date().toISOString(),
      };

      // Combine names for easier display later
      studentData.name =
        `${studentData.firstName} ${studentData.lastName}`.trim();
      if (!studentData.name) studentData.name = "Unnamed Student";

      // Use setDoc with { merge: true } so we don't accidentally overwrite
      // a student's GitHub info if they already set it up.
      const docRef = doc(db, "students", rawEmail);
      batch.set(docRef, studentData, { merge: true });
      count++;
    }

    await batch.commit();

    uploadStatus.className =
      "text-xs font-bold text-center mt-3 text-emerald-600";
    uploadStatus.textContent = `✅ Successfully imported ${count} students!`;

    // Reset UI
    selectedCsvFile = null;
    dropzone.innerHTML = `<span class="text-3xl block mb-2">📥</span><p class="text-sm font-bold text-slate-700">Click or drag CSV here</p><p class="text-xs text-slate-400 mt-1">Maximum 500 records per upload</p>`;

    loadDirectory(); // Refresh the table
  } catch (error) {
    showUploadError("Database Sync Failed: " + error.message);
  } finally {
    uploadBtn.textContent = "Sync to Database";
    uploadBtn.disabled = false;
  }
}

function showUploadError(msg) {
  uploadStatus.className = "text-xs font-bold text-center mt-3 text-red-500";
  uploadStatus.textContent = "❌ " + msg;
  uploadBtn.textContent = "Sync to Database";
  uploadBtn.disabled = false;
}

// ==========================================
// DIRECTORY READ & DELETE (CRUD)
// ==========================================
async function loadDirectory() {
  const tbody = document.getElementById("userTableBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-400 italic font-medium">Fetching roster from database...</td></tr>`;

  try {
    const snap = await getDocs(collection(db, "students"));
    tbody.innerHTML = "";

    let recordCount = 0;

    snap.forEach((documentSnapshot) => {
      const data = documentSnapshot.data();
      // Skip the teacher/admin profiles if they somehow ended up in the student collection
      if (data.email === SUPER_ADMIN_EMAIL || data.email === TEACHER_EMAIL)
        return;

      recordCount++;

      // Check if the student has configured their GitHub settings
      const isLinked = data.githubUsername && data.repoUrl;
      const statusHtml = isLinked
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">Linked</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">Missing Info</span>`;

      const tr = `
                <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                    <td class="px-6 py-4 font-medium text-slate-800">${data.name || "Unknown"}</td>
                    <td class="px-6 py-4 text-slate-500 font-mono text-xs">${data.email}</td>
                    <td class="px-6 py-4">${statusHtml}</td>
                    <td class="px-6 py-4 text-right">
                        <button onclick="window.revokeStudent('${data.email}')" class="text-red-500 hover:text-red-700 font-medium text-xs border border-red-100 bg-red-50 px-3 py-1.5 rounded transition">Revoke</button>
                    </td>
                </tr>
            `;
      tbody.insertAdjacentHTML("beforeend", tr);
    });

    if (recordCount === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-400 font-medium">No students found. Import a CSV to begin.</td></tr>`;
    }

    // Update footer record count
    const footerCount = document.querySelector(
      ".p-4.border-t.border-slate-200.bg-slate-50 span",
    );
    if (footerCount) footerCount.textContent = `Showing ${recordCount} records`;
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-red-500 font-bold">Error loading directory: ${error.message}</td></tr>`;
  }
}

// Bind refresh button if it exists
const refreshBtn = document.querySelector(
  "button.text-blue-600.hover\\:underline",
);
if (refreshBtn) refreshBtn.addEventListener("click", loadDirectory);

// Expose revoke function globally so inline HTML onclick can access it
window.revokeStudent = async function (email) {
  if (
    !confirm(
      `Are you sure you want to revoke access for ${email}? This will delete their roster profile.`,
    )
  ) {
    return;
  }

  if (typeof window.showSubtleLoader === "function")
    window.showSubtleLoader("Revoking access...");

  try {
    await deleteDoc(doc(db, "students", email.toLowerCase()));
    await loadDirectory();
  } catch (error) {
    alert("Failed to delete user: " + error.message);
  } finally {
    if (typeof window.hideSubtleLoader === "function")
      window.hideSubtleLoader();
  }
};
// Bulk Delete Entire Roster
window.clearDirectory = async function () {
  const firstConfirm = confirm(
    "⚠️ DANGER: Are you absolutely sure you want to delete ALL students? This cannot be undone.",
  );
  if (!firstConfirm) return;

  const secondConfirm = confirm(
    "Please confirm one more time. This will wipe your entire student directory.",
  );
  if (!secondConfirm) return;

  if (typeof window.showSubtleLoader === "function")
    window.showSubtleLoader("Wiping Student Directory...");

  try {
    const snap = await getDocs(collection(db, "students"));
    const batch = writeBatch(db);
    let count = 0;

    snap.forEach((documentSnapshot) => {
      const data = documentSnapshot.data();

      // Safety measure: Do not delete your admin accounts
      if (
        data.email === "testadmin@example.com" ||
        data.email === "josephsixson@mcstayuman.edu.ph"
      ) {
        return;
      }

      const docRef = doc(db, "students", documentSnapshot.id);
      batch.delete(docRef);
      count++;
    });

    if (count === 0) {
      alert("The directory is already empty.");
      if (typeof window.hideSubtleLoader === "function")
        window.hideSubtleLoader();
      return;
    }

    await batch.commit();
    alert(`✅ Successfully cleared ${count} students from the database.`);

    await loadDirectory(); // Refresh the table instantly
  } catch (error) {
    console.error("Error clearing directory:", error);
    alert("❌ Failed to clear directory: " + error.message);
  } finally {
    if (typeof window.hideSubtleLoader === "function")
      window.hideSubtleLoader();
  }
};
