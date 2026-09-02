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

// 🚀 Vertical Sidebar Navigation
window.switchSettingsCategory = function (targetPanelId) {
  // 1. Hide all panels
  const panels = document.querySelectorAll(".settings-panel");
  panels.forEach((p) => p.classList.replace("block", "hidden"));

  // 2. Remove active state from all buttons
  const buttons = document.querySelectorAll(".sidebar-btn");
  buttons.forEach((b) => b.classList.remove("sidebar-active"));

  // 3. Show target panel and set active state
  const targetPanel = document.getElementById(`panel-${targetPanelId}`);
  const targetBtn = document.getElementById(`navBtn-${targetPanelId}`);

  if (targetPanel && targetBtn) {
    targetPanel.classList.replace("hidden", "block");
    targetBtn.classList.add("sidebar-active");
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
  if (window.initRubrics) window.initRubrics();

  // Boot Firebase - will automatically fetch cloud settings once connected
  if (window.initFirebase) window.initFirebase();

  const csvInput = document.getElementById("csvFileInput");
  if (csvInput && window.handleCsvUpload)
    csvInput.addEventListener("change", window.handleCsvUpload);
});
