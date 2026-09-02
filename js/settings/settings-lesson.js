import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const safeSet = (id, val) => {
  if (document.getElementById(id))
    document.getElementById(id).value = val || "";
};

const safeGet = (id) =>
  document.getElementById(id) ? document.getElementById(id).value.trim() : "";

window.populateSettingsSubjectDropdown = function () {
  const dataList = document.getElementById("savedSubjectsList");
  if (!dataList) return;

  const savedSub = localStorage.getItem("lessonReview_subjects") || "";
  const subjects = savedSub
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");

  dataList.innerHTML = "";
  subjects.forEach((sub) => {
    const option = document.createElement("option");
    option.value = sub;
    dataList.appendChild(option);
  });
};

window.loadLessonReviewSettings = async function () {
  let cloudData = null;

  if (window.db) {
    try {
      const docSnap = await getDoc(
        doc(window.db, "global_settings", "lesson_review_config"),
      );
      if (docSnap.exists()) {
        cloudData = docSnap.data();
      }
    } catch (e) {
      console.warn("Firestore unreachable. Falling back to local storage.", e);
    }
  }

  const data = {
    teacher_name:
      cloudData?.teacher_name ||
      localStorage.getItem("lessonReview_defaultTeacher") ||
      localStorage.getItem("lessonReview_teacherName") ||
      "",
    subject_title:
      cloudData?.subject_title ||
      localStorage.getItem("lessonReview_defaultSubject") ||
      localStorage.getItem("lessonReview_subjectTitle") ||
      "",
    default_prelim:
      cloudData?.default_prelim ||
      localStorage.getItem("lessonReview_defaultPrelim") ||
      "Opening Prayer\nAttendance Checking\nTECHNOTES",
    default_closing:
      cloudData?.default_closing ||
      localStorage.getItem("lessonReview_defaultClosing") ||
      "Summary of the Lesson\nClosing Prayer",
    sig_teacher:
      cloudData?.sig_teacher ||
      localStorage.getItem("lessonReview_sig1Name") ||
      localStorage.getItem("lessonReview_sigTeacher") ||
      "",
    sig_teacher_title:
      cloudData?.sig_teacher_title ||
      localStorage.getItem("lessonReview_sig1Title") ||
      localStorage.getItem("lessonReview_sigTeacherTitle") ||
      "",
    sig_subject_coord:
      cloudData?.sig_subject_coord ||
      localStorage.getItem("lessonReview_sig2Name") ||
      localStorage.getItem("lessonReview_sigSubjectCoord") ||
      "",
    sig_subject_coord_title:
      cloudData?.sig_subject_coord_title ||
      localStorage.getItem("lessonReview_sig2Title") ||
      localStorage.getItem("lessonReview_sigSubjectCoordTitle") ||
      "",
    sig_grade_coord:
      cloudData?.sig_grade_coord ||
      localStorage.getItem("lessonReview_sig3Name") ||
      localStorage.getItem("lessonReview_sigGradeCoord") ||
      "",
    sig_grade_coord_title:
      cloudData?.sig_grade_coord_title ||
      localStorage.getItem("lessonReview_sig3Title") ||
      localStorage.getItem("lessonReview_sigGradeCoordTitle") ||
      "",
    sig_principal:
      cloudData?.sig_principal ||
      localStorage.getItem("lessonReview_sig4Name") ||
      localStorage.getItem("lessonReview_sigPrincipal") ||
      "",
    sig_principal_title:
      cloudData?.sig_principal_title ||
      localStorage.getItem("lessonReview_sig4Title") ||
      localStorage.getItem("lessonReview_sigPrincipalTitle") ||
      "",
    headerBase64:
      cloudData?.header_image_base64 ||
      localStorage.getItem("lessonReview_headerImage") ||
      "",
  };

  safeSet("setTeacherName", data.teacher_name);
  safeSet("setSubjectTitle", data.subject_title);
  safeSet("setPrelimActivities", data.default_prelim);
  safeSet("setClosingActivities", data.default_closing);
  safeSet("sigTeacher", data.sig_teacher);
  safeSet("sigTeacherTitle", data.sig_teacher_title);
  safeSet("sigSubjectCoord", data.sig_subject_coord);
  safeSet("sigSubjectCoordTitle", data.sig_subject_coord_title);
  safeSet("sigGradeCoord", data.sig_grade_coord);
  safeSet("sigGradeCoordTitle", data.sig_grade_coord_title);
  safeSet("sigPrincipal", data.sig_principal);
  safeSet("sigPrincipalTitle", data.sig_principal_title);

  if (data.headerBase64 && document.getElementById("settingsHeaderBase64")) {
    document.getElementById("settingsHeaderBase64").value = data.headerBase64;
    const previewImg = document.getElementById("headerPreview");
    const placeholder = document.getElementById("headerPreviewPlaceholder");
    if (previewImg && placeholder) {
      previewImg.src = data.headerBase64;
      previewImg.classList.remove("hidden");
      placeholder.classList.add("hidden");
    }
  }

  window.populateSettingsSubjectDropdown();
};

window.previewHeaderImage = function (event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 800 * 1024) {
    alert(
      "Please choose a smaller image (under 800KB) to keep the database fast.",
    );
    return;
  }

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
  const hiddenInput = document.getElementById("settingsHeaderBase64");
  const fileInput = document.getElementById("settingsHeaderFile");
  if (hiddenInput) hiddenInput.value = "";
  if (fileInput) fileInput.value = "";

  const previewImg = document.getElementById("headerPreview");
  const placeholder = document.getElementById("headerPreviewPlaceholder");

  if (previewImg && placeholder) {
    previewImg.src = "";
    previewImg.classList.add("hidden");
    placeholder.classList.remove("hidden");
  }
};

window.saveLessonReviewSettings = async function () {
  if (typeof window.showLoader === "function") {
    window.showLoader("Saving Configurations...");
  }

  const headerBase64Val = safeGet("settingsHeaderBase64");

  const settingsData = {
    teacher_name: safeGet("setTeacherName"),
    subject_title: safeGet("setSubjectTitle"),
    default_prelim: safeGet("setPrelimActivities"),
    default_closing: safeGet("setClosingActivities"),
    header_image_base64: headerBase64Val,
    sig_teacher: safeGet("sigTeacher"),
    sig_teacher_title: safeGet("sigTeacherTitle"),
    sig_subject_coord: safeGet("sigSubjectCoord"),
    sig_subject_coord_title: safeGet("sigSubjectCoordTitle"),
    sig_grade_coord: safeGet("sigGradeCoord"),
    sig_grade_coord_title: safeGet("sigGradeCoordTitle"),
    sig_principal: safeGet("sigPrincipal"),
    sig_principal_title: safeGet("sigPrincipalTitle"),
    updated_at: new Date().toISOString(),
  };

  // Sync back to localStorage keys for dual compatibility across apps
  localStorage.setItem(
    "lessonReview_defaultTeacher",
    settingsData.teacher_name,
  );
  localStorage.setItem("lessonReview_teacherName", settingsData.teacher_name);
  localStorage.setItem(
    "lessonReview_defaultSubject",
    settingsData.subject_title,
  );
  localStorage.setItem("lessonReview_subjectTitle", settingsData.subject_title);
  localStorage.setItem(
    "lessonReview_defaultPrelim",
    settingsData.default_prelim,
  );
  localStorage.setItem(
    "lessonReview_defaultClosing",
    settingsData.default_closing,
  );
  localStorage.setItem(
    "lessonReview_headerImage",
    settingsData.header_image_base64,
  );
  localStorage.setItem("lessonReview_sig1Name", settingsData.sig_teacher);
  localStorage.setItem("lessonReview_sigTeacher", settingsData.sig_teacher);
  localStorage.setItem(
    "lessonReview_sig1Title",
    settingsData.sig_teacher_title,
  );
  localStorage.setItem(
    "lessonReview_sigTeacherTitle",
    settingsData.sig_teacher_title,
  );
  localStorage.setItem("lessonReview_sig2Name", settingsData.sig_subject_coord);
  localStorage.setItem(
    "lessonReview_sigSubjectCoord",
    settingsData.sig_subject_coord,
  );
  localStorage.setItem(
    "lessonReview_sig2Title",
    settingsData.sig_subject_coord_title,
  );
  localStorage.setItem(
    "lessonReview_sigSubjectCoordTitle",
    settingsData.sig_subject_coord_title,
  );
  localStorage.setItem("lessonReview_sig3Name", settingsData.sig_grade_coord);
  localStorage.setItem(
    "lessonReview_sigGradeCoord",
    settingsData.sig_grade_coord,
  );
  localStorage.setItem(
    "lessonReview_sig3Title",
    settingsData.sig_grade_coord_title,
  );
  localStorage.setItem(
    "lessonReview_sigGradeCoordTitle",
    settingsData.sig_grade_coord_title,
  );
  localStorage.setItem("lessonReview_sig4Name", settingsData.sig_principal);
  localStorage.setItem("lessonReview_sigPrincipal", settingsData.sig_principal);
  localStorage.setItem(
    "lessonReview_sig4Title",
    settingsData.sig_principal_title,
  );
  localStorage.setItem(
    "lessonReview_sigPrincipalTitle",
    settingsData.sig_principal_title,
  );

  if (window.db) {
    try {
      await setDoc(
        doc(window.db, "global_settings", "lesson_review_config"),
        settingsData,
        { merge: true },
      );
      alert(
        "✅ LessonReview settings and default activities successfully saved to the cloud and synced locally!",
      );
    } catch (e) {
      alert(`⚠️ Saved locally, but cloud sync failed: ${e.message}`);
    }
  } else {
    alert("✅ Settings saved locally (Firebase offline).");
  }

  if (typeof window.hideLoader === "function") {
    window.hideLoader();
  }
};
