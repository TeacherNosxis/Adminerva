import { db } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const CACHE_VERSION = 7;
let globalStudentsData = {};

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(
    /[&<>"']/g,
    (match) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[match],
  );
}

function parseRepoInfo(repoUrl) {
  if (!repoUrl || repoUrl.trim() === "" || repoUrl === "unassigned")
    return null;
  try {
    const cleanUrl = repoUrl
      .trim()
      .replace(/\/$/, "")
      .replace(/\.git$/, "");
    const parts = cleanUrl.split("/");
    const repo = parts.pop();
    const owner = parts.pop();
    return { owner, repo, cleanUrl, groupId: `${owner}_${repo}`.toLowerCase() };
  } catch (e) {
    return null;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, "students"));
    const select = document.getElementById("sectionSelect");
    let uniqueSections = new Set();
    snap.forEach((d) => {
      if (d.data().section) uniqueSections.add(d.data().section);
    });
    [...uniqueSections]
      .sort()
      .forEach((sec) =>
        select.insertAdjacentHTML(
          "beforeend",
          `<option value="${escapeHTML(sec)}">${escapeHTML(sec)}</option>`,
        ),
      );
  } catch (e) {
    console.error(e);
  }
});

// Single Unified Action
window.fetchAndSyncRepos = async function () {
  const ghToken = localStorage.getItem("Adminerva_github_token");
  if (!ghToken) return alert("Missing GitHub PAT in settings.");

  const section = document.getElementById("sectionSelect").value;
  if (!section) return;

  window.showSubtleLoader(`Loading ${section} from database...`);
  globalStudentsData = {};

  try {
    // ==========================================
    // PHASE 1: LOAD FAST FROM FIREBASE CACHE
    // ==========================================
    const qStudents = query(
      collection(db, "students"),
      where("section", "==", section),
    );
    const stuSnap = await getDocs(qStudents);
    const repoGroups = {};

    stuSnap.forEach((d) => {
      const student = { id: d.id, ...d.data(), commitCount: 0 };
      const repoInfo = parseRepoInfo(student.repoUrl);
      if (!repoInfo) return;

      if (!repoGroups[repoInfo.groupId]) {
        repoGroups[repoInfo.groupId] = { ...repoInfo, members: [] };
      }
      repoGroups[repoInfo.groupId].members.push(student);
      globalStudentsData[student.id] = student;
    });

    const groupKeys = Object.keys(repoGroups);

    // Fetch existing cache for instant rendering
    const cachePromises = groupKeys.map(async (groupId) => {
      const cacheRef = doc(db, "group_repo_cache", groupId);
      const cacheSnap = await getDoc(cacheRef);
      if (cacheSnap.exists()) {
        const cachedData = cacheSnap.data();
        const stats = cachedData.studentStats || {};
        repoGroups[groupId].members.forEach((member) => {
          if (stats[member.id])
            member.commitCount = stats[member.id].count || 0;
        });
        repoGroups[groupId].latestSha = cachedData.latestSha; // Store to verify later
      }
    });

    await Promise.all(cachePromises);

    // RENDER UI IMMEDIATELY
    renderGroupedUI(repoGroups);

    // ==========================================
    // PHASE 2: SILENT GITHUB SYNC & DB UPDATE
    // ==========================================
    let requiresUIRefresh = false;

    for (let i = 0; i < groupKeys.length; i++) {
      const groupId = groupKeys[i];
      const group = repoGroups[groupId];
      window.showSubtleLoader(
        `Checking GitHub for new commits ${i + 1}/${groupKeys.length}: ${group.repo}...`,
      );

      try {
        const res = await fetch(
          `https://api.github.com/repos/${group.owner}/${group.repo}/commits?per_page=100`,
          {
            headers: { Authorization: `Bearer ${ghToken}` },
          },
        );

        if (!res.ok) continue;
        const commits = await res.json();
        if (commits.length === 0) continue;

        // Optimization: If the latest SHA matches the cache, skip counting entirely!
        if (group.latestSha === commits[0].sha) {
          continue;
        }

        requiresUIRefresh = true;
        let updatedStats = {};

        // Setup stats for recounting
        group.members.forEach((m) => {
          updatedStats[m.id] = {
            count: 0,
            additions: 0,
            deletions: 0,
            messages: [],
          };
        });

        // Tally commits
        commits.forEach((c) => {
          const authorLogin = (c.author?.login || "").toLowerCase().trim();
          const authorEmail = (c.commit?.author?.email || "")
            .toLowerCase()
            .trim();
          const authorName = (c.commit?.author?.name || "")
            .toLowerCase()
            .trim();

          let matchedMember = group.members.find((m) => {
            const dbUser = (m.githubUsername || "").toLowerCase().trim();
            const dbEmail = (m.email || "").toLowerCase().trim();
            if (dbUser && authorLogin === dbUser) return true;
            if (dbEmail && authorEmail === dbEmail) return true;
            return false;
          });

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

          if (matchedMember) {
            updatedStats[matchedMember.id].count++;
            matchedMember.commitCount = updatedStats[matchedMember.id].count; // Update local memory
          }
        });

        // Save new counts to the shared cache
        const cacheRef = doc(db, "group_repo_cache", groupId);
        await setDoc(
          cacheRef,
          {
            repoUrl: group.url,
            latestSha: commits[0].sha,
            studentStats: updatedStats,
            cacheVersion: CACHE_VERSION,
          },
          { merge: true },
        );
      } catch (err) {
        console.warn(`Failed to sync ${group.repo}`, err);
      }
    }

    // Only re-render if we found new commits that changed the numbers
    if (requiresUIRefresh) {
      window.showSubtleLoader("Applying fresh updates to view...");
      renderGroupedUI(repoGroups);
    }
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
    let membersHtml = "";

    group.members.forEach((student) => {
      const safeName = escapeHTML(student.name || "Unknown");
      const safeUser = escapeHTML(student.githubUsername || "");
      const commitCount = student.commitCount || 0;

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
                    <a href="${commitsUrl}" target="_blank" class="bg-white text-gray-700 hover:bg-gray-100 border px-3 py-1.5 rounded text-xs font-bold transition shadow-sm">🕒 View Commits</a>
                    <button onclick="openGradingModal('${student.id}', '${group.owner}', '${group.repo}')" class="${commitCount > 0 ? "bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border-purple-200" : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"} border px-3 py-1.5 rounded text-xs font-bold transition shadow-sm" ${commitCount > 0 ? "" : "disabled"}>⭐ Grade Work</button>
                </div>
            </div>
        `;
    });

    const accordionId = `group-content-${index}`;
    const cardHtml = `
        <div class="bg-white border rounded-lg shadow-sm mb-4 overflow-hidden">
            <div class="bg-slate-800 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-700 transition" onclick="toggleAccordion('${accordionId}')">
                <div>
                    <h3 class="font-bold text-white text-lg">${escapeHTML(group.owner)} / ${escapeHTML(group.repo)}</h3>
                    <a href="${group.url}" target="_blank" class="text-xs text-cyan-400 hover:underline" onclick="event.stopPropagation()">${group.url}</a>
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

  if (container.innerHTML === "") {
    container.innerHTML = `<div class="py-8 text-center text-gray-500 font-bold">No repositories found for this section.</div>`;
  }
}

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
