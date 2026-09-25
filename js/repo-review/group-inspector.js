import { db } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let repoGroups = {}; // Maps repoUrl -> { members: [], commits: [] }
let studentStatsMap = {}; // Maps studentId -> { count, additions, deletions, patches, messages }

window.showLoader = function (msg, subMsg = "") {
  document.getElementById("loaderMessage").textContent = msg;
  document.getElementById("loaderSubMessage").textContent = subMsg;
  document.getElementById("globalLoader").classList.remove("hidden");
};
window.hideLoader = function () {
  document.getElementById("globalLoader").classList.add("hidden");
};

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
    // 1. Fetch Students and Group them by their Repository URL
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

      if (!repoGroups[url])
        repoGroups[url] = { members: [], apiError: null, rawCommits: [] };
      repoGroups[url].members.push(student);

      // Initialize empty stats for the student
      studentStatsMap[student.id] = {
        name: student.name,
        repoUrl: url,
        count: 0,
        additions: 0,
        deletions: 0,
        messages: [],
        patches: "",
      };
    });

    // Remove unassigned if nobody is missing a repo URL
    const validRepoUrls = Object.keys(repoGroups).filter(
      (url) => url !== "unassigned" && url.includes("github.com"),
    );

    // 2. Fetch GitHub Data per Repository (NOT per student)
    let processed = 0;
    for (const url of validRepoUrls) {
      processed++;
      window.showLoader(
        `Fetching Repositories`,
        `Analyzing Group ${processed} of ${validRepoUrls.length}`,
      );

      try {
        const urlParts = url.replace(".git", "").split("/");
        const repo = urlParts.pop();
        const owner = urlParts.pop();

        // Fetch up to 100 recent commits for the entire group repo
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
          repoGroups[url].apiError = `HTTP ${res.status}`;
          continue;
        }

        const commits = await res.json();

        // 3. Distribute Commits to the matching Group Members
        for (let c of commits) {
          const authorLogin = (c.author?.login || "").toLowerCase();
          const authorName = (c.commit?.author?.name || "").toLowerCase();

          // Find which student in this group made the commit
          const member = repoGroups[url].members.find(
            (m) =>
              (m.githubUsername || "").toLowerCase().trim() === authorLogin ||
              (m.name || "").toLowerCase().trim() === authorName,
          );

          if (member) {
            const stats = studentStatsMap[member.id];
            stats.count++;

            // Only fetch deeper file details (diffs/lines) for a max of 10 commits per student to save API limits
            if (stats.count <= 10) {
              const detailRes = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/commits/${c.sha}`,
                {
                  headers: { Authorization: `Bearer ${ghToken}` },
                },
              );
              if (detailRes.ok) {
                const detail = await detailRes.json();
                if (detail.stats) {
                  stats.additions += detail.stats.additions;
                  stats.deletions += detail.stats.deletions;
                }
                stats.messages.push(
                  `${new Date(c.commit.author.date).toLocaleDateString()} - ${c.commit.message}`,
                );

                stats.patches += `\n\n### COMMIT: "${c.commit.message}"\n`;
                if (detail.files)
                  detail.files.forEach((file) => {
                    if (file.patch)
                      stats.patches += `--- ${file.filename} ---\n${file.patch}\n`;
                  });
              }
            } else {
              // If they have more than 10 commits, just record the message
              stats.messages.push(
                `${new Date(c.commit.author.date).toLocaleDateString()} - ${c.commit.message}`,
              );
            }
          }
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
    container.innerHTML = `<div class="col-span-full py-8 text-center text-gray-500 font-bold">No valid repositories found for this section. Ensure students have a repoUrl in the database.</div>`;
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
