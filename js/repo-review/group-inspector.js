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

function getRepoId(repoUrl) {
  try {
    const parts = repoUrl.replace(/\/$/, "").replace(".git", "").split("/");
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
          `<option value="${sec}">${sec}</option>`,
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
  window.showLoader(`Fetching students...`);

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
    for (const url of validRepoUrls) {
      processed++;
      window.showLoader(
        `Syncing Repositories`,
        `Analyzing Group ${processed} of ${validRepoUrls.length}`,
      );

      try {
        const repoId = getRepoId(url);
        const urlParts = url.replace(".git", "").split("/");
        const repo = urlParts.pop();
        const owner = urlParts.pop();

        // 1. Load the SHA-based Cache from Firebase
        const cacheRef = doc(db, "group_repo_cache", repoId);
        const cacheSnap = await getDoc(cacheRef);
        let commitsCache = cacheSnap.exists()
          ? cacheSnap.data().commitsCache || {}
          : {};
        let updatedCache = false;

        // 2. Fetch the CURRENT Top 100 List (Always fresh, ignores dates)
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
          continue;
        }

        const currentCommits = await res.json();

        // 3. Process the current history line by line
        for (let c of currentCommits) {
          const authorLogin = (c.author?.login || "").toLowerCase();
          const authorName = (c.commit?.author?.name || "").toLowerCase();

          const member = repoGroups[url].members.find(
            (m) =>
              (m.githubUsername || "").toLowerCase().trim() === authorLogin ||
              (m.name || "").toLowerCase().trim() === authorName,
          );

          if (member) {
            const stats = studentStatsMap[member.id];
            stats.count++;

            let commitDetail = commitsCache[c.sha];

            // If SHA is missing from cache, fetch deep details and cache it
            // Limit to top 15 deep fetches per student to avoid massive payload/rate limits
            if (!commitDetail && stats.count <= 15) {
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
                  // Limit patch string to prevent exceeding Firestore's 1MB document limit
                  patch: patchData.substring(0, 3500),
                };

                commitsCache[c.sha] = commitDetail;
                updatedCache = true;
              }
            } else if (!commitDetail) {
              // Fallback for commits beyond the deep fetch limit
              commitDetail = {
                message: c.commit.message,
                date: c.commit.author.date,
                additions: 0,
                deletions: 0,
                patch: "",
              };
            }

            // 4. Apply the confirmed data to the UI
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

        // 5. Save the updated cache back to Firebase if new SHAs were found
        if (updatedCache) {
          await setDoc(
            cacheRef,
            { repoUrl: url, commitsCache: commitsCache },
            { merge: true },
          );
        }
      } catch (err) {
        repoGroups[url].apiError = "Network Error";
      }
    }
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

    const groupName = url.split("/").pop().replace(".git", "");
    const errorBadge = groupData.apiError
      ? `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded border border-red-300">API Error: ${groupData.apiError}</span>`
      : "";

    let membersHtml = "";
    groupData.members.forEach((student) => {
      const stats = studentStatsMap[student.id];
      const hasCommits = stats.count > 0;

      membersHtml += `
        <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition px-2 rounded">
          <div>
            <div class="font-bold text-gray-800 text-sm flex items-center gap-2">
              ${student.name} 
              <span class="text-[10px] text-gray-400 font-normal">(@${student.githubUsername || "?"})</span>
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
            <a href="${url}" target="_blank" class="text-[10px] text-blue-500 hover:underline break-all">${url}</a>
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

  document.getElementById("detCommitList").innerHTML = stats.messages
    .map((m) => `<li>${m}</li>`)
    .join("");
  document.getElementById("detCodeBlock").textContent =
    stats.patches || "No detailed file changes available.";

  document.getElementById("detailsModal").classList.remove("hidden");
};

window.closeDetailsModal = function () {
  document.getElementById("detailsModal").classList.add("hidden");
};
