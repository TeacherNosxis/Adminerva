import { db } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

window.showLoader = function (msg = "Processing...") {
  if (typeof window.showSubtleLoader === "function")
    window.showSubtleLoader(msg);
};
window.hideLoader = function () {
  if (typeof window.hideSubtleLoader === "function") window.hideSubtleLoader();
};

document.addEventListener("DOMContentLoaded", () => {
  loadSections();
});

async function loadSections() {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, "students"));
    const select = document.getElementById("sectionSelect");
    select.innerHTML = "";

    let uniqueSections = new Set();
    snap.forEach((d) => {
      const sectionName = d.data().section;
      if (sectionName) uniqueSections.add(sectionName);
    });

    [...uniqueSections].sort().forEach((sec) => {
      select.insertAdjacentHTML(
        "beforeend",
        `<option value="${sec}">${sec}</option>`,
      );
    });

    if (uniqueSections.size > 0) {
      window.loadRepobankData();
    }
  } catch (e) {
    console.error("Failed to load sections", e);
  }
}

function getRepoId(repoUrl) {
  try {
    const parts = repoUrl.replace(/\/$/, "").replace(".git", "").split("/");
    return `${parts[parts.length - 2]}_${parts[parts.length - 1]}`;
  } catch (e) {
    return "unknown_repo";
  }
}

window.loadRepobankData = async function () {
  const section = document.getElementById("sectionSelect").value;
  const container = document.getElementById("repobankContainer");
  if (!section) return;

  window.showLoader("Accessing Long-Term Memory...");
  container.innerHTML = "";

  try {
    // 1. Fetch all students in the selected section
    const qStudents = query(
      collection(db, "students"),
      where("section", "==", section),
    );
    const stuSnap = await getDocs(qStudents);
    const students = [];
    stuSnap.forEach((d) => students.push({ id: d.id, ...d.data() }));

    if (students.length === 0) {
      container.innerHTML = `<div class="text-gray-500 italic font-medium col-span-full">No students found in this section.</div>`;
      return window.hideLoader();
    }

    // 2. Group students by their Repository ID
    const uniqueRepos = new Map();
    students.forEach((student) => {
      if (student.repoUrl) {
        const id = getRepoId(student.repoUrl);
        if (!uniqueRepos.has(id)) {
          uniqueRepos.set(id, { url: student.repoUrl, members: [] });
        }
        uniqueRepos.get(id).members.push(student);
      }
    });

    if (uniqueRepos.size === 0) {
      container.innerHTML = `<div class="text-gray-500 italic font-medium col-span-full">No repositories linked in this section.</div>`;
      return window.hideLoader();
    }

    // 3. Fetch and render the Repobank Document for each repository
    for (const [repoId, repoData] of uniqueRepos.entries()) {
      try {
        const snap = await getDoc(doc(db, "repobank", repoId));
        let concept = "Awaiting AI processing. Run AutoGrader to initialize.";
        let feedback = "No group feedback generated yet.";
        let lastUpdated = "Never";
        let repoName = repoData.url.split("/").pop().replace(".git", "");
        let membersData = {};

        if (snap.exists()) {
          const data = snap.data();
          concept = data.concept || concept;
          feedback = data.feedback || feedback;
          repoName = data.repoName || repoName;
          membersData = data.members || {};
          if (data.lastUpdated) {
            lastUpdated = new Date(data.lastUpdated).toLocaleDateString(
              undefined,
              {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              },
            );
          }
        }

        // Build individual member contribution blocks
        let membersHtml = `<div class="mt-4 space-y-3">`;
        repoData.members.forEach((student) => {
          const memAI = membersData[student.id] || {};
          const overall =
            memAI.overallContribution || "No overall role recorded.";
          const recent =
            memAI.recentContribution || "No recent activity logged.";

          membersHtml += `
                <div class="bg-gray-50 border border-gray-200 p-3 rounded-lg shadow-sm">
                   <h5 class="font-bold text-gray-800 text-sm mb-2">${student.name} <span class="text-[10px] font-normal text-gray-500 font-mono">(${student.githubUsername})</span></h5>
                   <div class="grid grid-cols-1 gap-2">
                      <div>
                         <span class="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 block mb-0.5">Overall Role</span>
                         <p class="text-xs text-gray-700 leading-relaxed">${overall}</p>
                      </div>
                      <div class="border-t border-gray-200 pt-2 mt-1">
                         <span class="text-[9px] font-extrabold uppercase tracking-wider text-purple-600 block mb-0.5">Recent Contribution</span>
                         <p class="text-xs text-gray-700 leading-relaxed">${recent}</p>
                      </div>
                   </div>
                </div>
             `;
        });
        membersHtml += `</div>`;

        // Construct the full project card
        const html = `
            <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col h-full">
              <div class="flex justify-between items-start mb-4 pb-3 border-b border-gray-100">
                <div>
                  <a href="${repoData.url}" target="_blank" class="font-extrabold text-gray-800 text-lg hover:text-blue-600 transition flex items-center gap-2">
                     📁 ${repoName}
                  </a>
                </div>
                <span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded border shadow-inner whitespace-nowrap">Upd: ${lastUpdated}</span>
              </div>
              
              <div class="mb-4">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-blue-500 block mb-1">Project Concept</span>
                <p class="text-sm text-gray-700 leading-relaxed">${concept}</p>
              </div>
              
              <div class="mb-5">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 block mb-1">Whole Group Feedback</span>
                <p class="text-sm text-gray-700 leading-relaxed">${feedback}</p>
              </div>

              <div class="border-t border-gray-200 pt-4 mt-auto">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-gray-600 block mb-2">Team Members & Contributions</span>
                ${membersHtml}
              </div>
            </div>
          `;
        container.insertAdjacentHTML("beforeend", html);
      } catch (e) {
        console.error(`Failed to load repobank for ${repoId}`, e);
      }
    }
  } catch (e) {
    console.error(e);
    alert("Error loading Repobank data.");
  } finally {
    window.hideLoader();
  }
};
