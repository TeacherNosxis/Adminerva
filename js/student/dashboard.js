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
  signInWithPopup,
  reauthenticateWithPopup,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

let userProfiles = [];
let currentChart = null;
let currentStudentProfile = null;
let cachedCommitsData = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");

  document.getElementById("pageBody").classList.remove("hidden");

  // 1. Check for Impersonation Mode
  const impersonateEmail = localStorage.getItem("Adminerva_Impersonate");
  const targetEmail = impersonateEmail
    ? impersonateEmail.toLowerCase()
    : user.email.toLowerCase();

  const emailDisplay = document.getElementById("userEmailDisplay");
  if (emailDisplay)
    emailDisplay.textContent =
      targetEmail + (impersonateEmail ? " (Impersonating)" : "");

  // 2. Inject a warning banner if viewing as a student
  if (impersonateEmail && !document.getElementById("impersonateBanner")) {
    const nav = document.getElementById("adminerva-nav");
    nav.insertAdjacentHTML(
      "afterend",
      `
          <div id="impersonateBanner" class="bg-amber-400 text-amber-900 px-6 py-2.5 font-bold text-sm flex justify-between items-center shadow-sm border-b border-amber-500 w-full relative z-[100]">
              <div class="flex items-center gap-2">
                  <span class="text-xl">👁️</span>
                  <span><strong>IMPERSONATION MODE:</strong> Viewing workspace exactly as <u>${targetEmail}</u> experiences it.</span>
              </div>
              <button onclick="window.exitImpersonation()" class="bg-amber-900 text-amber-50 px-4 py-1.5 rounded hover:bg-amber-950 transition shadow-sm text-xs tracking-wide">Exit & Return</button>
          </div>
      `,
    );

    window.exitImpersonation = function () {
      localStorage.removeItem("Adminerva_Impersonate");
      localStorage.removeItem("Adminerva_Mock_Role");
      window.location.href = "users.html";
    };
  }

  const timeFilterDropdown = document.getElementById("timeFilter");
  if (timeFilterDropdown) {
    timeFilterDropdown.addEventListener("change", (e) => {
      if (currentStudentProfile) {
        renderCommits(cachedCommitsData, e.target.value);
        renderChart(cachedCommitsData, e.target.value);
      }
    });
  }

  const connectGithubBtn = document.getElementById("connectGithubBtn");
  if (connectGithubBtn) {
    if (impersonateEmail) {
      connectGithubBtn.textContent = "Disabled during Impersonation";
      connectGithubBtn.disabled = true;
      connectGithubBtn.classList.add("opacity-50", "cursor-not-allowed");
    } else {
      connectGithubBtn.addEventListener("click", linkGithubAccount);
    }
  }

  try {
    const q = query(
      collection(db, "students"),
      where("email", "==", targetEmail),
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

  // Run the Diagnostic Engine
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

  const defaultFilter = document.getElementById("timeFilter")?.value || "7d";
  const cacheRef = doc(db, "student_dashboard_cache", studentData.docId);

  // 🚨 THE FIX: Wrap the database call in a try/catch.
  try {
    const cacheSnap = await getDoc(cacheRef);
    if (cacheSnap.exists()) {
      cachedCommitsData = cacheSnap.data().commits || [];
      renderCommits(cachedCommitsData, defaultFilter);
      renderChart(cachedCommitsData, defaultFilter);
    }
  } catch (error) {
    console.warn(
      "Database read bypassed (Likely missing permissions). Continuing to UI load.",
    );
  }

  if (!studentData.githubToken) {
    overlay.classList.remove("hidden");
    return;
  }

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

// 🚨 UPDATED: Smart Auth Flow
async function linkGithubAccount() {
  const provider = new GithubAuthProvider();
  provider.addScope("repo");
  provider.addScope("read:user");

  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const isAlreadyGithub = currentUser.providerData.some(
    (p) => p.providerId === "github.com",
  );

  let result;
  try {
    if (isAlreadyGithub) {
      // User is already signed in with GitHub — just re-authenticate to refresh credentials
      result = await reauthenticateWithPopup(currentUser, provider);
    } else {
      // User is signed in with Google — link their GitHub identity
      result = await linkWithPopup(currentUser, provider);
    }
  } catch (error) {
    // If linking says credential already in use, sign in with popup to claim the token directly
    if (error.code === "auth/credential-already-in-use") {
      result = await signInWithPopup(auth, provider);
    } else {
      alert("GitHub Connection Failed: " + error.message);
      return;
    }
  }

  const credential = GithubAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  const verifiedUsername =
    result._tokenResponse?.screenName ||
    result.user?.reloadUserInfo?.screenName ||
    result.user?.reloadUserInfo?.providerUserInfo?.find(
      (p) => p.providerId === "github.com",
    )?.screenName;

  if (token && currentStudentProfile?.docId) {
    const docRef = doc(db, "students", currentStudentProfile.docId);
    const updateData = { githubToken: token };
    if (verifiedUsername) updateData.githubUsername = verifiedUsername;

    await setDoc(docRef, updateData, { merge: true });

    currentStudentProfile.githubToken = token;
    if (verifiedUsername)
      currentStudentProfile.githubUsername = verifiedUsername;

    const overlay = document.getElementById("githubAuthOverlay");
    if (overlay) overlay.classList.add("hidden");

    loadDashboardProfile(currentStudentProfile);
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
    signOut(auth).then(() => {
      localStorage.removeItem("Adminerva_Role");
      localStorage.removeItem("Adminerva_Mock_Role");
      localStorage.removeItem("Adminerva_Impersonate");
      window.location.href = "login.html";
    });
  }
});

// ==========================================
// TOKEN-POWERED DIAGNOSTIC ENGINE
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

  if (!studentData.githubToken) {
    return triggerWarning(
      "bg-blue-50 border-blue-200 text-blue-800",
      "GitHub Disconnected",
      "Please connect your GitHub account via the prompt in your analytics panel to sync your data.",
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
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`,
      {
        headers: {
          Authorization: `Bearer ${studentData.githubToken}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (res.status === 401) {
      return triggerWarning(
        "bg-red-50 border-red-200 text-red-800",
        "Token Expired or Revoked",
        "The connected GitHub account token is no longer valid. The account must be reconnected.",
      );
    }
    if (res.status === 404) {
      return triggerWarning(
        "bg-red-50 border-red-200 text-red-800",
        "Repository Not Found",
        "We cannot reach this code. Ensure the URL is correct and the linked GitHub account has access to it.",
      );
    }
    if (res.status === 403) {
      return triggerWarning(
        "bg-slate-50 border-slate-200 text-slate-800",
        "GitHub Rate Limit Reached",
        "Too many requests. Please wait a few minutes.",
      );
    }
    if (res.status === 409) {
      return triggerWarning(
        "bg-blue-50 border-blue-200 text-blue-800",
        "Empty Repository",
        "Your repository is linked, but it is completely empty.",
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

        return (
          (ghUsername && login === ghUsername) ||
          (stuEmail && commitEmail === stuEmail) ||
          (stuName && commitName === stuName)
        );
      });

      if (!hasCommit && commits.length > 0) {
        return triggerWarning(
          "bg-amber-50 border-amber-200 text-amber-800",
          "Identity Mismatch Detected",
          `We see code in this repository, but none of it matches the linked GitHub account (<strong>@${studentData.githubUsername}</strong>). Are you pushing code using a different account?`,
        );
      }

      banner.classList.add("hidden");
    }
  } catch (e) {
    console.error("Diagnostic check failed:", e);
  }
}
