import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let db = null;
let libraryData = []; 
let activeFolderId = null;

document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
});

function initFirebase() {
    const configStr = localStorage.getItem('repoReview_firebase_config');
    if (!configStr) {
        document.getElementById('folderList').innerHTML = '<div class="text-xs text-red-500 italic p-4">Firebase not configured. Please go to Global Settings.</div>';
        return;
    }
    try {
        const firebaseConfig = JSON.parse(configStr);
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        loadLibrary(); // Load from cloud once connected
    } catch (e) {
        console.error("Firebase Initialization Failed:", e);
    }
}

// --- FOLDER MANAGEMENT (FIREBASE SYNC) ---
async function loadLibrary() {
    if (!db) return;
    try {
        const querySnapshot = await getDocs(collection(db, "reference_folders"));
        libraryData = [];
        querySnapshot.forEach((docSnap) => {
            libraryData.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        // Save a backup to localStorage for speed
        localStorage.setItem('lessonReview_library', JSON.stringify(libraryData));
        
        renderFolders();
        if (activeFolderId && libraryData.find(f => f.id === activeFolderId)) {
            selectFolder(activeFolderId);
        }
    } catch (e) {
        console.error("Error loading library:", e);
        document.getElementById('folderList').innerHTML = '<div class="text-xs text-red-500 italic p-4">Error loading folders from Firebase.</div>';
    }
}

window.createFolder = async function() {
    if (!db) return alert("Firebase is not connected.");
    const input = document.getElementById('newFolderInput');
    const folderName = input.value.trim();
    if (!folderName) return;

    try {
        // Save to Firebase
        const docRef = await addDoc(collection(db, "reference_folders"), {
            name: folderName,
            documents: []
        });
        
        const newFolder = { id: docRef.id, name: folderName, documents: [] };
        libraryData.push(newFolder);
        localStorage.setItem('lessonReview_library', JSON.stringify(libraryData));
        input.value = '';
        
        renderFolders();
        selectFolder(newFolder.id);
    } catch (e) {
        alert("Failed to create folder in Firebase: " + e.message);
    }
};

function renderFolders() {
    const folderList = document.getElementById('folderList');
    folderList.innerHTML = '';

    if (libraryData.length === 0) {
        folderList.innerHTML = '<div class="text-xs text-gray-400 italic">No folders created yet.</div>';
        return;
    }

    libraryData.forEach(folder => {
        const isActive = folder.id === activeFolderId;
        const btnClass = isActive 
            ? "w-full text-left p-3 rounded font-bold text-sm bg-blue-100 text-blue-900 border border-blue-200" 
            : "w-full text-left p-3 rounded font-bold text-sm bg-white text-gray-700 hover:bg-gray-100 border border-transparent";
            
        const docCount = folder.documents ? folder.documents.length : 0;
            
        folderList.insertAdjacentHTML('beforeend', `
            <button onclick="selectFolder('${folder.id}')" class="${btnClass}">
                📁 ${folder.name} <span class="text-[10px] text-gray-500 font-normal ml-2">(${docCount} docs)</span>
            </button>
        `);
    });
}

window.selectFolder = function(folderId) {
    activeFolderId = folderId;
    renderFolders();

    const folder = libraryData.find(f => f.id === folderId);
    if (folder) {
        document.getElementById('activeFolderTitle').textContent = `📁 ${folder.name}`;
        document.getElementById('uploadWorkspace').classList.remove('hidden');
        document.getElementById('uploadWorkspace').classList.add('flex');
        document.getElementById('blankWorkspace').classList.add('hidden');
        renderDocuments(folder);
    }
};

window.deleteDocument = async function(docIndex) {
    if (!confirm("Are you sure you want to delete this document from the folder?")) return;
    if (!db) return alert("Firebase is not connected.");

    const folder = libraryData.find(f => f.id === activeFolderId);
    if(!folder) return;

    // Create a copy of documents and remove the target one
    const updatedDocs = [...folder.documents];
    updatedDocs.splice(docIndex, 1);

    try {
        await updateDoc(doc(db, "reference_folders", activeFolderId), {
            documents: updatedDocs
        });
        
        // Update local state if firebase succeeds
        folder.documents = updatedDocs;
        localStorage.setItem('lessonReview_library', JSON.stringify(libraryData));
        
        renderFolders(); 
        renderDocuments(folder);
    } catch(e) {
        alert("Error deleting document from Firebase: " + e.message);
    }
};

function renderDocuments(folder) {
    const docList = document.getElementById('documentList');
    docList.innerHTML = '';

    if (!folder.documents || folder.documents.length === 0) {
        docList.innerHTML = '<div class="col-span-2 text-center text-sm text-gray-400 italic py-8 border-2 border-dashed rounded">No documents extracted yet. Upload a PDF above.</div>';
        return;
    }

    folder.documents.forEach((doc, index) => {
        docList.insertAdjacentHTML('beforeend', `
            <div class="bg-white p-4 rounded border border-gray-200 shadow-sm relative group">
                <h4 class="font-bold text-blue-800 text-sm truncate pr-8">${doc.title}</h4>
                <p class="text-xs text-gray-500 mt-1 line-clamp-3">${doc.text}</p>
                <button onclick="deleteDocument(${index})" class="absolute top-4 right-4 text-gray-400 hover:text-red-500 hidden group-hover:block transition" title="Delete Document">✖</button>
            </div>
        `);
    });
}

// --- AI PDF EXTRACTION ENGINE ---
window.extractPDF = async function() {
    const fileInput = document.getElementById('pdfFileInput');
    if (!fileInput.files.length) return;
    if (!db) return alert("Firebase is not connected. Save configuration first.");
    
    const file = fileInput.files[0];
    const gemKey = localStorage.getItem('repoReview_gemini_token');
    const modelName = localStorage.getItem('repoReview_ai_model') || 'gemini-1.5-flash';

    if (!gemKey) return alert("Missing Gemini API Key. Configure it in Global Settings.");

    const systemPrompt = `
    You are a data ingestion engine. Read the attached PDF document and extract ALL educational content, syllabus details, module notes, and quiz questions. 
    Format the output as clean, highly readable raw text. Remove any messy formatting, page numbers, or visual artifacts.
    Output ONLY the extracted educational text.
    `;

    document.getElementById('extractionLoader').classList.replace('hidden', 'flex');

    try {
        const base64String = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${gemKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { inline_data: { mime_type: "application/pdf", data: base64String } }
                    ]
                }]
            })
        });

        if (!response.ok) throw new Error("API Error: " + response.statusText);
        
        const result = await response.json();
        const extractedText = result.candidates[0].content.parts[0].text;

        const folderIndex = libraryData.findIndex(f => f.id === activeFolderId);
        const updatedDocs = [...(libraryData[folderIndex].documents || [])];
        
        updatedDocs.push({
            title: file.name,
            text: extractedText
        });

        // Save to Firebase
        await updateDoc(doc(db, "reference_folders", activeFolderId), {
            documents: updatedDocs
        });

        // Update local state if firebase succeeds
        libraryData[folderIndex].documents = updatedDocs;
        localStorage.setItem('lessonReview_library', JSON.stringify(libraryData));
        
        fileInput.value = '';
        renderFolders(); 
        renderDocuments(libraryData[folderIndex]);

    } catch (error) {
        alert("Extraction/Saving failed. Error: " + error.message);
    } finally {
        document.getElementById('extractionLoader').classList.replace('flex', 'hidden');
    }
};