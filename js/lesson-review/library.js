import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let db = null;
let libraryData = [];
let activeFolderId = null;

document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
});

function initFirebase() {
  const configStr = localStorage.getItem("Adminerva_firebase_config");
  if (!configStr) {
    document.getElementById("folderList").innerHTML =
      '<div class="text-xs text-red-500 italic p-4">Firebase not configured.</div>';
    return;
  }
  try {
    db = getFirestore(initializeApp(JSON.parse(configStr)));
    loadLibrary();
  } catch (e) {
    console.error("Firebase Initialization Failed:", e);
  }
}

function formatDate(isoString) {
  if (!isoString) return "Unknown date";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// --- FOLDER CRUD ---
async function loadLibrary() {
  if (!db) return;
  try {
    const querySnapshot = await getDocs(collection(db, "reference_folders"));
    libraryData = [];
    querySnapshot.forEach((docSnap) => {
      libraryData.push({ id: docSnap.id, ...docSnap.data() });
    });

    libraryData.sort((a, b) => a.name.localeCompare(b.name));
    localStorage.setItem("lessonReview_library", JSON.stringify(libraryData));

    renderFolders();
    if (activeFolderId && libraryData.find((f) => f.id === activeFolderId)) {
      selectFolder(activeFolderId);
    }
  } catch (e) {
    console.error("Error loading library:", e);
  }
}

window.createFolder = async function () {
  if (!db) return alert("Firebase is not connected.");
  const input = document.getElementById("newFolderInput");
  const folderName = input.value.trim();
  if (!folderName) return;

  try {
    const docRef = await addDoc(collection(db, "reference_folders"), {
      name: folderName,
      updatedAt: new Date().toISOString(),
      documents: [],
    });

    libraryData.push({
      id: docRef.id,
      name: folderName,
      updatedAt: new Date().toISOString(),
      documents: [],
    });
    libraryData.sort((a, b) => a.name.localeCompare(b.name));
    localStorage.setItem("lessonReview_library", JSON.stringify(libraryData));

    input.value = "";
    renderFolders();
    selectFolder(docRef.id);
  } catch (e) {
    alert("Failed to create folder: " + e.message);
  }
};

window.renameFolder = async function (e, folderId) {
  e.stopPropagation();
  const folder = libraryData.find((f) => f.id === folderId);
  const newName = prompt("Enter new folder name:", folder.name);
  if (!newName || newName.trim() === folder.name) return;

  try {
    await updateDoc(doc(db, "reference_folders", folderId), {
      name: newName.trim(),
      updatedAt: new Date().toISOString(),
    });
    folder.name = newName.trim();
    libraryData.sort((a, b) => a.name.localeCompare(b.name));
    localStorage.setItem("lessonReview_library", JSON.stringify(libraryData));
    renderFolders();
    if (activeFolderId === folderId) selectFolder(folderId);
  } catch (error) {
    alert("Error renaming folder: " + error.message);
  }
};

window.deleteFolder = async function (e, folderId) {
  e.stopPropagation();
  if (
    !confirm("Delete this folder and ALL its documents? This cannot be undone.")
  )
    return;

  try {
    await deleteDoc(doc(db, "reference_folders", folderId));
    libraryData = libraryData.filter((f) => f.id !== folderId);
    localStorage.setItem("lessonReview_library", JSON.stringify(libraryData));

    if (activeFolderId === folderId) {
      activeFolderId = null;
      document.getElementById("documentWorkspace").classList.add("hidden");
      document.getElementById("driveToolbar").classList.add("hidden");
      document.getElementById("blankWorkspace").classList.remove("hidden");
      document.getElementById("activeFolderTitle").innerHTML =
        `<span>📂</span> Select a Folder`;
    }
    renderFolders();
  } catch (error) {
    alert("Error deleting folder: " + error.message);
  }
};

function renderFolders() {
  const folderList = document.getElementById("folderList");
  folderList.innerHTML = "";

  libraryData.forEach((folder) => {
    const isActive = folder.id === activeFolderId;
    const bgClass = isActive
      ? "bg-blue-100 text-blue-900 font-bold"
      : "bg-white text-gray-700 hover:bg-gray-100";

    folderList.insertAdjacentHTML(
      "beforeend",
      `
            <div onclick="selectFolder('${folder.id}')" class="group flex justify-between items-center w-full p-3 rounded text-sm cursor-pointer border border-transparent ${bgClass}">
                <div class="flex items-center gap-2 truncate">
                    <span>📁</span>
                    <span class="truncate">${folder.name}</span>
                </div>
                <div class="group-hover-show flex gap-2">
                    <button onclick="renameFolder(event, '${folder.id}')" class="text-gray-400 hover:text-blue-600" title="Rename">✏️</button>
                    <button onclick="deleteFolder(event, '${folder.id}')" class="text-gray-400 hover:text-red-600" title="Delete">🗑️</button>
                </div>
            </div>
        `,
    );
  });
}

window.selectFolder = function (folderId) {
  activeFolderId = folderId;
  renderFolders();

  const folder = libraryData.find((f) => f.id === folderId);
  if (folder) {
    document.getElementById("activeFolderTitle").innerHTML =
      `<span>📂</span> ${folder.name}`;
    document.getElementById("documentWorkspace").classList.remove("hidden");
    document.getElementById("documentWorkspace").classList.add("flex");
    document.getElementById("driveToolbar").classList.remove("hidden");
    document.getElementById("blankWorkspace").classList.add("hidden");
    document.getElementById("searchInput").value = "";
    renderDocuments(folder.documents);
  }
};

// --- FILE CRUD & FILTERING ---
window.filterDocuments = function () {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const folder = libraryData.find((f) => f.id === activeFolderId);
  if (!folder) return;

  const filteredDocs = folder.documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(query) ||
      doc.text.toLowerCase().includes(query),
  );
  renderDocuments(filteredDocs);
};

window.renameDocument = async function (docIndex) {
  const folder = libraryData.find((f) => f.id === activeFolderId);
  if (!folder) return;

  const oldTitle = folder.documents[docIndex].title;
  const newTitle = prompt("Enter new document name:", oldTitle);
  if (!newTitle || newTitle.trim() === oldTitle) return;

  const updatedDocs = [...folder.documents];
  updatedDocs[docIndex].title = newTitle.trim();
  updatedDocs[docIndex].updatedAt = new Date().toISOString();

  try {
    await updateDoc(doc(db, "reference_folders", activeFolderId), {
      documents: updatedDocs,
    });
    folder.documents = updatedDocs;
    localStorage.setItem("lessonReview_library", JSON.stringify(libraryData));
    renderDocuments(folder.documents);
  } catch (e) {
    alert("Error renaming document: " + e.message);
  }
};

window.deleteDocument = async function (docIndex) {
  if (!confirm("Are you sure you want to delete this document?")) return;
  const folder = libraryData.find((f) => f.id === activeFolderId);

  const updatedDocs = [...folder.documents];
  updatedDocs.splice(docIndex, 1);

  try {
    await updateDoc(doc(db, "reference_folders", activeFolderId), {
      documents: updatedDocs,
    });
    folder.documents = updatedDocs;
    localStorage.setItem("lessonReview_library", JSON.stringify(libraryData));
    renderDocuments(folder.documents);
  } catch (e) {
    alert("Error deleting document: " + e.message);
  }
};

function renderDocuments(documentsArray) {
  const docList = document.getElementById("documentList");
  docList.innerHTML = "";

  if (!documentsArray || documentsArray.length === 0) {
    docList.innerHTML =
      '<div class="p-8 text-center text-gray-400 italic">No documents found.</div>';
    return;
  }

  documentsArray.forEach((doc, index) => {
    docList.insertAdjacentHTML(
      "beforeend",
      `
            <div class="group grid grid-cols-12 gap-4 px-6 py-4 border-b hover:bg-gray-50 items-center transition">
                <div class="col-span-6 flex items-center gap-3 truncate">
                    <span class="text-xl">📄</span>
                    <div class="truncate">
                        <p class="font-semibold text-gray-800 text-sm truncate cursor-pointer hover:text-blue-600" onclick="alert('PREVIEW:\\n\\n' + \`${doc.text.replace(/"/g, "'").substring(0, 500)}...\`)">${doc.title}</p>
                    </div>
                </div>
                <div class="col-span-4 text-sm text-gray-500">
                    ${formatDate(doc.updatedAt)}
                </div>
                <div class="col-span-2 text-right flex justify-end gap-3 group-hover-show">
                    <button onclick="renameDocument(${index})" class="text-gray-400 hover:text-blue-600" title="Rename">✏️</button>
                    <button onclick="deleteDocument(${index})" class="text-gray-400 hover:text-red-600" title="Delete">🗑️</button>
                </div>
            </div>
        `,
    );
  });
}

window.extractPDF = async function () {
  const fileInput = document.getElementById("pdfFileInput");
  if (!fileInput.files.length) return;

  if (fileInput.files.length > 5) {
    alert(
      "To prevent API rate limits, please select a maximum of 5 PDFs at once.",
    );
    fileInput.value = "";
    return;
  }

  const gemKey = (localStorage.getItem("Adminerva_gemini_token") || "").trim();
  const modelName = (
    localStorage.getItem("Adminerva_ai_model") || "gemini-1.5-flash"
  ).trim();

  if (!gemKey)
    return alert("Missing Gemini API Key. Please check your Global Settings.");

  const loader = document.getElementById("extractionLoader");
  const loaderText = document.getElementById("loaderText");
  loader.classList.replace("hidden", "flex");

  const folder = libraryData.find((f) => f.id === activeFolderId);
  let updatedDocs = [...(folder.documents || [])];

  // 🚀 NEW: Helper function to pause execution
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i];

      // 🚀 NEW: Apply a 4-second cooldown BEFORE the 2nd, 3rd, 4th, and 5th files
      if (i > 0) {
        if (loaderText)
          loaderText.innerText = `Cooling down API to prevent rate limits (waiting 4s)...`;
        await delay(4000);
      }

      if (loaderText) {
        loaderText.innerText = `Extracting ${i + 1} of ${fileInput.files.length}: ${file.name}...`;
      }

      const base64String = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(gemKey)}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                // 🚀 THE FIX: An unconditional command to extract everything (Text + Images)
                {
                  text: "You are a data ingestion engine. Extract ALL educational text from the attached PDF. You MUST process this document regardless of its format. Extract all standard digital text, AND use your vision capabilities to perform OCR on any scanned images, graphics, or diagrams to extract their text as well. Output ONLY the pure, raw extracted educational text. Do not output any conversational filler.",
                },
                {
                  inline_data: {
                    mime_type: "application/pdf",
                    data: base64String,
                  },
                },
              ],
            },
          ],
        }),
      });

      // 🚀 FIX: Removed the hardcoded "Not found" string to avoid confusing 503s with 404s
      if (!response.ok)
        throw new Error(
          `API Error on ${file.name}: Status ${response.status}. The API may be overloaded.`,
        );

      const result = await response.json();

      if (!result.candidates || result.candidates.length === 0) {
        console.error(`[Gemini API Error for ${file.name}]:`, result);
        throw new Error(
          `The AI refused to read "${file.name}". It may have triggered safety filters.`,
        );
      }

      const extractedText = result.candidates[0].content.parts[0].text;

      updatedDocs.push({
        title: file.name,
        text: extractedText,
        updatedAt: new Date().toISOString(),
      });
    }

    // Save to Firebase
    await updateDoc(doc(db, "reference_folders", activeFolderId), {
      documents: updatedDocs,
      updatedAt: new Date().toISOString(),
    });

    folder.documents = updatedDocs;
    localStorage.setItem("lessonReview_library", JSON.stringify(libraryData));
  } catch (error) {
    alert("Bulk extraction stopped. Error: " + error.message);
  } finally {
    fileInput.value = "";
    renderFolders();
    renderDocuments(folder.documents);

    loader.classList.replace("flex", "hidden");
    if (loaderText) loaderText.innerText = "Extracting PDF Data...";
  }
};
