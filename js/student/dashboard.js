import { db, auth } from "../core/firebase-core.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  onAuthStateChanged,
  signOut,
  linkWithPopup,
  GithubAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

let userProfiles = [];
let currentChart = null;
let currentStudentProfile = null;
let cachedCommitsData = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");

  document.getElementById("pageBody").classList.remove("hidden");
  const emailDisplay = document.getElementById("userEmailDisplay");
  if (emailDisplay) emailDisplay.textContent = user.email;

  const timeFilterDropdown = document.getElementById("timeFilter");
  if (timeFilterDropdown) {
    timeFilterDropdown.addEventListener("change", (e) => {
      if (currentStudentProfile) {
        // Just re-render the cache with the new time filter
        renderCommits(cachedCommitsData, e.target.value);
        renderChart(cachedCommitsData, e.target.value);
      }
    });
  }

  // Bind the GitHub OAuth Link Button
  document
    .getElementById("connectGithubBtn")
    .addEventListener("click", linkGithubAccount);

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
    snap.forEach((d) => userProfiles.push({ docId: d.id, ...d.data() }));

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
        selector.addEventListener("change", (e) =>
          loadDashboardProfile(userProfiles[e.target.value]),
        );
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
  const overlay = document.getElementById("githubAuthOverlay");

  verifyStudentSetup(studentData);
  overlay.classList.add("hidden");

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

  // 1. INSTANT CACHE LOAD: Read from Firebase first
  const defaultFilter = document.getElementById("timeFilter")?.value || "7d";
  const cacheRef = doc(db, "student_dashboard_cache", studentData.docId);
  const cacheSnap = await getDoc(cacheRef);

  if (cacheSnap.exists()) {
    cachedCommitsData = cacheSnap.data().commits || [];
    renderCommits(cachedCommitsData, defaultFilter);
    renderChart(cachedCommitsData, defaultFilter);
  }

  // 2. CHECK TOKEN: If they haven't connected OAuth, show prompt and stop here
  if (!studentData.githubToken) {
    overlay.classList.remove("hidden");
    return;
  }

  // 3. BACKGROUND SYNC: Use personal token to fetch updates
  syncGitHubData(
    studentData.repoUrl,
    studentData.githubUsername,
    studentData.githubToken,
    cacheRef,
  );
}

async function syncGitHubData(repoUrl, username, token, cacheRef) {
  try {
    const urlParts = repoUrl.replace(/\/$/, "").replace(".git", "").split("/");
    const repo = urlParts.pop();
    const owner = urlParts.pop();

    // Fetching up to 4 pages (400 commits) for the 90d view support
    let allCommits = [];
    for (let page = 1; page <= 4; page++) {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?author=${encodeURIComponent(username)}&per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        },
      );
      if (!response.ok) break;

      const commits = await response.json();
      allCommits = allCommits.concat(commits);
      if (commits.length < 100) break;
    }

    if (allCommits.length > 0) {
      cachedCommitsData = allCommits;

      // Save updated data to Firebase for the next instant load
      await setDoc(
        cacheRef,
        { commits: allCommits, lastSynced: new Date().toISOString() },
        { merge: true },
      );

      const filter = document.getElementById("timeFilter")?.value || "7d";
      renderCommits(cachedCommitsData, filter);
      renderChart(cachedCommitsData, filter);
    }
  } catch (err) {
    console.warn("Background sync failed, using cached data.", err);
  }
}

async function linkGithubAccount() {
  const provider = new GithubAuthProvider();
  provider.addScope("repo");

  try {
    const result = await linkWithPopup(auth.currentUser, provider);
    const credential = GithubAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;

    // Auto-capture their verified GitHub Username from the provider details
    const verifiedUsername = result.user.reloadUserInfo.providerUserInfo.find(
      (p) => p.providerId === "github.com",
    ).screenName;

    // Save token and verified username to Firestore
    const docRef = doc(db, "students", currentStudentProfile.docId);
    await setDoc(
      docRef,
      {
        githubToken: token,
        githubUsername: verifiedUsername, // Overwrites any typos they made in settings
      },
      { merge: true },
    );

    currentStudentProfile.githubToken = token;
    currentStudentProfile.githubUsername = verifiedUsername;

    document.getElementById("githubAuthOverlay").classList.add("hidden");
    loadDashboardProfile(currentStudentProfile);
  } catch (error) {
    alert("GitHub Connection Failed: " + error.message);
  }
}

function renderCommits(commits, filter) {
  const container = document.getElementById("commitListContainer");
  if (!commits || commits.length === 0) {
    container.innerHTML =
      "<p class='text-sm text-slate-500 font-bold'>No commits found in this timeframe.</p>";
    return;
  }

  container.innerHTML = "";
  commits.slice(0, 7).forEach((c) => {
    const date = new Date(c.commit.author.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
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
}

function renderChart(commits, filter) {
  const now = new Date();
  const labels = [];
  const dataMap = {};

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

      // Respect the time filter limit for rendering
      let cutoff = new Date();
      if (filter === "24h") cutoff.setHours(now.getHours() - 24);
      else if (filter === "7d") cutoff.setDate(now.getDate() - 7);
      else if (filter === "30d") cutoff.setMonth(now.getMonth() - 1);
      else if (filter === "90d") cutoff.setMonth(now.getMonth() - 3);

      if (cd >= cutoff && dataMap[key] !== undefined) {
        dataMap[key]++;
      }
    });
  }

  const displayLabels = labels.map((l) => l.label);
  const dataPoints = labels.map((l) => dataMap[l.key]);

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

  if (!studentData.githubToken) {
    return triggerWarning(
      "bg-blue-50 border-blue-200 text-blue-800",
      "GitHub Disconnected",
      "Please connect your GitHub account via the prompt in your analytics panel to sync your data.",
    );
  }

  banner.classList.add("hidden");
}
