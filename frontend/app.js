// Configuration
const DEFAULT_API_BASE = 'http://localhost:5000';
let API_BASE = localStorage.getItem('gh_ranker_api') || DEFAULT_API_BASE;

// DOM Elements
const serverStatusDot = document.getElementById('serverStatusDot');
const serverStatusText = document.getElementById('serverStatusText');
const apiUrlInput = document.getElementById('apiUrlInput');
const userForm = document.getElementById('userForm');
const usernameInput = document.getElementById('usernameInput');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const submitBtnSpinner = document.getElementById('submitBtnSpinner');
const alertBox = document.getElementById('alertBox');
const refreshBtn = document.getElementById('refreshBtn');
const refreshIcon = document.getElementById('refreshIcon');
const searchFilter = document.getElementById('searchFilter');
const leaderboardBody = document.getElementById('leaderboardBody');
const tableContent = document.getElementById('tableContent');
const stateMessage = document.getElementById('stateMessage');

// Stat Elements
const statTotalUsers = document.getElementById('statTotalUsers');
const statTopDev = document.getElementById('statTopDev');
const statTopScore = document.getElementById('statTopScore');

// State
let allUsers = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  apiUrlInput.value = API_BASE;
  checkServerStatus();
  fetchLeaderboard();

  apiUrlInput.addEventListener('change', (e) => {
    API_BASE = e.target.value.trim().replace(/\/$/, '') || DEFAULT_API_BASE;
    localStorage.setItem('gh_ranker_api', API_BASE);
    checkServerStatus();
    fetchLeaderboard();
  });

  userForm.addEventListener('submit', handleAddUser);
  refreshBtn.addEventListener('click', () => {
    spinRefreshIcon();
    fetchLeaderboard();
  });

  searchFilter.addEventListener('input', (e) => {
    renderLeaderboard(e.target.value.trim().toLowerCase());
  });
});

// Quick Pick Handler
function setUsername(uname) {
  usernameInput.value = uname;
  usernameInput.focus();
}

// Server Health Check
async function checkServerStatus() {
  serverStatusDot.className = 'status-dot';
  serverStatusText.textContent = 'Connecting...';

  try {
    const res = await fetch(`${API_BASE}/`, { method: 'GET' });
    if (res.ok) {
      serverStatusDot.className = 'status-dot online';
      serverStatusText.textContent = 'Server Connected';
    } else {
      throw new Error('Server responded with non-200');
    }
  } catch (err) {
    serverStatusDot.className = 'status-dot offline';
    serverStatusText.textContent = 'Server Offline';
  }
}

// Fetch Leaderboard from Backend (GET /api/users)
async function fetchLeaderboard() {
  showTableState('loading', 'Loading ranked developers...');

  try {
    const res = await fetch(`${API_BASE}/api/users`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to fetch leaderboard`);
    }

    const data = await res.json();
    allUsers = Array.isArray(data) ? data : [];

    updateStats(allUsers);
    renderLeaderboard(searchFilter.value.trim().toLowerCase());
    serverStatusDot.className = 'status-dot online';
    serverStatusText.textContent = 'Server Connected';
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    showTableState('error', `Could not load leaderboard. Make sure backend is running at ${API_BASE}`);
    serverStatusDot.className = 'status-dot offline';
    serverStatusText.textContent = 'Server Offline';
  }
}

// Handle Form Submission (POST /api/users)
async function handleAddUser(e) {
  e.preventDefault();
  const username = usernameInput.value.trim();

  if (!username) {
    showAlert('Please enter a GitHub username.', 'danger');
    return;
  }

  // Set loading state
  setSubmitting(true);
  hideAlert();

  try {
    const res = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });

    const result = await res.json();

    if (!res.ok) {
      const errorMsg = result.error || 'Failed to process user.';
      showAlert(errorMsg, 'danger');
      return;
    }

    const userData = result.data;
    const userDisplay = userData ? (userData.name || userData.username) : username;
    const scoreDisplay = userData ? Number(userData.score).toLocaleString() : '';

    showAlert(`Success! ${userDisplay} (@${userData ? userData.username : username}) ranked with a score of ${scoreDisplay}!`, 'success');
    usernameInput.value = '';

    // Refresh the leaderboard
    await fetchLeaderboard();
  } catch (err) {
    console.error('Error adding user:', err);
    showAlert(`Network error: Could not reach backend at ${API_BASE}. Make sure the server is started.`, 'danger');
  } finally {
    setSubmitting(false);
  }
}

// Render Leaderboard Table
function renderLeaderboard(query = '') {
  const filtered = allUsers.filter(u => {
    if (!query) return true;
    const login = (u.username || '').toLowerCase();
    const name = (u.name || '').toLowerCase();
    return login.includes(query) || name.includes(query);
  });

  if (filtered.length === 0) {
    if (allUsers.length === 0) {
      showTableState('empty', 'No developers ranked yet. Use the form above to fetch and rank the first GitHub user!');
    } else {
      showTableState('empty', `No developers matched "${query}".`);
    }
    return;
  }

  // Show table and hide state container
  stateMessage.style.display = 'none';
  tableContent.style.display = 'table';

  leaderboardBody.innerHTML = filtered.map((user, index) => {
    const rank = index + 1;
    let rankBadge = '';

    if (rank === 1) {
      rankBadge = `<span class="rank-badge rank-1" title="1st Place">🥇</span>`;
    } else if (rank === 2) {
      rankBadge = `<span class="rank-badge rank-2" title="2nd Place">🥈</span>`;
    } else if (rank === 3) {
      rankBadge = `<span class="rank-badge rank-3" title="3rd Place">🥉</span>`;
    } else {
      rankBadge = `<span class="rank-badge">#${rank}</span>`;
    }

    const avatarUrl = `https://github.com/${escapeHtml(user.username)}.png?size=96`;
    const profileUrl = `https://github.com/${escapeHtml(user.username)}`;
    const displayName = escapeHtml(user.name || user.username);
    const username = escapeHtml(user.username);
    const repos = Number(user.public_repos || 0).toLocaleString();
    const followers = Number(user.followers || 0).toLocaleString();
    const stars = Number(user.total_stars || 0).toLocaleString();
    const score = Number(user.score || 0).toLocaleString();

    return `
      <tr>
        <td>${rankBadge}</td>
        <td>
          <div class="user-info">
            <img class="user-avatar" src="${avatarUrl}" alt="${username}" onerror="this.src='https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'" loading="lazy" />
            <div class="user-names">
              <span class="user-fullname">${displayName}</span>
              <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="user-handle">@${username}</a>
            </div>
          </div>
        </td>
        <td>
          <span class="metric-pill" title="Total Stars">
            ⭐ ${stars}
          </span>
        </td>
        <td>
          <span class="metric-pill" title="Followers">
            👥 ${followers}
          </span>
        </td>
        <td>
          <span class="metric-pill" title="Public Repositories">
            📁 ${repos}
          </span>
        </td>
        <td>
          <span class="score-badge" title="Formula: (Stars × 2) + Followers + Repos">
            ⚡ ${score}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// Update Top Stat Cards
function updateStats(users) {
  statTotalUsers.textContent = users.length.toLocaleString();

  if (users.length > 0) {
    const top = users[0];
    statTopDev.textContent = `@${top.username}`;
    statTopScore.textContent = Number(top.score || 0).toLocaleString();
  } else {
    statTopDev.textContent = '-';
    statTopScore.textContent = '-';
  }
}

// UI State Helpers
function showTableState(type, message) {
  tableContent.style.display = 'none';
  stateMessage.style.display = 'block';

  let icon = '';
  if (type === 'loading') {
    icon = '<div class="spinner" style="width: 28px; height: 28px; border-width: 3px; margin-bottom: 12px;"></div>';
  } else if (type === 'error') {
    icon = '<div style="font-size: 2rem; margin-bottom: 8px;">⚠️</div>';
  } else {
    icon = '<div style="font-size: 2rem; margin-bottom: 8px;">🏆</div>';
  }

  stateMessage.innerHTML = `
    ${icon}
    <p>${escapeHtml(message)}</p>
  `;
}

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  usernameInput.disabled = isSubmitting;
  if (isSubmitting) {
    submitBtnSpinner.style.display = 'inline-block';
    submitBtnText.textContent = 'Ranking...';
  } else {
    submitBtnSpinner.style.display = 'none';
    submitBtnText.textContent = 'Fetch & Rank';
  }
}

function showAlert(message, type = 'info') {
  alertBox.className = `alert alert-${type} show`;
  alertBox.innerHTML = `
    <span>${type === 'success' ? '✅' : '❌'}</span>
    <div>${escapeHtml(message)}</div>
  `;
}

function hideAlert() {
  alertBox.className = 'alert';
  alertBox.style.display = 'none';
}

function spinRefreshIcon() {
  refreshIcon.style.transition = 'transform 0.5s ease';
  refreshIcon.style.transform = 'rotate(360deg)';
  setTimeout(() => {
    refreshIcon.style.transition = 'none';
    refreshIcon.style.transform = 'rotate(0deg)';
  }, 500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
