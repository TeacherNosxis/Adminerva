import { db } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Extracts owner and repo names regardless of trailing slashes or .git
function parseRepoInfo(repoUrl) {
  if (!repoUrl || repoUrl.trim() === "") return null;
  try {
    const cleanUrl = repoUrl
      .trim()
      .replace(/\/$/, "")
      .replace(/\.git$/, "");
    const parts = cleanUrl.split("/");
    const repo = parts.pop();
    const owner = parts.pop();
    return { owner, repo, cleanUrl };
  } catch (e) {
    return null;
  }
}

let globalStudentsData = {};

window.runRepoFetch = async function () {
  const ghToken = localStorage.getItem("Adminerva_github_token");
  if (!ghToken) return alert("Missing GitHub PAT in your global settings.");

  const container = document.getElementById("groupsContainer");
  container.innerHTML = "";
  globalStudentsData = {};

  // Utilizing the subtle loader from adminerva-loader.js
  window.showSubtleLoader("Fetching and grouping students...");

  try {
    const stuSnap = await getDocs(collection(db, "students"));
    const repoGroups = {};

    // 1. Map and Group Students by Repository
    stuSnap.forEach((d) => {
      const student = { id: d.id, ...d.data() };
      if (!student.repoUrl) return;

      const repoInfo = parseRepoInfo(student.repoUrl);
      if (!repoInfo) return;

      const groupId = `${repoInfo.owner}_${repoInfo.repo}`.toLowerCase();

      if (!repoGroups[groupId]) {
        repoGroups[groupId] = {
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          url: repoInfo.cleanUrl,
          members: [],
        };
      }
      student.commitCount = 0; // Initialize commit tracker
      repoGroups[groupId].members.push(student);
      globalStudentsData[student.id] = student;
    });

    const groupKeys = Object.keys(repoGroups);
    if (groupKeys.length === 0) {
      container.innerHTML = `<div class="text-center text-gray-500 py-8">No repositories found in the database.</div>`;
      return window.hideSubtleLoader();
    }

    // 2. Fetch Commits and Tally for each group
    for (let i = 0; i < groupKeys.length; i++) {
      const groupId = groupKeys[i];
      const group = repoGroups[groupId];

      window.showSubtleLoader(
        `Analyzing ${group.owner}/${group.repo} (${i + 1}/${groupKeys.length})...`,
      );

      try {
        const res = await fetch(
          `https://api.github.com/repos/${group.owner}/${group.repo}/commits?per_page=100`,
          {
            headers: { Authorization: `Bearer ${ghToken}` },
          },
        );

        if (res.ok) {
          const commits = await res.json();
          commits.forEach((c) => {
            const authorLogin = (c.author?.login || "").toLowerCase().trim();
            const authorEmail = (c.commit?.author?.email || "")
              .toLowerCase()
              .trim();
            const authorName = (c.commit?.author?.name || "")
              .toLowerCase()
              .trim();

            // Strict mapping: Check GitHub Username or Email first
            let matchedMember = group.members.find((m) => {
              const dbUser = (m.githubUsername || "").toLowerCase().trim();
              const dbEmail = (m.email || "").toLowerCase().trim();
              if (dbUser && authorLogin === dbUser) return true;
              if (dbEmail && authorEmail === dbEmail) return true;
              return false;
            });

            // Fuzzy mapping: Fallback to local git config name checks
            if (!matchedMember) {
              matchedMember = group.members.find((m) => {
                const dbName = (m.name || "").toLowerCase().trim();
                return (
                  dbName &&
                  authorName &&
                  (dbName === authorName ||
                    authorName.includes(dbName.split(" ")[0]))
                );
              });
            }

            if (matchedMember) matchedMember.commitCount++;
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch commits for ${group.repo}`, err);
      }
    }

    window.showSubtleLoader("Rendering dashboard...");
    renderGroupedUI(repoGroups);
  } catch (e) {
    alert("Execution Error: " + e.message);
  } finally {
    window.hideSubtleLoader();
  }
};

function renderGroupedUI(repoGroups) {
  const container = document.getElementById("groupsContainer");
  container.innerHTML = "";

  Object.values(repoGroups).forEach((group, index) => {
    const safeUrl = group.url;
    const groupName = `${group.owner} / ${group.repo}`;

    let membersHtml = "";
    group.members.forEach((student) => {
      const safeName = student.name || "Unknown Student";
      const safeUser = student.githubUsername || "";
      const commitCount = student.commitCount || 0;

      // GitHub Redirect URLs
      const profileUrl = safeUser ? `https://github.com/${safeUser}` : "#";
      const commitsUrl = safeUser
        ? `https://github.com/${group.owner}/${group.repo}/commits?author=${safeUser}`
        : `https://github.com/${group.owner}/${group.repo}/commits`;

      membersHtml += `
            <div class="flex flex-col md:flex-row md:items-center justify-between p-4 border-b last:border-0 hover:bg-gray-50 transition gap-4">
                <div>
                    <div class="font-bold text-gray-800">${safeName}</div>
                    <div class="text-xs text-gray-500">
                      ${safeUser ? `@${safeUser}` : "No GitHub Linked"} &bull; 
                      <span class="${commitCount > 0 ? "text-green-600 font-bold" : "text-red-500"}">${commitCount} Commits Found</span>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    <a href="${profileUrl}" target="_blank" class="${!safeUser ? "pointer-events-none opacity-50" : ""} bg-white text-gray-700 hover:bg-gray-100 border px-3 py-1.5 rounded text-xs font-bold transition shadow-sm">👤 Profile</a>
                    <a href="${commitsUrl}" target="_blank" class="bg-white text-gray-700 hover:bg-gray-100 border px-3 py-1.5 rounded text-xs font-bold transition shadow-sm">🕒 View All Commits</a>
                    <button onclick="openGradingModal('${student.id}', '${group.owner}', '${group.repo}')" class="bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border border-purple-200 px-3 py-1.5 rounded text-xs font-bold transition shadow-sm">⭐ Grade Work</button>
                </div>
            </div>
        `;
    });

    const accordionId = `group-content-${index}`;
    const cardHtml = `
        <div class="bg-white border rounded-lg shadow-sm mb-4 overflow-hidden">
            <div class="bg-slate-800 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-700 transition" onclick="toggleAccordion('${accordionId}')">
                <div>
                    <h3 class="font-bold text-white text-lg">${groupName}</h3>
                    <a href="${safeUrl}" target="_blank" class="text-xs text-cyan-400 hover:underline" onclick="event.stopPropagation()">${safeUrl}</a>
                </div>
                <div class="text-slate-300 transform transition-transform duration-200 font-bold" id="icon-${accordionId}">▼</div>
            </div>
            <div id="${accordionId}" class="hidden flex-col">
                ${membersHtml}
            </div>
        </div>
    `;
    container.insertAdjacentHTML("beforeend", cardHtml);
  });
}

// Global scope helpers for HTML inline execution
window.toggleAccordion = function (id) {
  const el = document.getElementById(id);
  const icon = document.getElementById(`icon-${id}`);
  if (el.classList.contains("hidden")) {
    el.classList.remove("hidden");
    el.classList.add("flex");
    icon.style.transform = "rotate(180deg)";
  } else {
    el.classList.add("hidden");
    el.classList.remove("flex");
    icon.style.transform = "rotate(0deg)";
  }
};

window.openGradingModal = function (studentId, owner, repo) {
  const student = globalStudentsData[studentId];
  if (!student) return;

  document.getElementById("modalStudentName").textContent = student.name;
  document.getElementById("modalStudentRepo").textContent = `${owner}/${repo}`;
  document.getElementById("gradingModal").classList.remove("hidden");
};

window.closeGradingModal = function () {
  document.getElementById("gradingModal").classList.add("hidden");
};
