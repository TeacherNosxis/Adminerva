import { db, auth } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

let userProfiles = [];
let currentChart = null;
let currentStudentProfile = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");

  document.getElementById("pageBody").classList.remove("hidden");
  const emailDisplay = document.getElementById("userEmailDisplay");
  if (emailDisplay) emailDisplay.textContent = user.email;

  // Listen for Time Filter Changes
  const timeFilterDropdown = document.getElementById("timeFilter");
  if (timeFilterDropdown) {
    timeFilterDropdown.addEventListener("change", (e) => {
      if (currentStudentProfile) {
        fetchGitHubData(
          currentStudentProfile.repoUrl,
          currentStudentProfile.githubUsername,
          e.target.value,
        );
      }
    });
  }

  try {
    const q = query(
      collection(db, "students"),
      where("email", "==", user.email.toLowerCase()),
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      document.getElementById("repoSubtitle").innerHTML =
        "<span class='text-red-500'>Profile incomplete. Please contact your instructor.</span>";
      document.getElementById("commitListContainer").innerHTML =
        "<p class='text-sm text-red-500 font-bold'>No directory record found.</p>";
      return;
    }

    userProfiles = [];
    snap.forEach((d) => userProfiles.push(d.data()));

    const selector = document.getElementById("sectionSelector");
    if (selector) {
      if (userProfiles.length > 1) {
        selector.classList.remove("hidden");
        selector.innerHTML = "";
        userProfiles.forEach((profile, index) => {
          selector.insertAdjacentHTML(
            "beforeend",
            `<option value="${index}">${profile.section}</option>`,
          );
        });

        selector.addEventListener("change", (e) => {
          loadDashboardProfile(userProfiles[e.target.value]);
        });
      } else {
        selector.classList.add("hidden");
      }
    }

    loadDashboardProfile(userProfiles[0]);
  } catch (error) {
    console.error("Dashboard Load Error:", error);
  }
});

async function loadDashboardProfile(studentData) {
  currentStudentProfile = studentData;
  const subtitle = document.getElementById("repoSubtitle");
  const container = document.getElementById("commitListContainer");

  verifyStudentSetup(studentData);

  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }

  if (!studentData.repoUrl || !studentData.githubUsername) {
    subtitle.innerHTML = `<strong class="text-amber-700">${studentData.section}:</strong> <span class='text-amber-600'>Please set your Repository URL and Username in Settings.</span>`;
    container.innerHTML =
      "<p class='text-sm text-amber-600 font-bold'>Awaiting GitHub configuration...</p>";
    renderChart([], "7d");
    return;
  }

  subtitle.innerHTML = `<strong>${studentData.section}:</strong> Tracking <span class="font-mono text-xs text-slate-800">${studentData.githubUsername}</span> on <a href="${studentData.repoUrl}" target="_blank" class="text-blue-500 hover:underline font-mono text-xs">${studentData.repoUrl}</a>`;

  container.innerHTML = `
        <div class="animate-pulse flex space-x-4">
            <div class="flex-1 space-y-4 py-1">
                <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                <div class="space-y-2">
                    <div class="h-4 bg-slate-200 rounded"></div>
                    <div class="h-4 bg-slate-200 rounded w-5/6"></div>
                </div>
            </div>
        </div>`;

  const defaultFilter = document.getElementById("timeFilter")?.value || "7d";
  await fetchGitHubData(
    studentData.repoUrl,
    studentData.githubUsername,
    defaultFilter,
  );
}

async function fetchGitHubData(repoUrl, username, filter = "7d") {
  const container = document.getElementById("commitListContainer");

  // Calculate Target Date
  const now = new Date();
  let sinceDate = new Date();
  if (filter === "24h") sinceDate.setHours(now.getHours() - 24);
  else if (filter === "7d") sinceDate.setDate(now.getDate() - 7);
  else if (filter === "30d") sinceDate.setMonth(now.getMonth() - 1);
  else if (filter === "90d") sinceDate.setMonth(now.getMonth() - 3);

  const sinceIso = sinceDate.toISOString();

  try {
    let owner, repo;
    const urlParts = repoUrl.replace(/\/$/, "").replace(".git", "").split("/");
    repo = urlParts.pop();
    owner = urlParts.pop();

    let allCommits = [];
    let page = 1;
    let keepFetching = true;
    const maxPages = filter === "90d" || filter === "30d" ? 4 : 1; // Fetch up to 400 commits for deep history

    // Automated Pagination Loop to prevent "Flat Line" data clipping
    while (keepFetching && page <= maxPages) {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?author=${encodeURIComponent(username)}&since=${sinceIso}&per_page=100&page=${page}`,
      );

      if (!response.ok) {
        if (response.status === 404 && page === 1)
          throw new Error("Repository is Private or Not Found.");
        break;
      }

      const commits = await response.json();
      allCommits = allCommits.concat(commits);

      if (commits.length < 100) keepFetching = false;
      page++;
    }

    if (allCommits.length === 0) {
      container.innerHTML =
        "<p class='text-sm text-slate-500 font-bold'>No commits found in this timeframe.</p>";
      renderChart([], filter);
      return;
    }

    container.innerHTML = "";
    allCommits.slice(0, 7).forEach((c) => {
      const date = new Date(c.commit.author.date).toLocaleDateString(
        undefined,
        { month: "short", day: "numeric" },
      );
      container.insertAdjacentHTML(
        "beforeend",
        `
            <div class="p-3 bg-slate-50 border border-slate-100 rounded-lg hover:border-blue-200 transition group">
                <div class="flex justify-between items-start mb-1">
                    <a href="${c.html_url}" target="_blank" class="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded group-hover:bg-blue-100 group-hover:text-blue-700 transition">${c.sha.substring(0, 7)}</a>
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">${date}</span>
                </div>
                <p class="text-sm font-medium text-slate-800 break-words">${c.commit.message}</p>
            </div>
        `,
      );
    });

    renderChart(allCommits, filter);
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red-500 font-medium">${err.message}</p>`;
    renderChart([], filter);
  }
}

function renderChart(commits, filter) {
  const now = new Date();
  const labels = [];
  const dataMap = {};

  // Generate strict timelines to guarantee proportional chart spacing
  if (filter === "24h") {
    for (let i = 23; i >= 0; i--) {
      let d = new Date(now.getTime() - i * 60 * 60 * 1000);
      let label = d.toLocaleTimeString([], { hour: "numeric", hour12: true });
      let key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
      labels.push({ label, key });
      dataMap[key] = 0;
    }
  } else {
    let days = filter === "7d" ? 7 : filter === "30d" ? 30 : 90;
    for (let i = days - 1; i >= 0; i--) {
      let d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      let label = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      let key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      labels.push({ label, key });
      dataMap[key] = 0;
    }
  }

  const hasData = commits && commits.length > 0;
  if (hasData) {
    commits.forEach((c) => {
      let cd = new Date(c.commit.author.date);
      let key =
        filter === "24h"
          ? `${cd.getFullYear()}-${cd.getMonth()}-${cd.getDate()}-${cd.getHours()}`
          : `${cd.getFullYear()}-${cd.getMonth()}-${cd.getDate()}`;
      if (dataMap[key] !== undefined) {
        dataMap[key]++;
      }
    });
  }

  const displayLabels = labels.map((l) => l.label);
  const dataPoints = labels.map((l) => dataMap[l.key]);

  // Dynamic Chart Styling based on the timeline length
  let pointRadius = filter === "90d" ? 1 : filter === "30d" ? 3 : 5;
  let pointHoverRadius = filter === "90d" ? 4 : 7;
  let maxTicks =
    filter === "24h" ? 24 : filter === "7d" ? 7 : filter === "30d" ? 15 : 12;
  let lineTension = filter === "90d" ? 0.1 : filter === "30d" ? 0.2 : 0.4;

  const ctx = document.getElementById("commitChart").getContext("2d");
  if (currentChart) currentChart.destroy();

  currentChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: displayLabels,
      datasets: [
        {
          label: "Commits",
          data: dataPoints,
          borderColor: hasData ? "#3b82f6" : "#cbd5e1",
          backgroundColor: hasData
            ? "rgba(59, 130, 246, 0.1)"
            : "rgba(203, 213, 225, 0.1)",
          borderWidth: 2,
          tension: lineTension,
          fill: true,
          pointBackgroundColor: hasData ? "#1d4ed8" : "#94a3b8",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: pointRadius,
          pointHoverRadius: pointHoverRadius,
          pointHitRadius: 15,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 },
          grid: { color: "#f1f5f9" },
          border: { display: false },
        },
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { maxTicksLimit: maxTicks, autoSkip: true },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          intersect: false,
          mode: "index",
        },
      },
    },
  });
}

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "signOutBtn") {
    signOut(auth).then(() => (window.location.href = "login.html"));
  }
});

// ==========================================
// STUDENT DIAGNOSTIC ENGINE
// ==========================================
async function verifyStudentSetup(studentData) {
  const banner = document.getElementById("studentWarningBanner");
  const title = document.getElementById("warningTitle");
  const msg = document.getElementById("warningMessage");

  if (!banner || !studentData) return;

  const triggerWarning = (colorClass, header, message) => {
    banner.className = `mb-6 p-4 rounded-lg border shadow-sm flex items-start gap-3 ${colorClass}`;
    title.textContent = header;
    msg.innerHTML = message;
    banner.classList.remove("hidden");
  };

  if (!studentData.repoUrl || !studentData.githubUsername) {
    return triggerWarning(
      "bg-amber-50 border-amber-200 text-amber-800",
      "Missing Configuration",
      "You must configure your <strong>GitHub Username</strong> and <strong>Repository URL</strong> in your Settings to track your progress.",
    );
  }

  try {
    let owner, repo;
    const urlParts = studentData.repoUrl
      .replace(/\/$/, "")
      .replace(".git", "")
      .split("/");
    repo = urlParts.pop();
    owner = urlParts.pop();

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`,
    );

    if (res.status === 404) {
      return triggerWarning(
        "bg-red-50 border-red-200 text-red-800",
        "Repository Not Found",
        "We cannot reach your code. Ensure your URL is spelled correctly and that the repository is set to <strong>Public</strong> on GitHub.",
      );
    }

    if (res.status === 403) {
      return triggerWarning(
        "bg-slate-50 border-slate-200 text-slate-800",
        "GitHub Rate Limit Reached",
        "You have refreshed too many times. Please wait a few minutes before GitHub allows us to check your repository again.",
      );
    }

    if (res.status === 409) {
      return triggerWarning(
        "bg-blue-50 border-blue-200 text-blue-800",
        "Empty Repository",
        "Your repository is successfully linked, but it is completely empty. Push your first code commit to see your analytics.",
      );
    }

    if (res.ok) {
      const commits = await res.json();

      const ghUsername = (studentData.githubUsername || "")
        .toLowerCase()
        .trim();
      const stuEmail = (studentData.email || "").toLowerCase().trim();
      const stuName = (studentData.name || "").toLowerCase().trim();

      const hasCommit = commits.some((c) => {
        const login = (c.author?.login || "").toLowerCase();
        const commitEmail = (c.commit?.author?.email || "").toLowerCase();
        const commitName = (c.commit?.author?.name || "").toLowerCase();

        if (ghUsername && login === ghUsername) return true;
        if (stuEmail && commitEmail === stuEmail) return true;
        if (stuName && commitName === stuName) return true;

        return false;
      });

      if (!hasCommit && commits.length > 0) {
        return triggerWarning(
          "bg-amber-50 border-amber-200 text-amber-800",
          "Identity Mismatch Detected",
          `We see code in this repository, but none of it matches your configured GitHub username (<strong>${studentData.githubUsername}</strong>). If you wrote this code, please check for typos in your Settings.`,
        );
      }

      banner.classList.add("hidden");
    }
  } catch (e) {
    console.error("Diagnostic check failed:", e);
  }
}
