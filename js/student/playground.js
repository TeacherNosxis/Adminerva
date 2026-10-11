import { db, auth } from "../core/firebase-core.js";
import {
  collection,
  addDoc,
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const languageConfig = {
  java: {
    monaco: "java",
    judge0Id: 62,
    defaultFile: "Main.java",
    defaultCode:
      'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Adminerva!");\n    }\n}',
  },
  python: {
    monaco: "python",
    judge0Id: 71,
    defaultFile: "main.py",
    defaultCode: 'print("Hello, Adminerva!")',
  },
  web: {
    monaco: "html",
    judge0Id: null,
    defaultFile: "index.html",
    defaultCode:
      '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <style>\n    body { background-color: #0f172a; color: #22d3ee; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }\n  </style>\n</head>\n<body>\n  <h1>Hello, Adminerva Web!</h1>\n</body>\n</html>',
  },
  csharp: {
    monaco: "csharp",
    judge0Id: 51,
    defaultFile: "Program.cs",
    defaultCode:
      'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, Adminerva!");\n    }\n}',
  },
  cpp: {
    monaco: "cpp",
    judge0Id: 54,
    defaultFile: "main.cpp",
    defaultCode:
      '#include <iostream>\n\nint main() {\n    std::cout << "Hello, Adminerva!" << std::endl;\n    return 0;\n}',
  },
  dart: {
    monaco: "dart",
    judge0Id: 64,
    defaultFile: "main.dart",
    defaultCode: "void main() {\n  print('Hello, Adminerva!');\n}",
  },
};

let editorInstance = null;
let currentLang = "java";
let workspaceFiles = {};
let fileOrder = []; // Tracks tab order for drag & drop
let activeFilename = "";
let draggedTabIndex = -1;

// ==========================================
// 2. INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("pageBody").classList.remove("hidden");

  require.config({
    paths: {
      vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs",
    },
  });
  require(["vs/editor/editor.main"], async function () {
    monaco.editor.defineTheme("adminervaDark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "64748b", fontStyle: "italic" },
        { token: "keyword", foreground: "22d3ee", fontStyle: "bold" },
        { token: "string", foreground: "a5f3fc" },
        { token: "number", foreground: "38bdf8" },
      ],
      colors: {
        "editor.background": "#0f172a",
        "editor.foreground": "#f8fafc",
        "editorCursor.foreground": "#22d3ee",
        "editor.lineHighlightBackground": "#1e293b",
        "editorLineNumber.foreground": "#475569",
        "editorIndentGuide.background": "#1e293b",
      },
    });

    editorInstance = monaco.editor.create(
      document.getElementById("editorContainer"),
      {
        theme: "adminervaDark",
        automaticLayout: true,
        fontSize: 14,
        fontFamily: "Fira Code, monospace",
        minimap: { enabled: false },
        padding: { top: 16 },
      },
    );

    document.getElementById("editorLoading").classList.add("hidden");

    bindUIEvents();
    initResizer();
    setupWebConsoleHook();

    // Global click listener to close tab dropdown menus
    document.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-dropdown")
        .forEach((menu) => menu.classList.add("hidden"));
    });

    const urlParams = new URLSearchParams(window.location.search);
    const snapshotId = urlParams.get("id");

    if (snapshotId) await loadSnapshot(snapshotId);
    else loadLocalWorkspace();
  });
});

// ==========================================
// 3. WORKSPACE & FILE MANAGEMENT
// ==========================================
function createWorkspace(lang, initialFiles, initialOrder) {
  currentLang = lang;
  document.getElementById("languageSelect").value = lang;

  Object.values(workspaceFiles).forEach((f) => f.model.dispose());
  workspaceFiles = {};
  fileOrder = [];

  const filesToCreate = initialFiles || {
    [languageConfig[lang].defaultFile]: languageConfig[lang].defaultCode,
  };

  // Reconstruct order if provided, otherwise default to Object keys
  const orderToUse = initialOrder || Object.keys(filesToCreate);

  orderToUse.forEach((filename) => {
    if (filesToCreate[filename] !== undefined) {
      addFile(filename, filesToCreate[filename], false);
    }
  });

  switchTab(fileOrder[0]);
  updateOutputView();
}

function addFile(filename, content = "", autoSwitch = true) {
  if (workspaceFiles[filename]) return alert("File already exists!");

  let syntax = languageConfig[currentLang].monaco;
  if (filename.endsWith(".css")) syntax = "css";
  if (filename.endsWith(".js")) syntax = "javascript";
  if (filename.endsWith(".html")) syntax = "html";

  const model = monaco.editor.createModel(content, syntax);
  workspaceFiles[filename] = { model };
  fileOrder.push(filename);

  model.onDidChangeContent(() => {
    triggerAutoSave();
    monaco.editor.setModelMarkers(model, "judge0", []);
  });

  if (autoSwitch) switchTab(filename);
  else renderTabs();
}

function switchTab(filename) {
  if (!workspaceFiles[filename]) return;
  activeFilename = filename;
  editorInstance.setModel(workspaceFiles[filename].model);
  renderTabs();
}

// ------------------------------------------
// 3B. RENAME & DELETE LOGIC
// ------------------------------------------
function renameFile(oldName) {
  const newName = prompt(`Rename ${oldName} to:`, oldName);
  if (!newName || newName.trim() === "" || newName === oldName) return;
  if (workspaceFiles[newName])
    return alert("A file with that name already exists!");

  // Extract content and dispose old model
  const content = workspaceFiles[oldName].model.getValue();
  workspaceFiles[oldName].model.dispose();
  delete workspaceFiles[oldName];

  // Update tracking array
  const idx = fileOrder.indexOf(oldName);
  fileOrder.splice(idx, 1);

  // Re-inject file with exact new syntax and exact original position
  let syntax = languageConfig[currentLang].monaco;
  if (newName.endsWith(".css")) syntax = "css";
  if (newName.endsWith(".js")) syntax = "javascript";
  if (newName.endsWith(".html")) syntax = "html";

  const model = monaco.editor.createModel(content, syntax);
  workspaceFiles[newName] = { model };
  fileOrder.splice(idx, 0, newName);

  model.onDidChangeContent(() => {
    triggerAutoSave();
    monaco.editor.setModelMarkers(model, "judge0", []);
  });

  if (activeFilename === oldName) activeFilename = newName;
  switchTab(activeFilename);
  triggerAutoSave();
}

function deleteFile(filename) {
  if (confirm(`Are you sure you want to delete ${filename}?`)) {
    workspaceFiles[filename].model.dispose();
    delete workspaceFiles[filename];

    const idx = fileOrder.indexOf(filename);
    fileOrder.splice(idx, 1);

    if (activeFilename === filename) switchTab(fileOrder[0]);
    else renderTabs();

    triggerAutoSave();
  }
}

// ------------------------------------------
// 3C. TAB RENDERING & DRAG/DROP
// ------------------------------------------
function renderTabs() {
  const container = document.getElementById("fileTabsContainer");
  container.innerHTML = "";

  fileOrder.forEach((filename, index) => {
    const isActive = filename === activeFilename;
    const tabClass = isActive
      ? "bg-[#0f172a] text-cyan-400 border-t-2 border-cyan-400"
      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border-t-2 border-transparent";

    const tabHTML = `
      <div class="px-4 py-2 cursor-pointer flex items-center gap-1 text-xs font-bold transition relative group tab-element ${tabClass}" 
           draggable="true" data-index="${index}" data-filename="${escapeHTML(filename)}">
        <span class="pointer-events-none tracking-wide">${escapeHTML(filename)}</span>
        
        <!-- 3 Dots Context Menu -->
        <div class="relative ml-1">
           <button class="menu-btn opacity-0 group-hover:opacity-100 px-1 pb-1 hover:text-white transition-opacity">⋮</button>
           <div class="tab-dropdown absolute left-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-xl hidden flex-col z-[100] w-24 overflow-hidden">
               <button class="rename-btn text-left px-3 py-1.5 text-[10px] hover:bg-slate-700 text-slate-200 border-b border-slate-700 uppercase tracking-widest">Rename</button>
               ${fileOrder.length > 1 ? `<button class="delete-btn text-left px-3 py-1.5 text-[10px] hover:bg-rose-900/80 text-rose-300 uppercase tracking-widest">Delete</button>` : ""}
           </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", tabHTML);
  });

  container.insertAdjacentHTML(
    "beforeend",
    `
    <button id="addFileBtn" class="text-slate-400 hover:text-white px-4 h-full flex items-center justify-center font-bold text-lg hover:bg-slate-800 transition shrink-0" title="Add new file">+</button>
  `,
  );

  attachTabEvents();
}

function attachTabEvents() {
  const container = document.getElementById("fileTabsContainer");

  // Add File Button
  container.querySelector("#addFileBtn").onclick = () => {
    const name = prompt("Enter file name (e.g., Student.java, style.css):");
    if (name && name.trim()) addFile(name.trim());
  };

  container.querySelectorAll(".tab-element").forEach((tab) => {
    const filename = tab.getAttribute("data-filename");
    const index = parseInt(tab.getAttribute("data-index"));

    // Switch Tab
    tab.addEventListener("click", (e) => {
      // Ignore click if clicking the menu or dropdown options
      if (e.target.closest(".menu-btn") || e.target.closest(".tab-dropdown"))
        return;
      switchTab(filename);
    });

    // Dropdown Toggling
    const menuBtn = tab.querySelector(".menu-btn");
    const dropdown = tab.querySelector(".tab-dropdown");
    if (menuBtn && dropdown) {
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent tab switch
        // Close all other dropdowns
        document.querySelectorAll(".tab-dropdown").forEach((m) => {
          if (m !== dropdown) m.classList.add("hidden");
        });
        dropdown.classList.toggle("hidden");
      });
    }

    // Rename / Delete
    const renameBtn = tab.querySelector(".rename-btn");
    if (renameBtn)
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.add("hidden");
        renameFile(filename);
      });

    const deleteBtn = tab.querySelector(".delete-btn");
    if (deleteBtn)
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.add("hidden");
        deleteFile(filename);
      });

    // Drag & Drop
    tab.addEventListener("dragstart", (e) => {
      draggedTabIndex = index;
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => tab.classList.add("opacity-50"), 0);
    });

    tab.addEventListener("dragover", (e) => {
      e.preventDefault();
      tab.classList.add("bg-slate-600");
    });

    tab.addEventListener("dragleave", () =>
      tab.classList.remove("bg-slate-600"),
    );

    tab.addEventListener("drop", (e) => {
      e.preventDefault();
      tab.classList.remove("bg-slate-600");
      const targetIndex = index;

      if (draggedTabIndex !== -1 && draggedTabIndex !== targetIndex) {
        const movedItem = fileOrder.splice(draggedTabIndex, 1)[0];
        fileOrder.splice(targetIndex, 0, movedItem);
        renderTabs();
        triggerAutoSave();
      }
    });

    tab.addEventListener("dragend", () => {
      tab.classList.remove("opacity-50");
      draggedTabIndex = -1;
    });
  });
}

// ==========================================
// 4. STORAGE, ZIP, & SNAPSHOTS
// ==========================================
let autoSaveTimeout;
function triggerAutoSave() {
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    const state = { lang: currentLang, files: {}, fileOrder: fileOrder };
    for (const [name, file] of Object.entries(workspaceFiles)) {
      state.files[name] = file.model.getValue();
    }
    localStorage.setItem(
      "Adminerva_Playground_Workspace",
      JSON.stringify(state),
    );

    const indicator = document.getElementById("autoSaveIndicator");
    indicator.classList.remove("opacity-0");
    setTimeout(() => indicator.classList.add("opacity-0"), 2000);
  }, 1000);
}

function loadLocalWorkspace() {
  const saved = localStorage.getItem("Adminerva_Playground_Workspace");
  if (saved) {
    const state = JSON.parse(saved);
    createWorkspace(state.lang, state.files, state.fileOrder);
  } else {
    createWorkspace("java");
  }
}

async function exportZIP() {
  const btn = document.getElementById("exportZipBtn");
  btn.innerHTML = `<span class="animate-spin">↻</span> Packing...`;
  try {
    const zip = new JSZip();
    for (const [name, file] of Object.entries(workspaceFiles)) {
      zip.file(name, file.model.getValue());
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Adminerva_Project_${currentLang}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("Failed to export ZIP.");
  }
  btn.innerHTML = `📥 Export ZIP`;
}

async function shareSnapshot() {
  const btn = document.getElementById("snapshotBtn");
  btn.innerHTML = `<span class="animate-spin">↻</span> Generating...`;
  const state = {
    lang: currentLang,
    files: {},
    fileOrder: fileOrder,
    timestamp: new Date().toISOString(),
  };
  for (const [name, file] of Object.entries(workspaceFiles))
    state.files[name] = file.model.getValue();

  try {
    const docRef = await addDoc(collection(db, "playground_snapshots"), state);
    const link = `${window.location.origin}${window.location.pathname}?id=${docRef.id}`;
    navigator.clipboard.writeText(link);
    btn.innerHTML = `✅ Link Copied!`;
  } catch (error) {
    btn.innerHTML = `❌ Error`;
  }
  setTimeout(() => (btn.innerHTML = `🔗 Share Snapshot`), 3000);
}

async function loadSnapshot(id) {
  try {
    const docSnap = await getDoc(doc(db, "playground_snapshots", id));
    if (docSnap.exists()) {
      const data = docSnap.data();
      createWorkspace(data.lang, data.files, data.fileOrder);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      alert("Snapshot not found.");
      loadLocalWorkspace();
    }
  } catch (error) {
    alert("Error loading snapshot.");
    loadLocalWorkspace();
  }
}

// ==========================================
// 5. EXECUTION ENGINE & DIAGNOSTICS
// ==========================================
async function executeCode() {
  const runBtn = document.getElementById("runBtn");
  const overlay = document.getElementById("executionOverlay");
  const consoleOut = document.getElementById("consoleOutput");

  runBtn.disabled = true;
  runBtn.classList.add("opacity-50");
  overlay.classList.remove("hidden");

  Object.values(workspaceFiles).forEach((f) =>
    monaco.editor.setModelMarkers(f.model, "judge0", []),
  );

  if (currentLang === "web") {
    consoleOut.textContent = "Web Preview Running...\n\n--- Console Logs ---\n";
    executeWebPreview();
    runBtn.disabled = false;
    runBtn.classList.remove("opacity-50");
    overlay.classList.add("hidden");
    return;
  }

  consoleOut.textContent = "";
  try {
    const config = languageConfig[currentLang];
    let mainContent =
      workspaceFiles[config.defaultFile]?.model.getValue() || "";
    let base64Zip = null;
    const fileKeys = Object.keys(workspaceFiles);

    if (fileKeys.length > 1) {
      const zip = new JSZip();
      fileKeys.forEach((name) => {
        if (name !== config.defaultFile)
          zip.file(name, workspaceFiles[name].model.getValue());
      });
      base64Zip = await zip.generateAsync({ type: "base64" });
    }

    const payload = {
      source_code: mainContent,
      language_id: config.judge0Id,
      stdin: document.getElementById("stdinInput").value,
    };
    if (base64Zip) payload.additional_files = base64Zip;

    const res = await fetch(
      "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = await res.json();

    if (result.stderr || result.compile_output) {
      const errText = result.stderr || result.compile_output;
      consoleOut.innerHTML = `<span class="text-rose-400">${escapeHTML(errText)}</span>\n${escapeHTML(result.stdout || "")}`;
      applyVisualDiagnostics(errText, config.defaultFile);
    } else {
      consoleOut.textContent =
        result.stdout || "Program exited with no output.";
    }
  } catch (error) {
    consoleOut.innerHTML = `<span class="text-rose-400">Execution Error: ${error.message}</span>`;
  } finally {
    overlay.classList.add("hidden");
    runBtn.disabled = false;
    runBtn.classList.remove("opacity-50");
  }
}

function applyVisualDiagnostics(errorText, defaultFile) {
  const markers = [];
  const lines = errorText.split("\n");
  const lineRegex = new RegExp(`${defaultFile.replace(".", "\\.")}:(\\d+):`);

  lines.forEach((line) => {
    const match = line.match(lineRegex);
    if (match) {
      const lineNum = parseInt(match[1], 10);
      markers.push({
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: 100,
        message: line.trim(),
        severity: monaco.MarkerSeverity.Error,
      });
    }
  });

  if (markers.length > 0 && workspaceFiles[defaultFile]) {
    monaco.editor.setModelMarkers(
      workspaceFiles[defaultFile].model,
      "judge0",
      markers,
    );
  }
}

function executeWebPreview() {
  let html = workspaceFiles["index.html"]?.model.getValue() || "";
  let css = "",
    js = "";

  for (const [name, file] of Object.entries(workspaceFiles)) {
    if (name.endsWith(".css")) css += `<style>${file.model.getValue()}</style>`;
    if (name.endsWith(".js")) {
      let guardedJS =
        `window.__adminerva_loop_start = Date.now();\n` +
        file.model
          .getValue()
          .replace(
            /(for\s*\(.*?\)\s*\{|while\s*\(.*?\)\s*\{|do\s*\{)/g,
            (match) => {
              return (
                match +
                ` if (Date.now() - window.__adminerva_loop_start > 2000) { console.error('Adminerva Timeout Guard: Infinite loop broken.'); break; } `
              );
            },
          );
      js += `<script>${guardedJS}</script>`;
    }
  }

  const consoleHook = `
    <script>
      const _log = console.log, _warn = console.warn, _err = console.error;
      console.log = function(...args) { _log(...args); window.parent.postMessage({type: 'console', method: 'log', data: args.join(' ')}, '*'); };
      console.warn = function(...args) { _warn(...args); window.parent.postMessage({type: 'console', method: 'warn', data: args.join(' ')}, '*'); };
      console.error = function(...args) { _err(...args); window.parent.postMessage({type: 'console', method: 'error', data: args.join(' ')}, '*'); };
      window.onerror = function(msg, url, line) { console.error(msg + ' (Line ' + line + ')'); return false; };
    </script>
  `;

  if (html.includes("</head>"))
    html = html.replace("</head>", consoleHook + css + "</head>");
  else html = consoleHook + css + html;

  if (html.includes("</body>")) html = html.replace("</body>", js + "</body>");
  else html += js;

  document.getElementById("webPreviewFrame").srcdoc = html;
}

function setupWebConsoleHook() {
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "console") {
      const consoleOut = document.getElementById("consoleOutput");
      let colorClass = "text-slate-300";
      if (e.data.method === "warn") colorClass = "text-amber-400";
      if (e.data.method === "error") colorClass = "text-rose-400";
      consoleOut.innerHTML += `<div class="${colorClass}">> ${escapeHTML(e.data.data)}</div>`;
      consoleOut.scrollTop = consoleOut.scrollHeight;
    }
  });
}

// ==========================================
// 6. BYOK SOCRATIC AI TUTOR
// ==========================================
async function askMinerva() {
  let apiKey = localStorage.getItem("Adminerva_Gemini_Key");
  if (!apiKey) {
    if (
      confirm(
        "No Gemini API Key found!\n\nTo use Minerva AI Tutor, please add your free Gemini key in Account Settings.\n\nWould you like to go to Settings now?",
      )
    ) {
      window.location.href = "student-settings.html";
    }
    return;
  }

  const btn = document.getElementById("aiTutorBtn");
  const consoleOut = document.getElementById("consoleOutput");

  document.getElementById("consoleTab").click();
  btn.innerHTML = `<span class="animate-spin">✨</span> Thinking...`;

  let context = `I am a student learning to program in ${currentLang}.\nHere are my files:\n`;
  for (const [name, file] of Object.entries(workspaceFiles)) {
    context += `\n--- ${name} ---\n${file.model.getValue()}\n`;
  }
  const errorText = consoleOut.textContent;
  if (errorText.includes("error") || errorText.includes("Exception")) {
    context += `\n\nI just got this error output:\n${errorText}`;
  }

  context += `\n\nPlease act as a Socratic tutor. Do NOT give me the direct code answer. Instead, point out where the issue likely is, explain the concept I might be misunderstanding, and guide me to the solution with a hint. Keep it brief and formatting clean.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: context }] }] }),
      },
    );

    if (!res.ok) throw new Error("API Key invalid or rate limit reached.");
    const data = await res.json();
    const reply = data.candidates[0].content.parts[0].text;

    consoleOut.innerHTML += `\n\n<span class="text-purple-400 font-bold">--- ✨ Minerva Tutor ---</span>\n<span class="text-purple-300">${escapeHTML(reply)}</span>\n\n`;
    consoleOut.scrollTop = consoleOut.scrollHeight;
  } catch (error) {
    alert("Minerva Error: " + error.message);
  } finally {
    btn.innerHTML = `✨ Ask Minerva`;
  }
}

// ==========================================
// 7. UI BINDINGS & RESIZER LOGIC
// ==========================================
function bindUIEvents() {
  document
    .getElementById("languageSelect")
    .addEventListener("change", (e) => createWorkspace(e.target.value));
  document.getElementById("runBtn").addEventListener("click", executeCode);
  document.getElementById("exportZipBtn").addEventListener("click", exportZIP);
  document.getElementById("saveProjectBtn").addEventListener("click", () => {
    triggerAutoSave();
    alert("Workspace Saved Locally!");
  });
  document
    .getElementById("loadProjectBtn")
    .addEventListener("click", loadLocalWorkspace);
  document
    .getElementById("snapshotBtn")
    .addEventListener("click", shareSnapshot);
  document.getElementById("aiTutorBtn").addEventListener("click", askMinerva);

  document.getElementById("formatBtn").addEventListener("click", () => {
    editorInstance.getAction("editor.action.formatDocument").run();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Wipe all files and reset workspace?"))
      createWorkspace(currentLang);
  });

  document
    .getElementById("clearConsoleBtn")
    .addEventListener(
      "click",
      () => (document.getElementById("consoleOutput").textContent = ""),
    );

  document.getElementById("consoleTab").addEventListener("click", () => {
    document.getElementById("consoleOutput").classList.remove("hidden");
    document.getElementById("webPreviewContainer").classList.add("hidden");
    document
      .getElementById("consoleTab")
      .classList.add("text-cyan-400", "border-cyan-400");
    document
      .getElementById("consoleTab")
      .classList.remove("text-slate-500", "border-transparent");
    document
      .getElementById("previewTab")
      .classList.add("text-slate-500", "border-transparent");
    document
      .getElementById("previewTab")
      .classList.remove("text-cyan-400", "border-cyan-400");
  });

  document.getElementById("previewTab").addEventListener("click", () => {
    document.getElementById("consoleOutput").classList.add("hidden");
    document.getElementById("webPreviewContainer").classList.remove("hidden");
    document
      .getElementById("previewTab")
      .classList.add("text-cyan-400", "border-cyan-400");
    document
      .getElementById("previewTab")
      .classList.remove("text-slate-500", "border-transparent");
    document
      .getElementById("consoleTab")
      .classList.add("text-slate-500", "border-transparent");
    document
      .getElementById("consoleTab")
      .classList.remove("text-cyan-400", "border-cyan-400");
  });
}

function updateOutputView() {
  if (currentLang === "web") {
    document.getElementById("consoleTab").classList.remove("hidden");
    document.getElementById("previewTab").classList.remove("hidden");
    document.getElementById("previewTab").click();
    document.getElementById("stdinContainer").classList.add("hidden");
  } else {
    document.getElementById("consoleTab").classList.remove("hidden");
    document.getElementById("previewTab").classList.add("hidden");
    document.getElementById("consoleTab").click();
    document.getElementById("stdinContainer").classList.remove("hidden");
  }
}

function initResizer() {
  const resizer = document.getElementById("dragResizer");
  const leftPane = document.getElementById("editorPane");
  const rightPane = document.getElementById("outputPane");
  const container = document.getElementById("workspaceContainer");
  let isDragging = false;

  resizer.addEventListener("mousedown", () => {
    isDragging = true;
    document.body.style.cursor = "col-resize";
    if (currentLang === "web")
      document.getElementById("executionOverlay").classList.remove("hidden");
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const containerRect = container.getBoundingClientRect();
    let newLeftWidth =
      ((e.clientX - containerRect.left) / containerRect.width) * 100;

    if (newLeftWidth < 20) newLeftWidth = 20;
    if (newLeftWidth > 80) newLeftWidth = 80;

    leftPane.style.width = `${newLeftWidth}%`;
    rightPane.style.width = `calc(${100 - newLeftWidth}% - 8px)`;
    if (editorInstance) editorInstance.layout();
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = "default";
      if (currentLang === "web")
        document.getElementById("executionOverlay").classList.add("hidden");
    }
  });
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
}
