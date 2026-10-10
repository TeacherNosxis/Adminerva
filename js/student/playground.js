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
  java: { monaco: "java", judge0Id: 62, defaultFile: "Main.java" },
  python: { monaco: "python", judge0Id: 71, defaultFile: "main.py" },
  web: { monaco: "html", judge0Id: null, defaultFile: "index.html" },
  csharp: { monaco: "csharp", judge0Id: 51, defaultFile: "Program.cs" },
  cpp: { monaco: "cpp", judge0Id: 54, defaultFile: "main.cpp" },
  dart: { monaco: "dart", judge0Id: 64, defaultFile: "main.dart" },
};

let editorInstance = null;
let currentLang = "java";
let workspaceFiles = {};
let activeFilename = "";

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

    const urlParams = new URLSearchParams(window.location.search);
    const snapshotId = urlParams.get("id");

    if (snapshotId) await loadSnapshot(snapshotId);
    else loadLocalWorkspace();
  });
});

// ==========================================
// 3. WORKSPACE & FILE MANAGEMENT
// ==========================================
function createWorkspace(lang, initialFiles) {
  currentLang = lang;
  document.getElementById("languageSelect").value = lang;

  Object.values(workspaceFiles).forEach((f) => f.model.dispose());
  workspaceFiles = {};

  const filesToCreate = initialFiles || {
    [languageConfig[lang].defaultFile]: "// Write your code here...",
  };

  Object.entries(filesToCreate).forEach(([filename, content]) => {
    addFile(filename, content, false);
  });

  switchTab(Object.keys(workspaceFiles)[0]);
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

  model.onDidChangeContent(() => {
    triggerAutoSave();
    // Clear Visual Error Squiggles when user edits code
    monaco.editor.setModelMarkers(model, "judge0", []);
  });

  renderTabs();
  if (autoSwitch) switchTab(filename);
}

function switchTab(filename) {
  if (!workspaceFiles[filename]) return;
  activeFilename = filename;
  editorInstance.setModel(workspaceFiles[filename].model);
  renderTabs();
}

function renderTabs() {
  const container = document.getElementById("fileTabsContainer");
  container.innerHTML = "";

  Object.keys(workspaceFiles).forEach((filename) => {
    const isActive = filename === activeFilename;
    const tabClass = isActive
      ? "bg-[#0f172a] text-cyan-400 border-t-2 border-cyan-400"
      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border-t-2 border-transparent";

    container.insertAdjacentHTML(
      "beforeend",
      `
      <div class="px-4 py-2 cursor-pointer flex items-center gap-2 text-xs font-bold transition ${tabClass}" onclick="window.switchTab('${filename}')">
        <span>${escapeHTML(filename)}</span>
        ${Object.keys(workspaceFiles).length > 1 ? `<span class="hover:text-rose-400 ml-2" onclick="event.stopPropagation(); window.deleteFile('${filename}')">✕</span>` : ""}
      </div>
    `,
    );
  });

  container.insertAdjacentHTML(
    "beforeend",
    `
    <button onclick="window.promptNewFile()" class="text-slate-400 hover:text-white px-4 h-full flex items-center justify-center font-bold text-lg hover:bg-slate-800 transition shrink-0" title="Add new file">+</button>
  `,
  );
}

window.switchTab = switchTab;
window.deleteFile = function (filename) {
  if (confirm(`Delete ${filename}?`)) {
    workspaceFiles[filename].model.dispose();
    delete workspaceFiles[filename];
    if (activeFilename === filename) switchTab(Object.keys(workspaceFiles)[0]);
    else renderTabs();
    triggerAutoSave();
  }
};
window.promptNewFile = function () {
  const name = prompt("Enter file name (e.g., Student.java, style.css):");
  if (name && name.trim()) addFile(name.trim());
};

// ==========================================
// 4. STORAGE, ZIP, & SNAPSHOTS
// ==========================================
let autoSaveTimeout;
function triggerAutoSave() {
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    const state = { lang: currentLang, files: {} };
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
    createWorkspace(state.lang, state.files);
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
      createWorkspace(docSnap.data().lang, docSnap.data().files);
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

  // Clear squiggles on new run
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

// 🪄 VISUAL DIAGNOSTICS: Map Compiler Errors to Red Squiggles
function applyVisualDiagnostics(errorText, defaultFile) {
  const markers = [];
  const lines = errorText.split("\n");
  // Simple Regex to catch typical "filename:line_number:" Java/C++ errors
  const lineRegex = new RegExp(`${defaultFile.replace(".", "\\.")}:(\\d+):`);

  lines.forEach((line) => {
    const match = line.match(lineRegex);
    if (match) {
      const lineNum = parseInt(match[1], 10);
      markers.push({
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: 100, // Stretch squiggle across line
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

// 🕸️ WEB PREVIEW: Compile HTML/CSS/JS, Inject Timeout Guard & Console Hooks
function executeWebPreview() {
  let html = workspaceFiles["index.html"]?.model.getValue() || "";
  let css = "",
    js = "";

  for (const [name, file] of Object.entries(workspaceFiles)) {
    if (name.endsWith(".css")) css += `<style>${file.model.getValue()}</style>`;
    if (name.endsWith(".js")) {
      // TIMEOUT GUARD: Inject infinite loop protection (2000ms max)
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

  // CONSOLE HOOK: Pipe iframe console.logs back to our Terminal
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

// Receive messages from iframe console hook
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

  // Force open terminal to see the AI response
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

  // 🪄 Code Formatter Action
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
    document.getElementById("consoleTab").classList.remove("hidden"); // Kept visible so they can view intercepted console logs
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
