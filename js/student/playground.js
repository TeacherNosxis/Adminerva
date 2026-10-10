// js/student/playground.js

// 1. Language Configurations & Templates (Updated to Judge0 IDs)
const languageConfig = {
  java: {
    monaco: "java",
    judge0Id: 62, // Java (OpenJDK 13.0.1)
    filename: "Main.java",
  },
  python: {
    monaco: "python",
    judge0Id: 71, // Python (3.8.1)
    filename: "script.py",
  },
  web: {
    monaco: "html",
    judge0Id: null, // Executed in browser
    filename: "index.html",
  },
  csharp: {
    monaco: "csharp",
    judge0Id: 51, // C# (Mono 6.6.0.161)
    filename: "Program.cs",
  },
  cpp: {
    monaco: "cpp",
    judge0Id: 54, // C++ (GCC 9.2.0)
    filename: "main.cpp",
  },
  dart: {
    monaco: "dart",
    judge0Id: 64, // Dart (2.19.x)
    filename: "main.dart",
  },
};

const codeTemplates = {
  java: {
    default: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Adminerva!");\n    }\n}`,
    loop: `public class Main {\n    public static void main(String[] args) {\n        for(int i = 1; i <= 5; i++) {\n            System.out.println("Iteration: " + i);\n        }\n    }\n}`,
    oop: `class Student {\n    String name;\n    public Student(String name) { this.name = name; }\n    public void greet() { System.out.println("Hi, I am " + name); }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Student s = new Student("Joseph");\n        s.greet();\n    }\n}`,
  },
  python: {
    default: `print("Hello, Adminerva!")`,
    loop: `for i in range(1, 6):\n    print(f"Iteration: {i}")`,
    oop: `class Student:\n    def __init__(self, name):\n        self.name = name\n    def greet(self):\n        print(f"Hi, I am {self.name}")\n\n# Instantiate and call\ns = Student("Joseph")\ns.greet()`,
  },
  web: {
    default: `<!DOCTYPE html>\n<html>\n<head>\n<style>\n  body { \n    background-color: #0f172a; \n    color: #22d3ee; \n    font-family: sans-serif; \n    display: flex; \n    justify-content: center; \n    align-items: center; \n    height: 100vh; \n    margin: 0;\n  }\n</style>\n</head>\n<body>\n  <h1>Hello, Adminerva Web!</h1>\n</body>\n</html>`,
    loop: `<!-- WebDev loop output via JS -->\n<div id="output" style="color: #333; font-family: monospace; padding: 20px;"></div>\n<script>\n  let out = "";\n  for(let i=1; i<=5; i++) out += "Iteration: " + i + "<br>";\n  document.getElementById("output").innerHTML = out;\n</script>`,
    oop: `<!-- WebDev OOP visualization -->\n<button onclick="run()">Create Student Object</button>\n<p id="msg"></p>\n<script>\n  class Student {\n    constructor(name) { this.name = name; }\n    greet() { return "Hi, I am " + this.name; }\n  }\n  function run() {\n    const s = new Student("Joseph");\n    document.getElementById("msg").innerText = s.greet();\n  }\n</script>`,
  },
  csharp: {
    default: `using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, Adminerva!");\n    }\n}`,
    loop: `using System;\n\nclass Program {\n    static void Main() {\n        for(int i = 1; i <= 5; i++) {\n            Console.WriteLine("Iteration: " + i);\n        }\n    }\n}`,
    oop: `using System;\n\nclass Student {\n    public string Name;\n    public Student(string name) { Name = name; }\n    public void Greet() { Console.WriteLine("Hi, I am " + Name); }\n}\n\nclass Program {\n    static void Main() {\n        Student s = new Student("Joseph");\n        s.Greet();\n    }\n}`,
  },
  cpp: {
    default: `#include <iostream>\n\nint main() {\n    std::cout << "Hello, Adminerva!" << std::endl;\n    return 0;\n}`,
    loop: `#include <iostream>\n\nint main() {\n    for(int i = 1; i <= 5; i++) {\n        std::cout << "Iteration: " << i << std::endl;\n    }\n    return 0;\n}`,
    oop: `#include <iostream>\n#include <string>\n\nclass Student {\npublic:\n    std::string name;\n    Student(std::string n) : name(n) {}\n    void greet() {\n        std::cout << "Hi, I am " << name << std::endl;\n    }\n};\n\nint main() {\n    Student s("Joseph");\n    s.greet();\n    return 0;\n}`,
  },
  dart: {
    default: `void main() {\n  print('Hello, Adminerva!');\n}`,
    loop: `void main() {\n  for (int i = 1; i <= 5; i++) {\n    print('Iteration: $i');\n  }\n}`,
    oop: `class Student {\n  String name;\n  Student(this.name);\n  void greet() {\n    print('Hi, I am $name');\n  }\n}\n\nvoid main() {\n  var s = Student('Joseph');\n  s.greet();\n}`,
  },
};

// 2. Global State
let editorInstance = null;

// 3. Initialize Monaco Editor
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("pageBody").classList.remove("hidden");

  require.config({
    paths: {
      vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs",
    },
  });

  require(["vs/editor/editor.main"], function () {
    // Define Adminerva Dark Theme
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
        "editorLineNumber.activeForeground": "#38bdf8",
        "editorIndentGuide.background": "#1e293b",
      },
    });

    // Remove loading overlay
    document.getElementById("editorLoading").classList.add("hidden");

    // Create Instance
    editorInstance = monaco.editor.create(
      document.getElementById("editorContainer"),
      {
        value: codeTemplates.java.default,
        language: "java",
        theme: "adminervaDark",
        automaticLayout: true,
        fontSize: 14,
        fontFamily: "Fira Code, monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 16 },
      },
    );

    bindEvents();
  });
});

// 4. Bind UI Events
function bindEvents() {
  const langSelect = document.getElementById("languageSelect");
  const tempSelect = document.getElementById("templateSelect");
  const runBtn = document.getElementById("runBtn");
  const resetBtn = document.getElementById("resetBtn");
  const clearConsoleBtn = document.getElementById("clearConsoleBtn");

  langSelect.addEventListener("change", (e) =>
    handleLanguageChange(e.target.value),
  );
  tempSelect.addEventListener("change", (e) =>
    handleTemplateChange(e.target.value),
  );
  resetBtn.addEventListener("click", () =>
    handleTemplateChange(tempSelect.value),
  );
  clearConsoleBtn.addEventListener("click", () => {
    document.getElementById("consoleOutput").textContent = "Console cleared.";
  });
  runBtn.addEventListener("click", executeCode);
}

// 5. Handlers
function handleLanguageChange(langKey) {
  const config = languageConfig[langKey];
  const defaultCode = codeTemplates[langKey].default;

  // Update Monaco Language Model
  monaco.editor.setModelLanguage(editorInstance.getModel(), config.monaco);
  editorInstance.setValue(defaultCode);
  document.getElementById("templateSelect").value = "default";

  // Update UI Labels
  document.getElementById("editorTabLabel").textContent = config.filename;

  // Toggle Viewpanes (Web Preview vs Terminal)
  const consoleOutput = document.getElementById("consoleOutput");
  const webPreview = document.getElementById("webPreviewContainer");
  const consoleTab = document.getElementById("consoleTab");
  const previewTab = document.getElementById("previewTab");

  if (langKey === "web") {
    consoleOutput.classList.add("hidden");
    webPreview.classList.remove("hidden");
    consoleTab.classList.add("hidden");
    previewTab.classList.remove("hidden");

    // Clear previous render
    document.getElementById("webPreviewFrame").srcdoc = "";
  } else {
    consoleOutput.classList.remove("hidden");
    webPreview.classList.add("hidden");
    consoleTab.classList.remove("hidden");
    previewTab.classList.add("hidden");
    consoleOutput.textContent = "System ready. Waiting for execution...";
  }
}

function handleTemplateChange(tempKey) {
  const langKey = document.getElementById("languageSelect").value;
  const code = codeTemplates[langKey][tempKey];
  editorInstance.setValue(code);
}

// 6. Execution Engine (Powered by Judge0)
async function executeCode() {
  const langKey = document.getElementById("languageSelect").value;
  const code = editorInstance.getValue();
  const runBtn = document.getElementById("runBtn");

  // Prevent multiple clicks
  runBtn.disabled = true;
  runBtn.classList.add("opacity-50", "cursor-not-allowed");

  if (langKey === "web") {
    // Client-side HTML/CSS/JS execution
    const iframe = document.getElementById("webPreviewFrame");
    iframe.srcdoc = code;

    runBtn.disabled = false;
    runBtn.classList.remove("opacity-50", "cursor-not-allowed");
    return;
  }

  // Backend language execution via Judge0 API
  const config = languageConfig[langKey];
  const consoleOutput = document.getElementById("consoleOutput");
  const overlay = document.getElementById("executionOverlay");

  overlay.classList.remove("hidden");
  consoleOutput.textContent = "";

  try {
    const response = await fetch(
      "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_code: code,
          language_id: config.judge0Id,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `HTTP Error: ${response.status} - The compiler server might be busy.`,
      );
    }

    const result = await response.json();

    if (result.error) {
      // Internal API structural error
      consoleOutput.textContent = `API Error: ${result.error}`;
      consoleOutput.classList.add("text-rose-400");
    } else {
      consoleOutput.classList.remove("text-rose-400");

      // Check for compilation errors or runtime standard errors
      if (result.stderr || result.compile_output) {
        const errorMsg = result.stderr || result.compile_output;
        consoleOutput.innerHTML = `<span class="text-rose-400">${escapeHTML(errorMsg)}</span>\n${escapeHTML(result.stdout || "")}`;
      } else {
        // Successful execution output
        consoleOutput.textContent =
          result.stdout || "Program exited with no output.";
      }
    }
  } catch (error) {
    consoleOutput.textContent = `Execution Error: Failed to reach the Judge0 compiler server.\n${error.message}`;
    consoleOutput.classList.add("text-rose-400");
  } finally {
    overlay.classList.add("hidden");
    runBtn.disabled = false;
    runBtn.classList.remove("opacity-50", "cursor-not-allowed");
  }
}

// Utility to escape HTML in console output
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
