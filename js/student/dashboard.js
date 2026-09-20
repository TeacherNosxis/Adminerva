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

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");

  document.getElementById("pageBody").classList.remove("hidden");
  const emailDisplay = document.getElementById("userEmailDisplay");
  if (emailDisplay) emailDisplay.textContent = user.email;

  try {
    // 1. Fetch ALL documents matching the student's email
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

    // 2. Setup the Section Selector Dropdown
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

        // Listen for class/club switching
        selector.addEventListener("change", (e) => {
          loadDashboardProfile(userProfiles[e.target.value]);
        });
      } else {
        selector.classList.add("hidden");
      }
    }

    // 3. Load the first profile by default
    loadDashboardProfile(userProfiles[0]);
  } catch (error) {
    console.error("Dashboard Load Error:", error);
  }
});

async function loadDashboardProfile(studentData) {
  const subtitle = document.getElementById("repoSubtitle");
  const container = document.getElementById("commitListContainer");

  // Clear chart if it exists from a previous section
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }

  if (!studentData.repoUrl || !studentData.githubUsername) {
    subtitle.innerHTML = `<strong class="text-amber-700">${studentData.section}:</strong> <span class='text-amber-600'>Please set your Repository URL and Username in Settings.</span>`;
    container.innerHTML =
      "<p class='text-sm text-amber-600 font-bold'>Awaiting GitHub configuration...</p>";
    return;
  }

  subtitle.innerHTML = `<strong>${studentData.section}:</strong> Tracking <span class="font-mono text-xs text-slate-800">${studentData.githubUsername}</span> on <a href="${studentData.repoUrl}" target="_blank" class="text-blue-500 hover:underline font-mono text-xs">${studentData.repoUrl}</a>`;

  // Set loading state
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

  await fetchGitHubData(studentData.repoUrl, studentData.githubUsername);
}

async function fetchGitHubData(repoUrl, username) {
  const container = document.getElementById("commitListContainer");
  try {
    let owner, repo;
    const urlParts = repoUrl.replace(/\/$/, "").replace(".git", "").split("/");
    repo = urlParts.pop();
    owner = urlParts.pop();

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?author=${encodeURIComponent(username)}&per_page=30`,
    );

    if (!response.ok) {
      if (response.status === 404)
        throw new Error(
          "Repository is Private or Not Found. Cannot fetch analytics.",
        );
      throw new Error(`GitHub API Error: ${response.status}`);
    }

    const commits = await response.json();

    if (commits.length === 0) {
      container.innerHTML =
        "<p class='text-sm text-slate-500 font-bold'>No commits found for your username yet.</p>";
      return;
    }

    container.innerHTML = "";
    commits.slice(0, 7).forEach((c) => {
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

    renderChart(commits);
  } catch (err) {
    container.innerHTML = `<p class="text-sm text-red-500 font-medium">${err.message}</p>`;
  }
}

function renderChart(commits) {
  const dateCounts = {};
  commits.forEach((c) => {
    const date = new Date(c.commit.author.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    dateCounts[date] = (dateCounts[date] || 0) + 1;
  });

  const sortedDates = Object.keys(dateCounts).sort(
    (a, b) => new Date(a) - new Date(b),
  );
  const dataPoints = sortedDates.map((date) => dateCounts[date]);

  const ctx = document.getElementById("commitChart").getContext("2d");

  if (currentChart) currentChart.destroy();

  currentChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: sortedDates,
      datasets: [
        {
          label: "Commits",
          data: dataPoints,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: "#1d4ed8",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
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
        x: { grid: { display: false }, border: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
        },
      },
    },
  });
}

// Global Sign Out Logic
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "signOutBtn") {
    signOut(auth).then(() => (window.location.href = "login.html"));
  }
});
