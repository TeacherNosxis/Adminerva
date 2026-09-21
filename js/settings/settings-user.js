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
// CSV PARSING & UPLOAD (COMPOSITE IDs)
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

  // 🚀 NEW: Advanced CSV Splitter that respects Google Forms quotation marks!
  function splitCsvRow(row) {
    let cols = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '"') {
        inQuotes = !inQuotes; // Toggle quote state
      } else if (row[i] === "," && !inQuotes) {
        cols.push(cur.trim()); // Split only if outside quotes
        cur = "";
      } else {
        cur += row[i];
      }
    }
    cols.push(cur.trim());
    return cols;
  }

  const headers = splitCsvRow(rows[0].toLowerCase());

  // Auto-detect columns (handles forms that just use "Name" instead of First/Last)
  const emailIdx = headers.findIndex(
    (h) => h.includes("email") || h.includes("address"),
  );
  const firstIdx = headers.findIndex((h) => h.includes("first"));
  const lastIdx = headers.findIndex((h) => h.includes("last"));
  const nameIdx = headers.findIndex(
    (h) => h.includes("name") && !h.includes("first") && !h.includes("last"),
  );
  const sectionIdx = headers.findIndex(
    (h) => h.includes("section") || h.includes("club") || h.includes("class"),
  );

  if (emailIdx === -1) {
    return showUploadError("CSV must contain a column named 'email'.");
  }
  if (sectionIdx === -1) {
    return showUploadError(
      "CSV must contain a column named 'section' or 'club'.",
    );
  }

  uploadBtn.textContent = "Syncing to Database...";

  try {
    const batch = writeBatch(db);
    let count = 0;

    for (let i = 1; i < rows.length; i++) {
      const cols = splitCsvRow(rows[i]);
      const rawEmail = cols[emailIdx]?.toLowerCase();

      if (!rawEmail || !rawEmail.includes("@")) continue;

      let firstName = firstIdx !== -1 ? cols[firstIdx] : "";
      let lastName = lastIdx !== -1 ? cols[lastIdx] : "";
      let fullName =
        nameIdx !== -1 ? cols[nameIdx] : `${firstName} ${lastName}`.trim();
      if (!fullName) fullName = "Unnamed Student";

      // 🚀 NEW: Multi-Section Extraction
      // Google Forms separates multiple checkbox answers with commas (e.g. "Class A, Club B")
      const rawSectionData = cols[sectionIdx] || "Unassigned";
      const sections = rawSectionData
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // Create a separate database record for EVERY section/club they checked
      for (let sec of sections) {
        const studentData = {
          email: rawEmail,
          firstName: firstName,
          lastName: lastName,
          name: fullName,
          section: sec, // Save the specific section/club
          role: "student",
          enrolledAt: new Date().toISOString(),
        };

        // COMPOSITE ID GENERATOR
        const safeSection = sec.replace(/[^a-zA-Z0-9]/g, "");
        const compositeId = `${rawEmail}_${safeSection}`;

        const docRef = doc(db, "students", compositeId);
        batch.set(docRef, studentData, { merge: true });
        count++;
      }
    }

    await batch.commit();

    uploadStatus.className =
      "text-xs font-bold text-center mt-3 text-emerald-600";
    uploadStatus.textContent = `✅ Successfully imported ${count} multi-section records!`;

    selectedCsvFile = null;
    dropzone.innerHTML = `<span class="text-3xl block mb-2">📥</span><p class="text-sm font-bold text-slate-700">Click or drag CSV here</p><p class="text-xs text-slate-400 mt-1">Maximum 500 records per upload</p>`;

    loadDirectory();
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
// DIRECTORY READ, VERIFY & DELETE
// ==========================================
async function loadDirectory() {
  const tbody = document.getElementById("userTableBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-400 italic font-medium">Fetching roster from database...</td></tr>`;

  const ghToken = localStorage.getItem("Adminerva_github_token");

  try {
    const snap = await getDocs(collection(db, "students"));
    tbody.innerHTML = "";

    let recordCount = 0;

    snap.forEach((documentSnapshot) => {
      const data = documentSnapshot.data();
      if (data.email === SUPER_ADMIN_EMAIL || data.email === TEACHER_EMAIL)
        return;

      recordCount++;

      const isLinked = data.githubUsername && data.repoUrl;

      const pillId = `status_${documentSnapshot.id.replace(/[^a-zA-Z0-9]/g, "")}`;

      const statusHtml = isLinked
        ? `<span id="${pillId}" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 animate-pulse">Verifying...</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">Missing Info</span>`;

      const tr = `
                <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                    <td class="px-6 py-4">
                        <div class="font-medium text-slate-800">${data.name || "Unknown"}</div>
                        <div class="text-[10px] font-bold text-blue-500 uppercase tracking-wider mt-0.5">${data.section}</div>
                    </td>
                    <td class="px-6 py-4 text-slate-500 font-mono text-xs">${data.email}</td>
                    <td class="px-6 py-4">${statusHtml}</td>
                    <td class="px-6 py-4 text-right">
                        <button onclick="window.revokeStudent('${documentSnapshot.id}')" class="text-red-500 hover:text-red-700 font-medium text-xs border border-red-100 bg-red-50 px-3 py-1.5 rounded transition shadow-sm">Revoke</button>
                    </td>
                </tr>
            `;
      tbody.insertAdjacentHTML("beforeend", tr);

      if (isLinked) {
        verifyRepoStatus(pillId, data.repoUrl, ghToken);
      }
    });

    if (recordCount === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-400 font-medium">No students found. Import a CSV to begin.</td></tr>`;
    }

    const footerCount = document.querySelector(
      ".p-4.border-t.border-slate-200.bg-slate-50 span",
    );
    if (footerCount)
      footerCount.textContent = `Showing ${recordCount} enrollment records`;
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-red-500 font-bold">Error loading directory: ${error.message}</td></tr>`;
  }
}

// Async Live Repo Health Check
async function verifyRepoStatus(elementId, repoUrl, token) {
  const pill = document.getElementById(elementId);
  if (!pill) return;

  if (!token) {
    pill.className =
      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700";
    pill.textContent = "Linked (No Token)";
    return;
  }

  try {
    let owner, repo;
    const urlParts = repoUrl.replace(/\/$/, "").replace(".git", "").split("/");
    repo = urlParts.pop();
    owner = urlParts.pop();

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    pill.classList.remove("animate-pulse");

    if (res.ok) {
      pill.className =
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700";
      pill.textContent = "Active Repo";
    } else if (res.status === 409) {
      pill.className =
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700";
      pill.textContent = "Linked, Empty";
    } else if (res.status === 404) {
      pill.className =
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700";
      pill.textContent = "Not Found / Private";
    } else {
      pill.className =
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700";
      pill.textContent = "API Blocked";
    }
  } catch (e) {
    pill.classList.remove("animate-pulse");
    pill.className =
      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700";
    pill.textContent = "Network Error";
  }
}

const refreshBtn = document.querySelector(
  "button.text-blue-600.hover\\:underline",
);
if (refreshBtn) refreshBtn.addEventListener("click", loadDirectory);

window.revokeStudent = async function (compositeDocId) {
  if (
    !confirm(
      `Are you sure you want to revoke this specific access? If they are in multiple sections, this only removes them from this one.`,
    )
  ) {
    return;
  }

  if (typeof window.showSubtleLoader === "function")
    window.showSubtleLoader("Revoking access...");

  try {
    await deleteDoc(doc(db, "students", compositeDocId));
    await loadDirectory();
  } catch (error) {
    alert("Failed to delete user: " + error.message);
  } finally {
    if (typeof window.hideSubtleLoader === "function")
      window.hideSubtleLoader();
  }
};

window.clearDirectory = async function () {
  const firstConfirm = confirm(
    "⚠️ DANGER: Are you sure you want to delete ALL students and ALL grading data? This cannot be undone.",
  );
  if (!firstConfirm) return;

  const secondConfirm = confirm(
    "Please confirm one more time. This will wipe your entire directory AND reset all analytics metrics to zero.",
  );
  if (!secondConfirm) return;

  if (typeof window.showSubtleLoader === "function")
    window.showSubtleLoader("Wiping Database (Students & Grades)...");

  try {
    const deletePromises = [];
    let studentCount = 0;
    let gradeCount = 0;

    const studentSnap = await getDocs(collection(db, "students"));
    studentSnap.forEach((documentSnapshot) => {
      const data = documentSnapshot.data();
      if (data.email === SUPER_ADMIN_EMAIL || data.email === TEACHER_EMAIL)
        return;
      deletePromises.push(deleteDoc(doc(db, "students", documentSnapshot.id)));
      studentCount++;
    });

    const gradesSnap = await getDocs(collection(db, "grades"));
    gradesSnap.forEach((documentSnapshot) => {
      deletePromises.push(deleteDoc(doc(db, "grades", documentSnapshot.id)));
      gradeCount++;
    });

    if (deletePromises.length === 0) {
      alert("The database is already completely empty.");
      if (typeof window.hideSubtleLoader === "function")
        window.hideSubtleLoader();
      return;
    }

    await Promise.all(deletePromises);

    alert(
      `✅ Hard Reset Complete: Cleared ${studentCount} students and ${gradeCount} grade records.`,
    );

    await loadDirectory();
  } catch (error) {
    console.error("Error clearing database:", error);
    alert("❌ Failed to clear database: " + error.message);
  } finally {
    if (typeof window.hideSubtleLoader === "function")
      window.hideSubtleLoader();
  }
};
