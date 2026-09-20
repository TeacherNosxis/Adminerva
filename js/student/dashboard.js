// 1. Import the centralized database and auth engine!
import { db, auth } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // 2. Wait for Firebase Auth to confirm who is logged in, then load their data
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Update this function name to whatever your student data loading function is called
      loadStudentData(user.email);
    }
  });
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");
  document.getElementById("pageBody").classList.remove("hidden");
  document.getElementById("userEmailDisplay").textContent = user.email;

  try {
    const q = query(
      collection(db, "students"),
      where("email", "==", user.email.toLowerCase()),
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      document.getElementById("repoSubtitle").innerHTML =
        "<span class='text-red-500'>Profile incomplete. Please configure your settings.</span>";
      document.getElementById("commitListContainer").innerHTML =
        "<p class='text-sm text-red-500 font-bold'>Missing GitHub connection.</p>";
      return;
    }

    let studentData = null;
    snap.forEach((d) => (studentData = d.data()));

    if (!studentData.repoUrl || !studentData.githubUsername) {
      document.getElementById("repoSubtitle").innerHTML =
        "<span class='text-amber-600'>Please set your Repository URL and Username in Settings.</span>";
      document.getElementById("commitListContainer").innerHTML =
        "<p class='text-sm text-amber-600 font-bold'>Awaiting GitHub configuration...</p>";
      return;
    }

    document.getElementById("repoSubtitle").textContent =
      `Tracking ${studentData.githubUsername} on ${studentData.repoUrl}`;
    fetchGitHubData(studentData.repoUrl, studentData.githubUsername);
  } catch (error) {
    console.error(error);
  }
});

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
        "<p class='text-sm text-slate-500'>No commits found for your username yet.</p>";
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
  new Chart(ctx, {
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
// PASTE THIS INSTEAD:
// Event Delegation for dynamically injected Sign Out button
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "signOutBtn") {
    signOut(auth).then(() => (window.location.href = "login.html"));
  }
});
