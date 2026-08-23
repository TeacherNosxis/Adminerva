let libraryData = []; 
let activeFolderId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadLibrary();
});

// --- FOLDER MANAGEMENT ---
function loadLibrary() {
    libraryData = JSON.parse(localStorage.getItem('lessonReview_library') || '[]');
    renderFolders();
}

window.createFolder = function() {
    const input = document.getElementById('newFolderInput');
    const folderName = input.value.trim();
    if (!folderName) return;

    const newFolder = {
        id: 'folder_' + Date.now(),
        name: folderName,
        documents: []
    };

    libraryData.push(newFolder);
    localStorage.setItem('lessonReview_library', JSON.stringify(libraryData));
    input.value = '';
    
    renderFolders();
    selectFolder(newFolder.id);
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
            
        folderList.insertAdjacentHTML('beforeend', `
            <button onclick="selectFolder('${folder.id}')" class="${btnClass}">
                📁 ${folder.name} <span class="text-[10px] text-gray-500 font-normal ml-2">(${folder.documents.length} docs)</span>
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

window.deleteDocument = function(docIndex) {
    if (!confirm("Are you sure you want to delete this document from the folder?")) return;
    const folder = libraryData.find(f => f.id === activeFolderId);
    folder.documents.splice(docIndex, 1);
    localStorage.setItem('lessonReview_library', JSON.stringify(libraryData));
    renderFolders(); // Update doc count
    renderDocuments(folder);
};

function renderDocuments(folder) {
    const docList = document.getElementById('documentList');
    docList.innerHTML = '';

    if (folder.documents.length === 0) {
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
    
    const file = fileInput.files[0];
    const gemKey = localStorage.getItem('repoReview_gemini_token');
    const modelName = localStorage.getItem('repoReview_ai_model') || 'gemini-1.5-flash';

    if (!gemKey) return alert("Missing Gemini API Key. Configure it in Global Settings.");

    // The AI extraction prompt
    const systemPrompt = `
    You are a data ingestion engine. Read the attached PDF document and extract ALL educational content, syllabus details, module notes, and quiz questions. 
    Format the output as clean, highly readable raw text. Remove any messy formatting, page numbers, or visual artifacts.
    Output ONLY the extracted educational text.
    `;

    document.getElementById('extractionLoader').classList.replace('hidden', 'flex');

    try {
        // Step 1: Read the PDF file and convert to a Base64 string
        const base64String = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // reader.result looks like: "data:application/pdf;base64,JVBERi0xLjQK..."
                // We split it to only grab the raw base64 data after the comma
                resolve(reader.result.split(',')[1]); 
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });

        // Step 2: Send the Base64 PDF directly to Gemini
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

        // Step 3: Save the cleaned text to the active folder
        const folderIndex = libraryData.findIndex(f => f.id === activeFolderId);
        libraryData[folderIndex].documents.push({
            title: file.name,
            text: extractedText
        });

        localStorage.setItem('lessonReview_library', JSON.stringify(libraryData));
        
        // Reset file input and re-render
        fileInput.value = '';
        renderFolders(); 
        renderDocuments(libraryData[folderIndex]);

    } catch (error) {
        alert("Extraction failed. Ensure you are using gemini-1.5-flash or gemini-1.5-pro, as older models do not support PDF reading. Error: " + error.message);
    } finally {
        document.getElementById('extractionLoader').classList.replace('flex', 'hidden');
    }
};