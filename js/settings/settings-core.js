window.showLoader = function (msg = "Processing...") {
  const msgEl = document.getElementById("loaderMessage");
  if (msgEl) msgEl.textContent = msg;
  const loader = document.getElementById("globalLoader");
  if (loader) loader.classList.replace("hidden", "flex");
};

window.hideLoader = function () {
  const loader = document.getElementById("globalLoader");
  if (loader) loader.classList.replace("flex", "hidden");
};

window.handleCsvUpload = function (event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!window.db) return alert("Firebase disconnected. Check settings.");
  window.showLoader("Importing and Deduplicating Students...");

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async function (results) {
      const data = results.data;
      const uniqueStudents = new Map();

      for (const row of data) {
        // 1. Target the exact First/Last name columns from the form and combine them
        const firstName = row["Your First Name:"] || row.FirstName || "";
        const lastName = row["Your Last Name:"] || row.LastName || "";
        const name =
          `${firstName} ${lastName}`.trim() ||
          row.Name ||
          row["Full Name"] ||
          "";

        // 2. Target the exact email column
        const email = row["Email Address"] || row.Email || row.email || "";

        // 3. Target the Section
        const section =
          row.Section ||
          row.section ||
          document.getElementById("sectionFilterSelect")?.value ||
          "Default";

        // 4. Target the exact GitHub username column
        const githubUsername =
          row["Exact GitHub Username"] ||
          row.GitHubUsername ||
          row["GitHub Username"] ||
          "";

        // 5. Target the exact Repo URL column AND strip out any accidental brackets [ ] or spaces
        let repoUrl =
          row["Public Repository URL"] ||
          row.RepoUrl ||
          row["Repository Link"] ||
          "";
        repoUrl = repoUrl.replace(/[\[\]\s]/g, ""); // Cleans [https://...] to https://...

        // If the core data exists, add it to the Map (newest overwrites oldest automatically)
        if (name && githubUsername && repoUrl) {
          const uniqueKey = email
            ? email.toLowerCase().trim()
            : name.toLowerCase().trim();

          uniqueStudents.set(uniqueKey, {
            name,
            email,
            section,
            githubUsername,
            repoUrl,
          });
        }
      }

      try {
        const { collection, addDoc } =
          await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
        let successCount = 0;

        for (const [key, studentData] of uniqueStudents.entries()) {
          await addDoc(collection(window.db, "students"), studentData);
          successCount++;
        }

        event.target.value = "";
        if (window.loadSectionsAndStudents)
          await window.loadSectionsAndStudents();

        if (successCount === 0) {
          alert(
            "⚠️ 0 students imported. Please double-check your CSV headers.",
          );
        } else {
          alert(`✅ Successfully imported ${successCount} unique students.`);
        }
      } catch (err) {
        alert("Import failed: " + err.message);
      } finally {
        window.hideLoader();
      }
    },
    error: function (err) {
      window.hideLoader();
      alert("Failed to read CSV: " + err.message);
    },
  });
};

// 🚀 Vertical Sidebar Navigation (Dynamic Tailwind Injection)
window.switchSettingsCategory = function (targetPanelId) {
  // 1. Hide all right-side panels
  const panels = document.querySelectorAll(".settings-panel");
  panels.forEach((p) => p.classList.replace("block", "hidden"));

  // 2. Define the exact Tailwind strings for our states
  const activeClasses = [
    "bg-purple-50",
    "text-purple-700",
    "border-r-4",
    "border-purple-600",
  ];
  const inactiveClasses = ["text-gray-600", "hover:bg-gray-100", "rounded-lg"];

  // 3. Reset ALL buttons to the inactive gray state
  const buttons = document.querySelectorAll(".sidebar-btn");
  buttons.forEach((b) => {
    b.classList.remove(...activeClasses);
    b.classList.add(...inactiveClasses);
  });

  // 4. Show the target panel and apply the purple active state to the clicked button
  const targetPanel = document.getElementById(`panel-${targetPanelId}`);
  const targetBtn = document.getElementById(`navBtn-${targetPanelId}`);

  if (targetPanel && targetBtn) {
    targetPanel.classList.replace("hidden", "block");

    // Strip the gray hover and rounded corners, add the purple highlight
    targetBtn.classList.remove(...inactiveClasses);
    targetBtn.classList.add(...activeClasses);
  }
};

window.previewHeaderImage = function (event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 800 * 1024)
    return alert("Please choose an image under 800KB.");

  const reader = new FileReader();
  reader.onload = function (e) {
    const base64String = e.target.result;
    const hiddenInput = document.getElementById("settingsHeaderBase64");
    if (hiddenInput) hiddenInput.value = base64String;
    const previewImg = document.getElementById("headerPreview");
    const placeholder = document.getElementById("headerPreviewPlaceholder");
    if (previewImg && placeholder) {
      previewImg.src = base64String;
      previewImg.classList.remove("hidden");
      placeholder.classList.add("hidden");
    }
  };
  reader.readAsDataURL(file);
};

window.clearHeaderImage = function () {
  if (document.getElementById("settingsHeaderBase64"))
    document.getElementById("settingsHeaderBase64").value = "";
  if (document.getElementById("settingsHeaderFile"))
    document.getElementById("settingsHeaderFile").value = "";
  const previewImg = document.getElementById("headerPreview");
  const placeholder = document.getElementById("headerPreviewPlaceholder");
  if (previewImg && placeholder) {
    previewImg.src = "";
    previewImg.classList.add("hidden");
    placeholder.classList.remove("hidden");
  }
};

// Modal Toggles
window.openSectionsModal = () => {
  if (window.renderSectionsManagerTable) window.renderSectionsManagerTable();
  document.getElementById("sectionsModal")?.classList.replace("hidden", "flex");
};
window.closeSectionsModal = () =>
  document.getElementById("sectionsModal")?.classList.replace("flex", "hidden");
window.closeStudentModal = () =>
  document.getElementById("studentModal")?.classList.replace("flex", "hidden");

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  if (window.loadSecuritySettings) window.loadSecuritySettings();

  // 1. Boot Firebase FIRST so window.db is established
  if (window.initFirebase) window.initFirebase();

  // 2. Fetch cloud rubrics AFTER Firebase is connected
  if (window.initRubrics) window.initRubrics();

  const csvInput = document.getElementById("csvFileInput");
  if (csvInput && window.handleCsvUpload)
    csvInput.addEventListener("change", window.handleCsvUpload);
});
