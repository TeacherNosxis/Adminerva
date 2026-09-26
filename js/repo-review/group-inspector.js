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

let repoGroups = {};
let studentStatsMap = {};

window.showLoader = function (msg, subMsg = "") {
  document.getElementById("loaderMessage").textContent = msg;
  document.getElementById("loaderSubMessage").textContent = subMsg;
  document.getElementById("globalLoader").classList.remove("hidden");
};
window.hideLoader = function () {
  document.getElementById("globalLoader").classList.add("hidden");
};

// 🔒 Security Patch: Helper to neutralize malicious HTML scripts from user input
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 🔒 Security Patch: Native URL parsing to sanitize URL substrings
function getRepoId(repoUrl) {
  try {
    const parsedUrl = new URL(repoUrl);
    const parts = parsedUrl.pathname
      .replace(/\/$/, "")
      .replace(".git", "")
      .split("/");
    return `${parts[parts.length - 2]}_${parts[parts.length - 1]}`;
  } catch (e) {
    return "unknown_repo";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!db) return;
  loadSections();
});

async function loadSections() {
  try {
    const snap = await getDocs(collection(db, "students"));
    const select = document.getElementById("sectionSelect");
    select.innerHTML = "";
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
}

window.fetchGroupRepos = async function () {
  const ghToken = localStorage.getItem("Adminerva_github_token");
  if (!ghToken) return alert("Missing GitHub PAT. Configure it in settings.");

  const section = document.getElementById("sectionSelect").value;
  window.showLoader(`Initializing Fetch...`, `Gathering student data`);

  try {
    const qStudents = query(
      collection(db, "students"),
      where("section", "==", section),
    );
    const stuSnap = await getDocs(qStudents);

    repoGroups = {};
    studentStatsMap = {};

    stuSnap.forEach((d) => {
      const student = { id: d.id, ...d.data() };
      const url = student.repoUrl
        ? student.repoUrl.trim().replace(/\/$/, "")
        : "unassigned";

      if (!repoGroups[url]) repoGroups[url] = { members: [], apiError: null };
      repoGroups[url].members.push(student);

      // Baseline clean slate for every student
      studentStatsMap[student.id] = {
        name: student.name,
        repoUrl: url,
        githubUsername: (student.githubUsername || "").toLowerCase().trim(),
        count: 0,
        additions: 0,
        deletions: 0,
        messages: [],
        patches: "",
      };
    });

    const validRepoUrls = Object.keys(repoGroups).filter(
      (url) => url !== "unassigned" && url.includes("github.com"),
    );
    let processed = 0;

    // PARALLEL EXECUTION: Fire all repo fetches at the same time
    const fetchPromises = validRepoUrls.map(async (url) => {
      try {
        const repoId = getRepoId(url);

        // 🔒 Security Patch: Native URL parser logic
        const parsedUrl = new URL(url);
        const urlParts = parsedUrl.pathname
          .replace(/\/$/, "")
          .replace(".git", "")
          .split("/");
        const repo = urlParts.pop();
        const owner = urlParts.pop();

        // 1. Check Firebase Cache
        const cacheRef = doc(db, "group_repo_cache", repoId);
        const cacheSnap = await getDoc(cacheRef);
        const cachedData = cacheSnap.exists() ? cacheSnap.data() : {};
        let commitsCache = cachedData.commitsCache || {};

        // 2. Fetch the CURRENT Top 100 List
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`,
          {
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: "application/vnd.github+json",
            },
          },
        );

        if (!res.ok) {
          repoGroups[url].apiError =
            res.status === 409 ? "Empty Repository" : `HTTP ${res.status}`;
          processed++;
          window.showLoader(
            `Syncing Repositories`,
            `Completed ${processed} of ${validRepoUrls.length}`,
          );
          return;
        }

        const currentCommits = await res.json();
        if (currentCommits.length === 0) return;

        // ==========================================
        // 🚀 THE FAST-PATH: INSTANT CACHE HIT
        // ==========================================
        if (
          cachedData.latestSha === currentCommits[0].sha &&
          cachedData.studentStats
        ) {
          repoGroups[url].members.forEach((m) => {
            if (cachedData.studentStats[m.id]) {
              studentStatsMap[m.id] = cachedData.studentStats[m.id];
            }
          });
          processed++;
          window.showLoader(
            `Syncing Repositories`,
            `Completed ${processed} of ${validRepoUrls.length}`,
          );
          return; // EXIT EARLY
        }

        // ==========================================
        // 🐢 THE SLOW-PATH: CACHE MISS / REBUILD
        // ==========================================
        let updatedCache = false;
        let tempStats = {};
        repoGroups[url].members.forEach((m) => {
          tempStats[m.id] = { ...studentStatsMap[m.id] };
        });

        for (let c of currentCommits) {
          const authorLogin = (c.author?.login || "").toLowerCase();
          const authorName = (c.commit?.author?.name || "").toLowerCase();

          const member = repoGroups[url].members.find(
            (m) =>
              (m.githubUsername || "").toLowerCase().trim() === authorLogin ||
              (m.name || "").toLowerCase().trim() === authorName,
          );

          if (member) {
            const stats = tempStats[member.id];
            stats.count++;

            let commitDetail = commitsCache[c.sha];

            if (!commitDetail && stats.count <= 10) {
              const detailRes = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/commits/${c.sha}`,
                {
                  headers: { Authorization: `Bearer ${ghToken}` },
                },
              );

              if (detailRes.ok) {
                const detail = await detailRes.json();
                let patchData = "";
                if (detail.files) {
                  detail.files.forEach((file) => {
                    if (file.patch)
                      patchData += `--- ${file.filename} ---\n${file.patch}\n`;
                  });
                }

                commitDetail = {
                  message: c.commit.message,
                  date: c.commit.author.date,
                  additions: detail.stats?.additions || 0,
                  deletions: detail.stats?.deletions || 0,
                  patch: patchData.substring(0, 3500),
                };

                commitsCache[c.sha] = commitDetail;
                updatedCache = true;
              }
            } else if (!commitDetail) {
              commitDetail = {
                message: c.commit.message,
                date: c.commit.author.date,
                additions: 0,
                deletions: 0,
                patch: "",
              };
            }

            if (commitDetail) {
              const dateStr = new Date(commitDetail.date).toLocaleDateString();
              stats.messages.push(`${dateStr} - ${commitDetail.message}`);
              stats.additions += commitDetail.additions;
              stats.deletions += commitDetail.deletions;
              if (commitDetail.patch) {
                stats.patches += `\n\n### COMMIT: "${commitDetail.message}"\n${commitDetail.patch}`;
              }
            }
          }
        }

        repoGroups[url].members.forEach((m) => {
          studentStatsMap[m.id] = tempStats[m.id];
        });

        await setDoc(
          cacheRef,
          {
            repoUrl: url,
            latestSha: currentCommits[0].sha,
            commitsCache: commitsCache,
            studentStats: tempStats,
          },
          { merge: true },
        );

        processed++;
        window.showLoader(
          `Syncing Repositories`,
          `Completed ${processed} of ${validRepoUrls.length}`,
        );
      } catch (err) {
        repoGroups[url].apiError = "Network Error";
        processed++;
        window.showLoader(
          `Syncing Repositories`,
          `Completed ${processed} of ${validRepoUrls.length}`,
        );
      }
    });

    await Promise.all(fetchPromises);
    renderGroupsUI();
  } catch (e) {
    alert(e.message);
  } finally {
    window.hideLoader();
  }
};

function renderGroupsUI() {
  const container = document.getElementById("groupsContainer");
  container.innerHTML = "";

  Object.entries(repoGroups).forEach(([url, groupData]) => {
    if (url === "unassigned") return;

    // 🔒 Security Patch: Wrap groupName and URLs with escapeHTML
    let groupName = "Unknown Repo";
    try {
      const parsedUrl = new URL(url);
      groupName = parsedUrl.pathname.split("/").pop().replace(".git", "");
    } catch (e) {}

    groupName = escapeHTML(groupName);
    const safeUrl = escapeHTML(url);

    const errorBadge = groupData.apiError
      ? `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded border border-red-300">API Error: ${escapeHTML(groupData.apiError)}</span>`
      : "";

    let membersHtml = "";
    groupData.members.forEach((student) => {
      const stats = studentStatsMap[student.id];
      const hasCommits = stats.count > 0;

      // 🔒 Security Patch: Sanitize student credentials
      const safeName = escapeHTML(student.name);
      const safeGithub = escapeHTML(student.githubUsername || "?");

      membersHtml += `
        <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition px-2 rounded">
          <div>
            <div class="font-bold text-gray-800 text-sm flex items-center gap-2">
              ${safeName} 
              <span class="text-[10px] text-gray-400 font-normal">(@${safeGithub})</span>
            </div>
            <div class="text-[10px] font-mono mt-1 ${hasCommits ? "text-gray-600" : "text-red-500 font-bold"}">
               Total Commits: ${stats.count}
            </div>
          </div>
          <button onclick="openStudentDetails('${student.id}')" class="${hasCommits ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-600 hover:text-white" : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"} border px-4 py-1.5 rounded text-xs font-bold transition shadow-sm" ${hasCommits ? "" : "disabled"}>
            🔍 Inspect
          </button>
        </div>
      `;
    });

    const card = `
      <div class="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
        <div class="bg-gray-50 border-b border-gray-200 p-4 rounded-t-lg flex justify-between items-center">
          <div>
            <h3 class="font-bold text-gray-800 truncate w-64" title="${groupName}">${groupName}</h3>
            <a href="${safeUrl}" target="_blank" class="text-[10px] text-blue-500 hover:underline break-all">${safeUrl}</a>
          </div>
          ${errorBadge}
        </div>
        <div class="p-2 flex-1">
          ${membersHtml}
        </div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", card);
  });

  if (container.innerHTML === "") {
    container.innerHTML = `<div class="col-span-full py-8 text-center text-gray-500 font-bold">No valid repositories found for this section.</div>`;
  }
}

window.openStudentDetails = function (studentId) {
  const stats = studentStatsMap[studentId];
  if (!stats || stats.count === 0) return;

  document.getElementById("detailsTitle").textContent =
    `Inspection: ${stats.name}`;
  document.getElementById("detailsRepoLink").textContent = stats.repoUrl;

  document.getElementById("detCommits").textContent = stats.count;
  document.getElementById("detAdded").textContent = "+" + stats.additions;
  document.getElementById("detDeleted").textContent = "-" + stats.deletions;

  // 🔒 Security Patch: Create DOM nodes strictly as text content instead of innerHTML string mapping
  const commitList = document.getElementById("detCommitList");
  commitList.innerHTML = "";
  stats.messages.forEach((msg) => {
    const li = document.createElement("li");
    li.textContent = msg; // textContent forces the browser to ignore executable HTML tags
    commitList.appendChild(li);
  });

  document.getElementById("detCodeBlock").textContent =
    stats.patches || "No detailed file changes available.";

  document.getElementById("detailsModal").classList.remove("hidden");
};

window.closeDetailsModal = function () {
  document.getElementById("detailsModal").classList.add("hidden");
};
