// Main Logic Controller for Student Council Management System

// สภาพแวดล้อมจำลอง (State)
let currentUser = null;
let currentRole = null; // student, admin, public
let loginSelectedRole = "student";
let activeTab = "public-achievements";
let charts = {};
let uploadedReportImages = [];
let uploadedNewsImage = "";
let uploadedAchievementImage = "";
let currentEditingReportId = null;
let selectedSongIds = [];
let collapsedDates = {};
let uploadedLostFoundImage = "";
let currentLfFilter = "all";
let currentLfCategory = "all";
let currentChatSessionId = null;
let chatPollInterval = null;
let studentChatAttachments = [];
let adminChatAttachments = [];
let appInitialized = false;
let hashRoutingBound = false;
let fileUploadHandlersBound = false;
const API_BASE_URL = (() => {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin || '';
    if (origin) {
      return `${origin}/api`;
    }
  }
  return '/api';
})();
const SAMPLE_STUDENTS = [
  { name: "สมชาย ใจดี", id: "12345", class: "ม.6/2" },
  { name: "สมศรี รักเรียน", id: "12346", class: "ม.5/1" },
  { name: "ปรีชา ชนะภัย", id: "11111", class: "ม.4/3" }
];
const PROFANITY_WORDS = [
  "ห่า", "เหี้ย", "ควย", "สัส", "จิ๊", "ไอ้เหี้ย", "แดก", "เมิง", "มึง", "ไอ้สัส", "นรก", "asshole", "fuck", "shit", "bitch"
];
let syncTimer = null;
let serverSyncAvailable = false;
let lostFoundPollInterval = null;

function getPersistedAuthState() {
  try {
    const storedUser = localStorage.getItem("sc_session_user") || sessionStorage.getItem("sc_session_user");
    const storedRole = localStorage.getItem("sc_session_role") || sessionStorage.getItem("sc_session_role");

    if (storedUser && storedRole) {
      return {
        user: JSON.parse(storedUser),
        role: storedRole
      };
    }
  } catch (error) {
    console.warn("Unable to restore auth session:", error);
  }

  return null;
}

function persistAuthSession(user, role) {
  currentUser = user || null;
  currentRole = role || null;

  if (currentUser && currentRole) {
    const userPayload = JSON.stringify(currentUser);
    localStorage.setItem("sc_session_user", userPayload);
    localStorage.setItem("sc_session_role", currentRole);
    sessionStorage.setItem("sc_session_user", userPayload);
    sessionStorage.setItem("sc_session_role", currentRole);
  } else {
    clearAuthSession();
  }
}

function clearAuthSession() {
  currentUser = null;
  currentRole = null;
  localStorage.removeItem("sc_session_user");
  localStorage.removeItem("sc_session_role");
  sessionStorage.removeItem("sc_session_user");
  sessionStorage.removeItem("sc_session_role");
}

const LOST_FOUND_CATEGORIES = [
  { value: "money", label: "เงิน", icon: "💵" },
  { value: "electronics", label: "อุปกรณ์อิเล็กทรอนิกส์", icon: "📱" },
  { value: "documents", label: "เอกสาร/บัตร", icon: "🪪" },
  { value: "keys", label: "กุญแจ/กุญแจรถ", icon: "🔑" },
  { value: "clothing", label: "เสื้อผ้า/หมวก", icon: "👕" },
  { value: "accessories", label: "เครื่องประดับ", icon: "💍" },
  { value: "belongings", label: "ของใช้ทั่วไป", icon: "🎒" },
  { value: "others", label: "อื่น ๆ", icon: "🧰" }
];

function getLostFoundCategoryMeta(category) {
  return LOST_FOUND_CATEGORIES.find(item => item.value === category) || LOST_FOUND_CATEGORIES[LOST_FOUND_CATEGORIES.length - 1];
}

function getLostFoundCategoryBadge(category) {
  const meta = getLostFoundCategoryMeta(category);
  return `<span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600"><span class="mr-1">${meta.icon}</span>${meta.label}</span>`;
}

function renderLostFoundCategoryOptions(selectedCategory = "others") {
  const container = getEl("lf-category-options");
  const hidden = getEl("lf-category");

  if (!container || !hidden) return;

  container.innerHTML = LOST_FOUND_CATEGORIES.map(category => {
    const isActive = category.value === selectedCategory;
    return `
      <button type="button" data-value="${category.value}" class="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${isActive ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-400 dark:hover:bg-slate-800'}">
        <span>${category.icon}</span>
        <span>${category.label}</span>
      </button>
    `;
  }).join("");

  container.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      const selected = button.getAttribute("data-value") || "others";
      hidden.value = selected;
      renderLostFoundCategoryOptions(selected);
    });
  });

  hidden.value = selectedCategory;
}

function getEl(id) {
  return document.getElementById(id);
}

function showToast(message, type = "info", duration = 2800) {
  const container = getEl("app-toast");
  if (!container) return;

  const toast = document.createElement("div");
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info"
  };
  const colors = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    error: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300",
    info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-300"
  };

  toast.className = `toast-item border rounded-xl px-3 py-2.5 shadow-lg backdrop-blur-sm pointer-events-auto ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <div class="flex items-start gap-2">
      <i class="fa-solid ${icons[type] || icons.info} mt-0.5"></i>
      <div class="text-[12px] font-medium leading-snug">${message}</div>
    </div>
  `;

  container.appendChild(toast);
  requestFrame(() => toast.classList.add("toast-visible"));

  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

function showModal(modalId) {
  const modal = getEl(modalId);
  if (!modal) return;
  const panel = modal.querySelector('.modal-panel');

  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  requestFrame(() => {
    modal.classList.add('modal-show');
    if (panel) panel.classList.add('modal-show');
  });
}

function hideModal(modalId, callback) {
  const modal = getEl(modalId);
  if (!modal) {
    if (callback) callback();
    return;
  }
  const panel = modal.querySelector('.modal-panel');

  modal.classList.remove('modal-show');
  if (panel) panel.classList.remove('modal-show');

  setTimeout(() => {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    if (callback) callback();
  }, 240);
}

function setText(id, value) {
  const el = getEl(id);
  if (el) el.textContent = value;
}

function setValue(id, value) {
  const el = getEl(id);
  if (el) el.value = value;
}

function requestFrame(callback) {
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(callback);
    });
  } else {
    callback();
  }
}

function bindSidebarNavigation() {
  const links = document.querySelectorAll(".sidebar-link");
  links.forEach(link => {
    const tab = (link.getAttribute("data-tab") || link.getAttribute("href") || "").replace("#", "");
    if (!tab) return;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      switchTab(tab);
    });
  });
}

// ==================== INITIALIZATION ====================
window.addEventListener("DOMContentLoaded", () => {
  if (appInitialized) return;
  appInitialized = true;

  // 1. โหลด Dark Mode จาก LocalStorage
  const savedDarkMode = localStorage.getItem("sc_dark_mode");
  if (savedDarkMode === "enabled") {
    document.documentElement.classList.add("dark");
    updateThemeUI(true);
  } else {
    document.documentElement.classList.remove("dark");
    updateThemeUI(false);
  }

  // 2. ตรวจสอบประวัติการล็อกอินที่บันทึกไว้ในเบราว์เซอร์
  const restoredAuth = getPersistedAuthState();
  if (restoredAuth) {
    currentUser = restoredAuth.user;
    currentRole = restoredAuth.role;
  }
  updateAuthUI();

  // 3. จัดการ Routing และ Tabs จาก URL Hash
  handleHashRouting();
  if (!hashRoutingBound) {
    window.addEventListener("hashchange", handleHashRouting);
    hashRoutingBound = true;
  }

  // 4. ตั้งค่า Event Listeners สำหรับการอัปโหลดไฟล์
  bindSidebarNavigation();
  initAutoFillLogin();
  setupFileUploadListeners();
  setupGlobalModalInteractions();
  checkServerHealth();
  window.scheduleSyncData = scheduleSyncData;
  window.addEventListener("storage", handleExternalStorageChange);
});

function setupGlobalModalInteractions() {
  const modalIds = ["student-lostfound-modal", "admin-song-modal"];

  modalIds.forEach(modalId => {
    const modal = getEl(modalId);
    if (!modal) return;

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        if (modalId === "student-lostfound-modal") {
          closeLostFoundModal();
        } else {
          closeAdminSongModal();
        }
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!getEl("student-lostfound-modal")?.classList.contains("hidden")) {
      closeLostFoundModal();
    } else if (!getEl("admin-song-modal")?.classList.contains("hidden")) {
      closeAdminSongModal();
    }
  });
}

function initAutoFillLogin() {
  const studentIdInput = getEl("login-student-id");

  if (studentIdInput) {
    studentIdInput.addEventListener("input", () => {
      const id = studentIdInput.value.trim();
      const student = SAMPLE_STUDENTS.find(s => s.id === id);
      if (student) {
        // ถ้าต้องการ สามารถแสดงข้อความช่วยเตือนหรือเติมข้อมูลเพิ่มเติมได้ที่นี่
      }
    });
  }
}

function checkServerHealth() {
  fetch(`${API_BASE_URL}/health`)
    .then(res => res.json())
    .then(data => {
      if (data && data.status === 'ok') {
        serverSyncAvailable = true;
        loadRemoteStudents();
        startLostFoundRealtime();
      }
    })
    .catch(() => {
      serverSyncAvailable = false;
    });
}

function loadRemoteStudents() {
  fetch(`${API_BASE_URL}/students`)
    .then(res => res.json())
    .then(remoteStudents => {
      if (!Array.isArray(remoteStudents)) return;
      mergeRemoteStudents(remoteStudents);
    })
    .catch(() => {
      // ignore remote load failure, keep using local data
    });
}

function mergeRemoteStudents(remoteStudents) {
  const localStudents = window.StudentCouncilDB.getStudents();
  const studentMap = new Map(localStudents.map(student => [student.id, { ...student }]));

  let didChange = false;
  remoteStudents.forEach(remote => {
    if (!remote || !remote.id) return;
    const existing = studentMap.get(remote.id);
    if (existing) {
      const merged = {
        id: remote.id,
        name: remote.name || existing.name,
        class: remote.class || existing.class
      };
      const changed = merged.name !== existing.name || merged.class !== existing.class;
      if (changed) {
        studentMap.set(remote.id, merged);
        didChange = true;
      }
    } else {
      studentMap.set(remote.id, {
        id: remote.id,
        name: remote.name || "",
        class: remote.class || ""
      });
      didChange = true;
    }
  });

  if (didChange) {
    window.StudentCouncilDB.saveStudents(Array.from(studentMap.values()));
  }
}

function scheduleSyncData() {
  if (!serverSyncAvailable) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncAllLocalDataToServer();
  }, 500);
}

function syncAllLocalDataToServer() {
  if (!serverSyncAvailable) return;
  const payloads = {
    news: window.StudentCouncilDB.getNews(),
    links: window.StudentCouncilDB.getLinks(),
    reports: window.StudentCouncilDB.getReports(),
    achievements: window.StudentCouncilDB.getAchievements(),
    students: window.StudentCouncilDB.getStudents(),
    songs: window.StudentCouncilDB.getSongs(),
    lostFound: window.StudentCouncilDB.getLostFound(),
    chat: window.StudentCouncilDB.getChat()
  };

  Object.entries(payloads).forEach(([resource, data]) => {
    fetch(`${API_BASE_URL}/${resource}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(err => {
      console.warn(`Sync failed for ${resource}:`, err);
      serverSyncAvailable = false;
    });
  });
}

function syncChatToServer() {
  if (!serverSyncAvailable) return;
  const chat = window.StudentCouncilDB.getChat();
  fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chat)
  }).catch(err => {
    console.warn('Chat sync failed:', err);
    serverSyncAvailable = false;
  });
}

function refreshChatFromServer() {
  if (!serverSyncAvailable) return;
  fetch(`${API_BASE_URL}/chat`)
    .then(res => res.json())
    .then(serverChat => {
      if (!Array.isArray(serverChat)) return;
      const localChat = window.StudentCouncilDB.getChat();
      const mergedChat = mergeChatMessages(localChat, serverChat);
      const localJson = JSON.stringify(localChat);
      const mergedJson = JSON.stringify(mergedChat);
      if (mergedJson !== localJson) {
        window.StudentCouncilDB.saveChat(mergedChat);
        maybeUpdateChatViews();
      }
    })
    .catch(err => {
      console.warn('Chat refresh failed:', err);
      serverSyncAvailable = false;
    });
}

function mergeChatMessages(localChat = [], serverChat = []) {
  const messageMap = new Map();
  const allMessages = [...localChat, ...serverChat];

  allMessages.forEach(msg => {
    if (!msg || !msg.id) return;
    const existing = messageMap.get(msg.id);
    if (!existing) {
      messageMap.set(msg.id, msg);
      return;
    }
    const existingDate = existing.dateTime ? new Date(existing.dateTime) : null;
    const currentDate = msg.dateTime ? new Date(msg.dateTime) : null;
    if (!existingDate || (currentDate && currentDate > existingDate)) {
      messageMap.set(msg.id, msg);
    }
  });

  return Array.from(messageMap.values()).sort((a, b) => {
    const dateA = a.dateTime ? new Date(a.dateTime) : new Date(0);
    const dateB = b.dateTime ? new Date(b.dateTime) : new Date(0);
    return dateA - dateB;
  });
}

function startChatRealtime() {
  if (chatPollInterval) return;
  refreshChatFromServer();
  chatPollInterval = setInterval(() => {
    refreshChatFromServer();
  }, 2500);
}

function stopChatRealtime() {
  if (chatPollInterval) {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }
}

function refreshLostFoundFromServer() {
  if (!serverSyncAvailable) return;
  fetch(`${API_BASE_URL}/lostFound`)
    .then(res => res.json())
    .then(serverList => {
      if (!Array.isArray(serverList)) return;
      const localList = window.StudentCouncilDB.getLostFound();
      const localJson = JSON.stringify(localList || []);
      const serverJson = JSON.stringify(serverList || []);
      if (serverJson !== localJson) {
        localStorage.setItem('sc_lost_found', serverJson);
        maybeUpdateLostFoundViews();
      }
    })
    .catch(err => {
      console.warn('Lost & Found refresh failed:', err);
      serverSyncAvailable = false;
      stopLostFoundRealtime();
    });
}

function startLostFoundRealtime() {
  if (lostFoundPollInterval) return;
  refreshLostFoundFromServer();
  lostFoundPollInterval = setInterval(() => {
    refreshLostFoundFromServer();
  }, 3000);
}

function stopLostFoundRealtime() {
  if (lostFoundPollInterval) {
    clearInterval(lostFoundPollInterval);
    lostFoundPollInterval = null;
  }
}

function updateChatRealtimeState(tabId) {
  if (tabId === 'student-chat' || tabId === 'admin-chat') {
    startChatRealtime();
  } else {
    stopChatRealtime();
  }
}

function handleExternalStorageChange(event) {
  if (!event.key) return;
  if (event.key === 'sc_chat' && event.newValue) {
    maybeUpdateChatViews();
  }
  if (event.key === 'sc_lost_found' && event.newValue) {
    maybeUpdateLostFoundViews();
  }
}

function maybeUpdateChatViews() {
  if (activeTab === 'student-chat') {
    renderStudentChat();
  }
  if (activeTab === 'admin-chat') {
    renderAdminChat();
  }
}

function maybeUpdateLostFoundViews() {
  if (activeTab === 'student-lostfound') {
    renderStudentLostFound();
  }
  if (activeTab === 'admin-lostfound') {
    renderAdminLostFound();
  }
}

// ==================== NAVIGATION & ROUTING ====================
function handleHashRouting() {
  const hash = window.location.hash.substring(1);
  const validTabs = [
    "public-achievements",
    "student-news",
    "student-links",
    "student-report",
    "student-chat",
    "student-track",
    "student-songs",
    "student-lostfound",
    "admin-dashboard",
    "admin-reports",
    "admin-chat",
    "admin-news",
    "admin-links",
    "admin-achievements",
    "admin-songs",
    "admin-lostfound",
    "login"
  ];
  
  let targetTab = hash || "public-achievements";
  if (!validTabs.includes(targetTab)) {
    targetTab = "public-achievements";
  }

  // Guards (ระบบรักษาความปลอดภัยจำลอง)
  if (targetTab.startsWith("student-") && currentRole !== "student") {
    showLoading(() => {
      window.location.hash = "#login";
    });
    return;
  }
  if (targetTab.startsWith("admin-") && currentRole !== "admin") {
    showLoading(() => {
      window.location.hash = "#login";
    });
    return;
  }
  if (targetTab === "login" && currentRole) {
    // ล็อกอินแล้วไม่ควรเข้าหน้าล็อกอินซ้ำ
    window.location.hash = currentRole === "admin" ? "#admin-dashboard" : "#student-news";
    return;
  }

  activeTab = targetTab;
  switchTabUI(activeTab);
}

function switchTab(tabId) {
  const normalizedTab = tabId || "public-achievements";
  window.location.hash = normalizedTab;
  const sidebar = getEl("sidebar");
  const overlay = getEl("sidebar-overlay");
  if (sidebar) sidebar.classList.add("-translate-x-full");
  if (overlay) overlay.classList.add("hidden");
}

function switchTabUI(tabId) {
  selectedSongIds = [];
  const batchBar = getEl("admin-song-batch-bar");
  if (batchBar) {
    batchBar.classList.add("translate-y-24", "opacity-0", "pointer-events-none");
  }

  const views = [
    "view-login",
    "view-public-achievements",
    "view-student-news",
    "view-student-links",
    "view-student-report",
    "view-student-chat",
    "view-student-track",
    "view-student-songs",
    "view-student-lostfound",
    "view-admin-dashboard",
    "view-admin-reports",
    "view-admin-chat",
    "view-admin-news",
    "view-admin-links",
    "view-admin-achievements",
    "view-admin-songs",
    "view-admin-lostfound"
  ];

  views.forEach(v => {
    const el = getEl(v);
    if (el) {
      el.classList.add("hidden", "opacity-0", "translate-y-2", "view-transition");
      el.classList.remove("opacity-100", "translate-y-0", "is-visible");
    }
  });

  const targetView = getEl(`view-${tabId}`);
  if (targetView) {
    targetView.classList.remove("hidden");
    requestFrame(() => {
      targetView.classList.remove("opacity-0", "translate-y-2");
      targetView.classList.add("opacity-100", "translate-y-0", "is-visible");
    });
  }

  const sidebarLinks = document.querySelectorAll(".sidebar-link");
  sidebarLinks.forEach(link => {
    const href = (link.getAttribute("href") || "").substring(1);
    if (href === tabId) {
      link.classList.add("bg-slate-800", "text-white", "border-l-4", "border-blue-500");
      link.classList.remove("text-slate-300");
    } else {
      link.classList.remove("bg-slate-800", "text-white", "border-l-4", "border-blue-500");
      link.classList.add("text-slate-300");
    }
  });

  const headerTitle = getEl("page-header-title");
  const tabTitles = {
    "public-achievements": "สรุปผลงานและการแก้ไขปัญหา",
    "student-news": "ข่าวสารและประกาศจากสภานักเรียน",
    "student-links": "ศูนย์รวมลิงก์สำคัญ",
    "student-report": "แจ้งปัญหากิจการโรงเรียน",
    "student-chat": "แชทกับแอดมิน",
    "student-track": "ติดตามสถานะการแจ้งปัญหา",
    "student-songs": "ขอเพลงสภานักเรียน",
    "student-lostfound": "ของหายได้คืน",
    "admin-dashboard": "Dashboard ภาพรวมระบบ",
    "admin-reports": "จัดการปัญหาที่ได้รับแจ้ง",
    "admin-chat": "หน้าจอแชทผู้ดูแล",
    "admin-news": "จัดการข่าวสารสภาฯ",
    "admin-links": "จัดการลิงก์ภายนอก",
    "admin-achievements": "จัดการผลงานสภานักเรียน",
    "admin-songs": "จัดการคิวขอเพลงของนักเรียน",
    "admin-lostfound": "จัดการของหายได้คืน",
    "login": "เข้าสู่ระบบสภานักเรียน"
  };
  if (headerTitle) headerTitle.textContent = tabTitles[tabId] || "ระบบจัดการสภานักเรียน";

  loadViewSpecificData(tabId);
  updateChatRealtimeState(tabId);
}

function loadViewSpecificData(tabId) {
  switch (tabId) {
    case "public-achievements":
      renderPublicAchievements();
      renderPublicCharts();
      break;
    case "student-news":
      renderStudentNews();
      break;
    case "student-links":
      renderStudentLinks();
      break;
    case "student-report":
      initStudentReportForm();
      break;
    case "student-track":
      renderStudentTrack();
      break;
    case "student-chat":
      renderStudentChat();
      break;
    case "admin-dashboard":
      renderAdminDashboard();
      break;
    case "admin-reports":
      renderAdminReports();
      break;
    case "admin-chat":
      renderAdminChat();
      break;
    case "admin-news":
      renderAdminNewsTable();
      break;
    case "admin-links":
      renderAdminLinksTable();
      break;
    case "admin-achievements":
      renderAdminAchievementsTable();
      break;
    case "student-songs":
      renderStudentSongs();
      break;
    case "admin-songs":
      renderAdminSongs();
      break;
    case "student-lostfound":
      renderStudentLostFound();
      break;
    case "admin-lostfound":
      renderAdminLostFound();
      break;
  }
}

// ==================== AUTHENTICATION LOGIC ====================
function toggleLoginRegister(mode) {
  const formLogin = document.getElementById("form-login-student");
  const formRegister = document.getElementById("form-register-student");
  const errorDiv = document.getElementById("login-error");
  if (errorDiv) errorDiv.classList.add("hidden");

  if (mode === "register") {
    formLogin.classList.add("hidden");
    formRegister.classList.remove("hidden");
  } else {
    formLogin.classList.remove("hidden");
    formRegister.classList.add("hidden");
  }
}

function submitRegister() {
  const name = document.getElementById("register-student-name").value.trim();
  const id = document.getElementById("register-student-id").value.trim();
  const classroom = document.getElementById("register-student-class").value.trim();
  const errorDiv = document.getElementById("login-error");
  const errorMsg = document.getElementById("login-error-msg");

  if (!name || id.length !== 5 || !classroom) {
    errorMsg.textContent = "กรุณากรอกข้อมูลส่วนตัวให้ครบถ้วน และรหัสนักเรียนต้องมี 5 หลัก";
    errorDiv.classList.remove("hidden");
    return;
  }

  const students = window.StudentCouncilDB.getStudents();
  const exists = students.find(s => s.id === id);
  if (exists) {
    errorMsg.textContent = "รหัสนักเรียนนี้เคยลงทะเบียนในระบบแล้ว";
    errorDiv.classList.remove("hidden");
    return;
  }

  // ลงทะเบียนนักเรียนใหม่สำเร็จ
  students.push({ name, id, class: classroom });
  window.StudentCouncilDB.saveStudents(students);

  showLoading(() => {
    alert(`ลงทะเบียนบัญชีนักเรียนใหม่สำหรับคุณ ${name} สำเร็จแล้ว! คุณสามารถเข้าสู่ระบบได้ทันที`);
    document.getElementById("login-student-id").value = id;
    toggleLoginRegister("login");
  });
}

function setLoginRole(role) {
  loginSelectedRole = role;
  const errorDiv = document.getElementById("login-error");
  if (errorDiv) errorDiv.classList.add("hidden");

  const btnStudent = document.getElementById("login-tab-student");
  const btnAdmin = document.getElementById("login-tab-admin");
  const formStudent = document.getElementById("form-login-student");
  const formRegister = document.getElementById("form-register-student");
  const formAdmin = document.getElementById("form-login-admin");

  if (role === "student") {
    btnStudent.className = "flex-1 py-3 text-sm font-semibold border-b-2 border-school-blue text-school-blue dark:text-school-yellow dark:border-school-yellow";
    btnAdmin.className = "flex-1 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 dark:text-slate-400";
    formStudent.classList.remove("hidden");
    formRegister.classList.add("hidden");
    formAdmin.classList.add("hidden");
  } else {
    btnAdmin.className = "flex-1 py-3 text-sm font-semibold border-b-2 border-school-blue text-school-blue dark:text-school-yellow dark:border-school-yellow";
    btnStudent.className = "flex-1 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 dark:text-slate-400";
    formAdmin.classList.remove("hidden");
    formStudent.classList.add("hidden");
    formRegister.classList.add("hidden");
  }
}

function getAcceptedAdminPasswords() {
  return new Set(["admin123", "Admin123", "SCLRPCADMIN2026", "SCLRPCADMIN", "admin1234"]);
}

function findAdminAccount(admins, enteredUser, enteredPass) {
  const normalizedUser = (enteredUser || "").trim().toLowerCase();
  if (!normalizedUser) return null;

  return admins.find((admin) => {
    const storedUsername = (admin?.username || "").trim().toLowerCase();
    if (storedUsername !== normalizedUser) return false;

    const acceptedPasswords = getAcceptedAdminPasswords();
    return acceptedPasswords.has(enteredPass) || acceptedPasswords.has(admin?.password);
  });
}

function submitLogin(role) {
  const errorDiv = document.getElementById("login-error");
  const errorMsg = document.getElementById("login-error-msg");

  if (role === "student") {
    const studentId = document.getElementById("login-student-id").value.trim();

    if (studentId.length !== 5 || isNaN(studentId)) {
      errorMsg.textContent = "กรุณากรอกรหัสนักเรียน 5 หลักที่เป็นตัวเลขให้ถูกต้อง";
      errorDiv.classList.remove("hidden");
      return;
    }

    const students = window.StudentCouncilDB.getStudents();
    const foundStudent = students.find(s => s.id === studentId);

    if (!foundStudent) {
      errorMsg.textContent = "รหัสนักเรียนยังไม่ได้ลงทะเบียนในระบบ กรุณาลงทะเบียนก่อนเข้าสู่ระบบ";
      errorDiv.classList.remove("hidden");
      return;
    }

    // ล็อกอินสำเร็จ
    persistAuthSession(foundStudent, "student");

    showLoading(() => {
      updateAuthUI();
      window.location.hash = "#student-news";
    });

  } else if (role === "admin") {
    const adminUser = document.getElementById("login-admin-user").value.trim();
    const adminPass = document.getElementById("login-admin-pass").value.trim();
    const admins = window.StudentCouncilDB.getAdmins();
    const foundAdmin = findAdminAccount(admins, adminUser, adminPass);

    if (foundAdmin) {
      const updatedAdmins = admins.map((admin) => {
        if ((admin?.username || "").trim().toLowerCase() === adminUser.trim().toLowerCase()) {
          return {
            ...admin,
            username: "Admin",
            password: "admin123",
            name: "แอดมิน",
            displayName: "ผู้ดูแลระบบ"
          };
        }
        return admin;
      });
      window.StudentCouncilDB.saveAdmins(updatedAdmins);

      persistAuthSession({ name: foundAdmin.displayName || foundAdmin.name, role: "Administrator", class: "ส่วนกลาง" }, "admin");

      showLoading(() => {
        updateAuthUI();
        window.location.hash = "#admin-dashboard";
      });
    } else {
      errorMsg.textContent = "ชื่อผู้ใช้งานหรือรหัสผ่านผู้ดูแลระบบไม่ถูกต้อง";
      errorDiv.classList.remove("hidden");
    }
  }
}

function logout() {
  clearAuthSession();
  
  showLoading(() => {
    updateAuthUI();
    window.location.hash = "#public-achievements";
  });
}

function handleAuthAction() {
  if (currentRole) {
    if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      logout();
    }
  } else {
    window.location.hash = "#login";
  }
}

function updateAuthUI() {
  const sidebarUserPanel = getEl("sidebar-user-panel");
  const sidebarUserName = getEl("sidebar-user-name");
  const sidebarUserRole = getEl("sidebar-user-role");

  const headerUserPanel = getEl("header-user-panel");
  const headerUserName = getEl("header-user-name");
  const headerUserClass = getEl("header-user-class");

  const studentMenu = getEl("sidebar-student-menu");
  const adminMenu = getEl("sidebar-admin-menu");
  const authBtn = getEl("sidebar-auth-btn");

  if (currentRole === "student") {
    if (sidebarUserPanel) sidebarUserPanel.classList.remove("hidden");
    if (sidebarUserName) sidebarUserName.textContent = currentUser ? currentUser.name : "นักเรียน";
    if (sidebarUserRole) {
      sidebarUserRole.textContent = currentUser ? `นักเรียน (${currentUser.class})` : "นักเรียน";
      sidebarUserRole.className = "text-xs px-2 py-0.5 bg-school-yellow/10 text-school-yellow rounded border border-school-yellow/30 font-medium inline-block mt-0.5";
    }

    if (headerUserPanel) headerUserPanel.classList.remove("hidden");
    if (headerUserName) headerUserName.textContent = currentUser ? currentUser.name : "นักเรียน";
    if (headerUserClass) headerUserClass.textContent = currentUser ? `รหัส: ${currentUser.id} | ${currentUser.class}` : "ชั้น";

    if (studentMenu) studentMenu.classList.remove("hidden");
    if (adminMenu) adminMenu.classList.add("hidden");

    if (authBtn) {
      authBtn.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i><span>ออกจากระบบ</span>`;
      authBtn.className = "w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium rounded-lg text-sm transition-all duration-150 flex items-center justify-center space-x-2";
    }

  } else if (currentRole === "admin") {
    if (sidebarUserPanel) sidebarUserPanel.classList.remove("hidden");
    if (sidebarUserName) sidebarUserName.textContent = currentUser ? currentUser.name : "ผู้ดูแลระบบ";
    if (sidebarUserRole) {
      sidebarUserRole.textContent = "ผู้ดูแลระบบ";
      sidebarUserRole.className = "text-xs px-2 py-0.5 bg-emerald-900/80 text-emerald-300 rounded border border-emerald-800 font-medium inline-block mt-0.5";
    }

    if (headerUserPanel) headerUserPanel.classList.remove("hidden");
    if (headerUserName) headerUserName.textContent = currentUser ? currentUser.name : "ผู้ดูแลระบบ";
    if (headerUserClass) headerUserClass.textContent = "ฝ่ายเทคโนโลยีสารสนเทศ";

    if (studentMenu) studentMenu.classList.add("hidden");
    if (adminMenu) adminMenu.classList.remove("hidden");

    if (authBtn) {
      authBtn.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i><span>ออกจากระบบ</span>`;
      authBtn.className = "w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium rounded-lg text-sm transition-all duration-150 flex items-center justify-center space-x-2";
    }

  } else {
    if (sidebarUserPanel) sidebarUserPanel.classList.add("hidden");
    if (headerUserPanel) headerUserPanel.classList.add("hidden");
    if (studentMenu) studentMenu.classList.add("hidden");
    if (adminMenu) adminMenu.classList.add("hidden");

    if (authBtn) {
      authBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i><span>เข้าสู่ระบบ</span>`;
      authBtn.className = "w-full py-2 px-4 bg-school-yellow hover:bg-yellow-500 text-slate-900 font-bold rounded-lg text-sm transition-all duration-150 flex items-center justify-center space-x-2 shadow-md";
    }
  }
}

// ==================== STUDENT VIEW RENDERERS ====================

// 1. หน้าแสดงข่าวสารประชาสัมพันธ์
function renderStudentNews() {
  const container = getEl("student-news-grid");
  const searchInput = getEl("news-search");
  const searchQuery = (searchInput?.value || "").toLowerCase();
  const newsList = window.StudentCouncilDB.getNews();

  if (!container) return;

  const filteredNews = newsList.filter(news => 
    news.title.toLowerCase().includes(searchQuery) || 
    news.content.toLowerCase().includes(searchQuery)
  );

  const countEl = getEl("student-news-count");
  if (countEl) countEl.textContent = filteredNews.length;

  if (filteredNews.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-16 text-slate-400">
        <i class="fa-regular fa-newspaper text-4xl mb-3 block"></i>
        <span>ไม่พบข่าวสารประชาสัมพันธ์ที่เกี่ยวข้อง</span>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredNews.map(news => `
    <div onclick="openStudentNewsModal('${news.id}')" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-premium shadow-premium-hover overflow-hidden cursor-pointer flex flex-col h-full">
      <div class="h-44 bg-slate-200 dark:bg-slate-900 overflow-hidden relative">
        <img src="${news.image}" alt="news cover" class="w-full h-full object-cover">
        <span class="absolute top-3 right-3 px-2 py-1 bg-slate-900/60 text-white text-[10px] rounded backdrop-blur-sm font-english">${formatThaiDate(news.date)}</span>
      </div>
      <div class="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h4 class="font-bold text-sm text-slate-800 dark:text-white line-clamp-2 leading-snug">${news.title}</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">${news.content}</p>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-xs text-blue-600 dark:text-blue-400 font-semibold">
          <span>อ่านรายละเอียดเพิ่มเติม</span>
          <i class="fa-solid fa-arrow-right"></i>
        </div>
      </div>
    </div>
  `).join("");
}

// 2. หน้าแสดงลิงก์สำคัญ
function renderStudentLinks() {
  const container = getEl("student-links-container");
  const links = window.StudentCouncilDB.getLinks();

  if (!container) return;

  // จัดหมวดหมู่ลิงก์
  const categories = ["แบบประเมินและสำรวจ", "รับสมัครและลงทะเบียน", "เว็บไซต์โรงเรียน"];
  
  container.innerHTML = categories.map(cat => {
    const catLinks = links.filter(l => l.category === cat);
    if (catLinks.length === 0) return "";

    let catIcon = "fa-solid fa-link";
    if (cat === "แบบประเมินและสำรวจ") catIcon = "fa-regular fa-file-lines text-emerald-500";
    if (cat === "รับสมัครและลงทะเบียน") catIcon = "fa-solid fa-user-plus text-blue-500";
    if (cat === "เว็บไซต์โรงเรียน") catIcon = "fa-solid fa-school text-indigo-500";

    return `
      <div class="space-y-3">
        <h3 class="font-bold text-sm text-slate-500 uppercase tracking-wider flex items-center">
          <i class="${catIcon} mr-2"></i>
          <span>${cat}</span>
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${catLinks.map(link => `
            <a href="${link.url}" target="_blank" class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-premium shadow-premium-hover flex items-center justify-between text-slate-700 dark:text-slate-200">
              <div class="flex items-center space-x-3 overflow-hidden pr-3">
                <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400">
                  <i class="fa-solid fa-up-right-from-square text-xs"></i>
                </div>
                <span class="text-xs font-medium truncate">${link.title}</span>
              </div>
              <i class="fa-solid fa-chevron-right text-slate-300 dark:text-slate-600 text-xs shrink-0"></i>
            </a>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

// 3. ฟอร์มส่งปัญหา/แจ้งเรื่อง
function initStudentReportForm() {
  document.getElementById("report-form-name").value = currentUser && currentUser.name ? currentUser.name : "";
  document.getElementById("report-form-id").value = currentUser && currentUser.id ? currentUser.id : "";
  document.getElementById("report-form-class").value = currentUser && currentUser.class ? currentUser.class : "";

  // รีเซ็ตฟิลด์ข้อมูล
  document.getElementById("report-title").value = "";
  document.getElementById("report-category").value = "";
  document.getElementById("report-location").value = "";
  document.getElementById("report-desc").value = "";
  
  // ตั้งค่าวันที่/เวลาเป็นปัจจุบัน
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("report-datetime").value = now.toISOString().slice(0, 16);

  // เคลียร์ไฟล์รูปภาพที่อัปโหลดไว้
  uploadedReportImages = [];
  renderUploadedPreviews();
}

function submitProblemReport() {
  const title = document.getElementById("report-title").value.trim();
  const category = document.getElementById("report-category").value;
  const location = document.getElementById("report-location").value.trim();
  const dateTime = document.getElementById("report-datetime").value;
  const description = document.getElementById("report-desc").value.trim();

  const typedName = document.getElementById("report-form-name").value.trim();
  const typedId = document.getElementById("report-form-id").value.trim();
  const typedClass = document.getElementById("report-form-class").value.trim();

  if (!typedName || typedId.length !== 5 || isNaN(typedId) || !typedClass) {
    alert("กรุณากรอกชื่อผู้แจ้ง รหัสนักเรียน 5 หลัก (ตัวเลข) และชั้นให้ถูกต้อง");
    return;
  }

  // อัปเดตข้อมูลผู้ใช้ใน Session
  if (!currentUser) {
    currentUser = { name: typedName, id: typedId, class: typedClass };
  } else {
    currentUser.name = typedName;
    currentUser.id = typedId;
    currentUser.class = typedClass;
  }
  persistAuthSession(currentUser, currentRole || "student");
  updateAuthUI();

  // บันทึกลงตารางนักเรียนเพื่อให้ล็อกอินคราวหลังได้
  const students = window.StudentCouncilDB.getStudents();
  const sIdx = students.findIndex(s => s.id === typedId);
  if (sIdx !== -1) {
    students[sIdx].name = typedName;
    students[sIdx].class = typedClass;
  } else {
    students.push({ name: typedName, id: typedId, class: typedClass });
  }
  window.StudentCouncilDB.saveStudents(students);

  const reports = window.StudentCouncilDB.getReports();
  const newReport = {
    id: `rep-${Date.now()}`,
    studentName: typedName,
    studentId: typedId,
    classroom: typedClass,
    title,
    description,
    category,
    location,
    dateTime,
    status: "pending",
    images: [...uploadedReportImages],
    adminNotes: "",
    resolvedDate: ""
  };

  reports.unshift(newReport);
  window.StudentCouncilDB.saveReports(reports);

  showLoading(() => {
    alert("ส่งปัญหาร้องเรียนสำเร็จแล้ว! สภานักเรียนจะดำเนินการตรวจสอบข้อมูลต่อไป");
    switchTab("student-track");
  });
}

// 4. ติดตามประวัติสถานะปัญหาของตนเอง
let currentStudentTrackFilter = "all";
function filterStudentTrack(status) {
  currentStudentTrackFilter = status;
  
  // ไฮไลต์ปุ่ม Tab ฟิลเตอร์
  const tabs = ["all", "pending", "processing", "completed", "failed"];
  tabs.forEach(t => {
    const el = document.getElementById(`track-tab-${t}`);
    if (el) {
      if (t === status) {
        el.className = "px-4 py-2 text-xs font-semibold border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400";
      } else {
        el.className = "px-4 py-2 text-xs font-semibold border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200";
      }
    }
  });

  renderStudentTrack();
}

function createReportCard(rep) {
  let statusClass = "";
  let statusLabel = "";
  let statusIcon = "";

  switch (rep.status) {
    case "pending":
      statusClass = "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400";
      statusLabel = "รอรับเรื่อง";
      statusIcon = "fa-solid fa-clock";
      break;
    case "processing":
      statusClass = "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400";
      statusLabel = "กำลังดำเนินการ";
      statusIcon = "fa-solid fa-spinner status-active-pulse";
      break;
    case "completed":
      statusClass = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400";
      statusLabel = "ดำเนินการแล้ว";
      statusIcon = "fa-solid fa-circle-check";
      break;
    default:
      statusClass = "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400";
      statusLabel = "ไม่สามารถดำเนินการได้";
      statusIcon = "fa-solid fa-circle-xmark";
      break;
  }

  const hasImages = rep.images && rep.images.length > 0;
  const hasNotes = rep.adminNotes && rep.adminNotes.trim().length > 0;
  const reportTime = rep.dateTime ? `${formatThaiDate(rep.dateTime.split("T")[0])} ${rep.dateTime.split("T")[1] || ""}` : "-";

  return `
    <div onclick="openReportDetailModal('${rep.id}', false)" class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-premium shadow-premium-hover cursor-pointer transition duration-150">
      <div class="flex flex-col xl:flex-row gap-4 xl:items-start justify-between">
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-3xl bg-slate-100 dark:bg-slate-900/70 text-slate-600 dark:text-slate-200 flex items-center justify-center text-lg">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-2">
              <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-300">#${rep.id.split("-")[1] || rep.id}</span>
              <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full ${statusClass}">${statusLabel}</span>
              <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300">${rep.category}</span>
            </div>
            <h4 class="font-bold text-sm text-slate-800 dark:text-white truncate">${rep.title}</h4>
            <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div class="inline-flex items-center gap-2"><i class="fa-solid fa-location-dot"></i>${rep.location}</div>
              <div class="inline-flex items-center gap-2"><i class="fa-regular fa-calendar-days"></i>${reportTime}</div>
            </div>
          </div>
        </div>
        <div class="flex flex-col items-start xl:items-end gap-2">
          <div class="text-[11px] text-slate-500 dark:text-slate-400">${hasImages ? `${rep.images.length} รูปแนบ` : "ไม่มีรูปแนบ"}</div>
          <button class="px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-200 rounded-2xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition duration-150">
            ดูรายละเอียด <i class="fa-solid fa-chevron-right ml-2"></i>
          </button>
        </div>
      </div>
      <p class="mt-4 text-slate-600 dark:text-slate-300 text-xs leading-relaxed line-clamp-3">${rep.description || "ไม่มีรายละเอียดเพิ่มเติม"}</p>
      <div class="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        ${hasNotes ? `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"><i class="fa-solid fa-message"></i>ตอบกลับแล้ว</span>` : ""}
      </div>
    </div>
  `;
}

function renderStudentTrack() {
  const container = getEl("student-track-list");
  const reports = window.StudentCouncilDB.getReports();
  
  // คัดกรองเฉพาะรายงานของนักเรียนคนนี้
  let myReports = reports.filter(r => r.studentId === currentUser.id);

  // คัดกรองตามสถานะที่เลือก
  if (currentStudentTrackFilter !== "all") {
    myReports = myReports.filter(r => r.status === currentStudentTrackFilter);
  }

  if (myReports.length === 0) {
    container.innerHTML = `
      <div class="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-premium">
        <i class="fa-solid fa-clock-rotate-left text-4xl text-slate-300 dark:text-slate-600 mb-3 block"></i>
        <p class="text-sm text-slate-500 dark:text-slate-400">ยังไม่มีรายการปัญหาที่แจ้งเข้าระบบในขณะนี้</p>
      </div>
    `;
    return;
  }

  container.innerHTML = myReports.map(createReportCard).join("");
}

function formatChatAttachmentsHtml(attachments, isAdmin) {
  if (!Array.isArray(attachments) || attachments.length === 0) return "";
  return `
    <div class="mt-3 grid grid-cols-2 gap-2">
      ${attachments.map(att => `
        <div class="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <img src="${att.dataUrl}" alt="${att.name}" class="w-full h-28 object-cover">
          <div class="p-2 text-[11px] text-slate-500 dark:text-slate-400 truncate">${att.name}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderStudentChat() {
  if (!currentUser) return;
  currentChatSessionId = currentUser.id;
  const chatContainer = getEl("student-chat-list");
  const sessionLabel = getEl("student-chat-session-name");
  const messages = window.StudentCouncilDB.getChat().filter(msg => msg.sessionId === currentChatSessionId);

  if (sessionLabel) {
    sessionLabel.textContent = `ห้องแชทของ ${currentUser.name}`;
  }

  if (chatContainer) {
    if (messages.length === 0) {
      chatContainer.innerHTML = `
        <div class="text-center py-20 text-slate-400">
          <i class="fa-solid fa-comments text-4xl mb-4"></i>
          <p class="text-sm">ยังไม่มีข้อความในห้องแชทนี้ ลองเขียนข้อความแรกของคุณ</p>
        </div>
      `;
    } else {
      chatContainer.innerHTML = messages.map(msg => {
        const isAdmin = msg.senderRole === "admin";
        const bubbleClass = isAdmin ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100" : "bg-emerald-600 text-white";
        const labelClass = isAdmin ? "text-slate-500 dark:text-slate-400" : "text-emerald-100";
        const timeLabel = msg.dateTime ? `${formatThaiDate(msg.dateTime.split("T")[0])} ${msg.dateTime.split("T")[1] || ""}` : "";
        const attachmentsHtml = formatChatAttachmentsHtml(msg.attachments || [], isAdmin);
        return `
          <div class="flex ${isAdmin ? "justify-start" : "justify-end"}">
            <div class="max-w-[80%] rounded-3xl p-4 shadow-sm ${bubbleClass}">
              <div class="text-[11px] font-semibold mb-2 ${labelClass}">${msg.senderName}</div>
              <div class="text-sm leading-relaxed break-words">${msg.text || ""}</div>
              ${attachmentsHtml}
              <div class="mt-2 text-[10px] opacity-80 ${labelClass}">${timeLabel}</div>
            </div>
          </div>
        `;
      }).join("");
    }

    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 50);
  }
}

function renderAdminChat() {
  const sessionList = getEl("admin-chat-session-list");
  const chatContainer = getEl("admin-chat-list");
  const caption = getEl("admin-chat-session-caption");
  const chatData = window.StudentCouncilDB.getChat();

  const sessionMap = {};
  chatData.forEach(msg => {
    if (!sessionMap[msg.sessionId]) {
      const student = window.StudentCouncilDB.getStudents().find(s => s.id === msg.sessionId);
      sessionMap[msg.sessionId] = {
        sessionId: msg.sessionId,
        studentName: student ? student.name : `นักเรียน ${msg.sessionId}`,
        lastMessage: msg
      };
    }
    if (new Date(msg.dateTime) > new Date(sessionMap[msg.sessionId].lastMessage.dateTime)) {
      sessionMap[msg.sessionId].lastMessage = msg;
    }
  });

  const sessions = Object.values(sessionMap).sort((a, b) => new Date(b.lastMessage.dateTime) - new Date(a.lastMessage.dateTime));
  if (!currentChatSessionId && sessions.length > 0) {
    currentChatSessionId = sessions[0].sessionId;
  }

  if (sessionList) {
    if (sessions.length === 0) {
      sessionList.innerHTML = `
        <div class="text-center py-16 text-slate-400">
          <i class="fa-solid fa-comments text-4xl mb-3"></i>
          <p class="text-sm">ยังไม่มีการสนทนากับนักเรียนในระบบ</p>
        </div>
      `;
    } else {
      sessionList.innerHTML = sessions.map(session => {
        const activeClass = session.sessionId === currentChatSessionId ? "bg-slate-900 text-white" : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700";
        return `
          <button type="button" onclick="selectAdminChatSession('${session.sessionId}')" class="w-full text-left rounded-2xl p-3 ${activeClass} transition duration-150">
            <div class="font-semibold text-sm">${session.studentName}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">${session.lastMessage.senderRole === 'student' ? 'นักเรียน' : 'แอดมิน'}: ${session.lastMessage.text.slice(0, 36)}${session.lastMessage.text.length > 36 ? '...' : ''}</div>
          </button>
        `;
      }).join("");
    }
  }

  if (caption) {
    caption.textContent = sessions.length > 0 ? `สนทนากับ ${sessions.find(s => s.sessionId === currentChatSessionId)?.studentName || 'นักเรียน'}` : "เลือกหัวข้อสนทนาจากด้านซ้าย";
  }

  if (chatContainer) {
    if (sessions.length === 0) {
      chatContainer.innerHTML = "";
    } else {
      const messages = chatData.filter(msg => msg.sessionId === currentChatSessionId);
      if (messages.length === 0) {
        chatContainer.innerHTML = `
          <div class="text-center py-16 text-slate-400">
            <p class="text-sm">ยังไม่มีข้อความในการสนทนานี้</p>
          </div>
        `;
      } else {
        chatContainer.innerHTML = messages.map(msg => {
          const isAdmin = msg.senderRole === "admin";
          const bubbleClass = isAdmin ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100";
          const labelClass = isAdmin ? "text-emerald-100" : "text-slate-500 dark:text-slate-400";
          const timeLabel = msg.dateTime ? `${formatThaiDate(msg.dateTime.split("T")[0])} ${msg.dateTime.split("T")[1] || ""}` : "";
          const attachmentsHtml = formatChatAttachmentsHtml(msg.attachments || [], isAdmin);
          return `
            <div class="flex ${isAdmin ? "justify-end" : "justify-start"}">
              <div class="max-w-[80%] rounded-3xl p-4 shadow-sm ${bubbleClass}">
                <div class="text-[11px] font-semibold mb-2 ${labelClass}">${msg.senderName}</div>
                <div class="text-sm leading-relaxed break-words">${msg.text || ""}</div>
                ${attachmentsHtml}
                <div class="mt-2 text-[10px] opacity-80 ${labelClass}">${timeLabel}</div>
              </div>
            </div>
          `;
        }).join("");
      }
      setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 50);
    }
  }
}

function selectAdminChatSession(sessionId) {
  currentChatSessionId = sessionId;
  adminChatAttachments = [];
  renderAdminChat();
  renderChatAttachmentPreviews('admin');
}

function renderChatAttachmentPreviews(role) {
  const container = getEl(`${role}-chat-attachments`);
  const attachments = role === 'admin' ? adminChatAttachments : studentChatAttachments;
  if (!container) return;
  if (!attachments.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = attachments.map((item, index) => `
    <div class="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-28">
      <img src="${item.dataUrl}" alt="${item.name}" class="w-full h-20 object-cover">
      <div class="p-2 text-[10px] text-slate-500 dark:text-slate-400 truncate">${item.name}</div>
    </div>
  `).join("");
}

function handleChatFileChange(role) {
  const input = getEl(`${role}-chat-file-input`);
  if (!input || !input.files?.length) return;

  const targetAttachments = role === 'admin' ? adminChatAttachments : studentChatAttachments;
  const files = Array.from(input.files);
  files.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      targetAttachments.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        type: file.type,
        dataUrl: reader.result
      });
      renderChatAttachmentPreviews(role);
    };
    reader.readAsDataURL(file);
  });
  input.value = "";
}

function normalizeTextForProfanity(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function filterProfanity(text) {
  let cleaned = text;
  const normalized = normalizeTextForProfanity(text);

  PROFANITY_WORDS.forEach(word => {
    const pattern = new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "gi");
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, "***");
    }
  });

  return cleaned;
}

function sanitizeChatText(text) {
  if (!text) return "";
  const filtered = filterProfanity(text);
  if (filtered !== text) {
    alert("พบคำไม่เหมาะสมในข้อความ ระบบจะแปลงคำหยาบออกก่อนส่ง");
  }
  return filtered;
}

function sendStudentChat() {
  const input = getEl("student-chat-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text && studentChatAttachments.length === 0) return;

  const now = new Date();
  const message = {
    id: `chat-${Date.now()}`,
    sessionId: currentChatSessionId || currentUser.id,
    senderRole: "student",
    senderName: currentUser.name,
    text: sanitizeChatText(text),
    attachments: studentChatAttachments.map(att => ({ ...att })),
    dateTime: `${now.toISOString().slice(0, 16)}`
  };

  const chatList = window.StudentCouncilDB.getChat();
  chatList.push(message);
  window.StudentCouncilDB.saveChat(chatList);
  syncChatToServer();

  input.value = "";
  studentChatAttachments = [];
  renderChatAttachmentPreviews('student');
  renderStudentChat();
}

function sendAdminChat() {
  const input = getEl("admin-chat-input");
  if (!input || !currentChatSessionId) return;
  const text = input.value.trim();
  if (!text && adminChatAttachments.length === 0) return;

  const now = new Date();
  const message = {
    id: `chat-${Date.now()}`,
    sessionId: currentChatSessionId,
    senderRole: "admin",
    senderName: currentUser ? currentUser.name : "ผู้ดูแลระบบ",
    text: sanitizeChatText(text),
    attachments: adminChatAttachments.map(att => ({ ...att })),
    dateTime: `${now.toISOString().slice(0, 16)}`
  };

  const chatList = window.StudentCouncilDB.getChat();
  chatList.push(message);
  window.StudentCouncilDB.saveChat(chatList);
  syncChatToServer();

  input.value = "";
  adminChatAttachments = [];
  renderChatAttachmentPreviews('admin');
  renderAdminChat();
}

// ==================== PUBLIC VIEW RENDERERS ====================

// 1. หน้าแสดงผลงานสภานักเรียน
function renderPublicAchievements() {
  const container = getEl("pub-achievements-grid");
  const list = window.StudentCouncilDB.getAchievements();

  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-16 text-slate-400">
        <i class="fa-solid fa-trophy text-4xl mb-3 block"></i>
        <span>ยังไม่มีการอัปโหลดบันทึกผลงานในระบบ</span>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(ach => `
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-premium overflow-hidden flex flex-col h-full">
      <div class="h-44 bg-slate-200 dark:bg-slate-900 relative">
        <img src="${ach.image}" class="w-full h-full object-cover" alt="achievement cover">
        <span class="absolute top-3 right-3 px-2 py-1 bg-slate-900/60 text-white text-[10px] rounded backdrop-blur-sm font-english">${formatThaiDate(ach.date)}</span>
      </div>
      <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h4 class="font-bold text-sm text-slate-800 dark:text-white leading-snug">${ach.title}</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">${ach.description}</p>
        </div>
        <div class="pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
          <span>ผู้รับผิดชอบหลัก:</span>
          <span class="font-semibold text-slate-600 dark:text-slate-300 flex items-center">
            <i class="fa-solid fa-user-tie mr-1 text-blue-500"></i>${ach.responsible}
          </span>
        </div>
      </div>
    </div>
  `).join("");
}

// 2. หน้าแสดงสถิติกราฟฝั่งบุคคลทั่วไป
function renderPublicCharts() {
  const reports = window.StudentCouncilDB.getReports();
  
  const total = reports.length;
  const completed = reports.filter(r => r.status === "completed").length;
  const processing = reports.filter(r => r.status === "processing").length;
  const failed = reports.filter(r => r.status === "failed").length;
  const pending = reports.filter(r => r.status === "pending").length;

  // อัปเดตตัวเลขสถิติ
  setText("pub-stat-total", total);
  setText("pub-stat-completed", completed);
  setText("pub-stat-processing", processing);
  setText("pub-stat-failed", failed);

  // คำนวณเปอร์เซ็นต์ความสำเร็จ (เสร็จสิ้น / (เสร็จสิ้น + ไม่สามารถทำได้))
  const resolvedCount = completed + failed;
  const successPercent = resolvedCount > 0 ? Math.round((completed / resolvedCount) * 100) : 0;
  
  setText("pub-success-percent", `${successPercent}%`);
  setText("pub-success-count", `${completed} เรื่อง`);
  setText("pub-failed-count", `${failed} เรื่อง`);

  destroyChart("pubSuccessChart");
  destroyChart("pubCategoryChart");

  const successCanvas = getEl("pubSuccessChart");
  const categoryCanvas = getEl("pubCategoryChart");
  if (!successCanvas || !categoryCanvas) return;

  const ctxSuccess = successCanvas.getContext("2d");
  charts["pubSuccessChart"] = new Chart(ctxSuccess, {
    type: "doughnut",
    data: {
      labels: ["เสร็จสิ้น", "ไม่สามารถทำได้", "รอดำเนินการ"],
      datasets: [{
        data: [completed, failed, pending + processing],
        backgroundColor: ["#10b981", "#ef4444", "#94a3b8"],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      cutout: "75%",
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      }
    }
  });

  // รวบรวมข้อมูลหมวดหมู่
  const categories = ["อาคารสถานที่", "ห้องน้ำ", "ไฟฟ้า", "อินเทอร์เน็ต", "ความสะอาด", "ความปลอดภัย", "อื่น ๆ"];
  const categoryCounts = categories.map(cat => reports.filter(r => r.category === cat).length);

  const ctxCategory = categoryCanvas.getContext("2d");
  charts["pubCategoryChart"] = new Chart(ctxCategory, {
    type: "bar",
    data: {
      labels: categories,
      datasets: [{
        label: "จำนวนปัญหาที่แจ้งเข้ามา",
        data: categoryCounts,
        backgroundColor: "rgba(59, 130, 246, 0.75)",
        borderColor: "#3b82f6",
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

// ==================== ADMIN VIEW RENDERERS ====================

// 1. หน้าสรุปภาพรวมแดชบอร์ดแอดมิน
function renderAdminDashboard() {
  const reports = window.StudentCouncilDB.getReports();
  const students = window.StudentCouncilDB.getStudents();

  const totalReports = reports.length;
  const completed = reports.filter(r => r.status === "completed").length;
  const processing = reports.filter(r => r.status === "processing").length;
  const pending = reports.filter(r => r.status === "pending").length;

  setText("admin-kpi-users", students.length);
  setText("admin-kpi-reports", totalReports);
  setText("admin-kpi-completed", completed);
  setText("admin-kpi-processing", processing);

  // แสดงกราฟฝั่งแอดมิน
  destroyChart("adminCategoryChart");
  destroyChart("adminMonthlyChart");

  const categories = ["อาคารสถานที่", "ห้องน้ำ", "ไฟฟ้า", "อินเทอร์เน็ต", "ความสะอาด", "ความปลอดภัย", "อื่น ๆ"];
  const categoryCounts = categories.map(cat => reports.filter(r => r.category === cat).length);

  const adminCategoryCanvas = getEl("adminCategoryChart");
  const adminMonthlyCanvas = getEl("adminMonthlyChart");
  if (!adminCategoryCanvas || !adminMonthlyCanvas) return;

  const ctxCat = adminCategoryCanvas.getContext("2d");
  charts["adminCategoryChart"] = new Chart(ctxCat, {
    type: "doughnut",
    data: {
      labels: categories,
      datasets: [{
        data: categoryCounts,
        backgroundColor: [
          "#3b82f6", "#06b6d4", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#64748b"
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 12, font: { size: 10 } }
        }
      }
    }
  });

  // กราฟรายเดือนสมมุติย้อนหลัง 5 เดือน + เดือนนี้
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย."];
  // กระจายตัวเลขจำลองตามประวัติ
  const monthlyCounts = [4, 7, 10, 5, 8, totalReports];

  const ctxMonth = adminMonthlyCanvas.getContext("2d");
  charts["adminMonthlyChart"] = new Chart(ctxMonth, {
    type: "line",
    data: {
      labels: months,
      datasets: [{
        label: "จำนวนเคสที่ได้รับแจ้ง",
        data: monthlyCounts,
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.15)",
        fill: true,
        tension: 0.3,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 2 } }
      }
    }
  });

  // โหลดเรื่องที่รายงานล่าช้าตาราง (แสดง 5 เรื่องล่าสุด)
  const table = getEl("admin-recent-reports-table");
  const recentList = reports.slice(0, 5);

  if (!table) return;

  if (recentList.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-6 text-slate-400">ยังไม่มีปัญหาถูกรายงานเข้ามาในขณะนี้</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = recentList.map(rep => {
    let badgeClass = "";
    let badgeText = "";
    if (rep.status === "pending") { badgeClass = "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"; badgeText = "รอรับเรื่อง"; }
    else if (rep.status === "processing") { badgeClass = "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"; badgeText = "กำลังทำ"; }
    else if (rep.status === "completed") { badgeClass = "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"; badgeText = "เสร็จแล้ว"; }
    else { badgeClass = "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"; badgeText = "ปฏิเสธ"; }

    return `
      <tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
        <td class="py-3 font-semibold">${rep.title}</td>
        <td class="py-3">${rep.category}</td>
        <td class="py-3">${rep.studentName}</td>
        <td class="py-3 font-english">${rep.dateTime.replace("T", " ")}</td>
        <td class="py-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${badgeClass}">${badgeText}</span>
        </td>
        <td class="py-3 text-right">
          <button onclick="openReportDetailModal('${rep.id}', true)" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-[11px] font-semibold">
            จัดการ
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// 2. หน้าหลักผู้ดูแลระบบ: ตารางแสดงรายการปัญหาทั้งหมดพร้อมการกรอง
function renderAdminReports() {
  const reports = window.StudentCouncilDB.getReports();
  const filterStatus = document.getElementById("admin-report-filter-status").value;
  const filterCategory = document.getElementById("admin-report-filter-category").value;
  const searchQuery = document.getElementById("admin-report-search").value.toLowerCase();

  let filtered = reports;

  if (filterStatus !== "all") {
    filtered = filtered.filter(r => r.status === filterStatus);
  }
  if (filterCategory !== "all") {
    filtered = filtered.filter(r => r.category === filterCategory);
  }
  if (searchQuery) {
    filtered = filtered.filter(r => 
      r.title.toLowerCase().includes(searchQuery) ||
      r.studentName.toLowerCase().includes(searchQuery) ||
      r.location.toLowerCase().includes(searchQuery) ||
      r.id.toLowerCase().includes(searchQuery)
    );
  }

  const tableBody = document.getElementById("admin-all-reports-table");
  const emptyDiv = document.getElementById("admin-reports-empty");

  if (filtered.length === 0) {
    tableBody.innerHTML = "";
    emptyDiv.classList.remove("hidden");
    return;
  }
  emptyDiv.classList.add("hidden");

  tableBody.innerHTML = filtered.map(rep => {
    let badgeClass = "";
    let badgeText = "";
    if (rep.status === "pending") { badgeClass = "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"; badgeText = "รอรับเรื่อง"; }
    else if (rep.status === "processing") { badgeClass = "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"; badgeText = "กำลังดำเนินการ"; }
    else if (rep.status === "completed") { badgeClass = "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"; badgeText = "ดำเนินการแล้ว"; }
    else { badgeClass = "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"; badgeText = "ไม่สามารถทำได้"; }

    return `
      <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
        <td class="p-4">
          <p class="font-bold text-slate-700 dark:text-slate-200">${rep.studentName}</p>
          <span class="text-[10px] text-slate-400 font-english">${rep.classroom} (รหัส: ${rep.studentId})</span>
        </td>
        <td class="p-4">
          <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[11px] font-medium">${rep.category}</span>
        </td>
        <td class="p-4">
          <p class="font-bold text-slate-700 dark:text-slate-200">${rep.title}</p>
          <p class="text-[10px] text-slate-400 mt-0.5"><i class="fa-solid fa-location-dot mr-1"></i>${rep.location}</p>
        </td>
        <td class="p-4 text-slate-500 font-english">${rep.dateTime.replace("T", " ")}</td>
        <td class="p-4 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}">${badgeText}</span>
        </td>
        <td class="p-4 text-right">
          <button onclick="openReportDetailModal('${rep.id}', true)" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition">
            ดูและแก้ไข
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// 3. แผงจัดการจัดการข่าวสารของแอดมิน
function renderAdminNewsTable() {
  const newsList = window.StudentCouncilDB.getNews();
  const tableBody = document.getElementById("admin-news-table-body");

  if (newsList.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-8 text-slate-400">ยังไม่มีการเพิ่มข่าวประกาศในระบบ</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = newsList.map(news => `
    <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
      <td class="p-4">
        <img src="${news.image}" class="w-16 h-10 object-cover rounded border border-slate-200 dark:border-slate-700">
      </td>
      <td class="p-4 font-bold text-slate-700 dark:text-slate-200">${news.title}</td>
      <td class="p-4 font-english text-slate-500">${news.date}</td>
      <td class="p-4 text-slate-500 line-clamp-2 max-w-xs pt-6 leading-relaxed">${news.content}</td>
      <td class="p-4 text-right">
        <div class="flex justify-end space-x-2">
          <button onclick="openNewsModal('${news.id}')" class="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded transition"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteNewsItem('${news.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded transition"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join("");
}

// 4. แผงจัดการจัดการลิงก์สำคัญของแอดมิน
function renderAdminLinksTable() {
  const links = window.StudentCouncilDB.getLinks();
  const tableBody = document.getElementById("admin-links-table-body");

  if (links.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-8 text-slate-400">ยังไม่มีลิงก์เชื่อมโยงในระบบ</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = links.map(link => `
    <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
      <td class="p-4">
        <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded text-[10px] font-semibold">${link.category}</span>
      </td>
      <td class="p-4 font-bold text-slate-700 dark:text-slate-200">${link.title}</td>
      <td class="p-4 text-slate-400 truncate max-w-xs font-english">${link.url}</td>
      <td class="p-4 text-right">
        <div class="flex justify-end space-x-2">
          <button onclick="openLinkModal('${link.id}')" class="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteLinkItem('${link.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join("");
}

// 5. แผงจัดการสรุปผลงานสภานักเรียนของแอดมิน
function renderAdminAchievementsTable() {
  const achievements = window.StudentCouncilDB.getAchievements();
  const tableBody = document.getElementById("admin-achievements-table-body");

  if (achievements.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-8 text-slate-400">ยังไม่มีผลงานสภานักเรียนในขณะนี้</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = achievements.map(ach => `
    <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
      <td class="p-4">
        <img src="${ach.image}" class="w-16 h-10 object-cover rounded border border-slate-200 dark:border-slate-700">
      </td>
      <td class="p-4 font-bold text-slate-700 dark:text-slate-200">${ach.title}</td>
      <td class="p-4 text-slate-500">${ach.responsible}</td>
      <td class="p-4 font-english text-slate-500">${ach.date}</td>
      <td class="p-4 text-right">
        <div class="flex justify-end space-x-2">
          <button onclick="openAchievementModal('${ach.id}')" class="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteAchievementItem('${ach.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join("");
}

// ==================== MODALS CONTROL ====================

// 1. Modal ดูรายละเอียดข่าวสารของนักเรียน
function openStudentNewsModal(id) {
  const news = window.StudentCouncilDB.getNews().find(n => n.id === id);
  if (!news) return;

  document.getElementById("news-modal-image").src = news.image;
  document.getElementById("news-modal-date").textContent = formatThaiDate(news.date);
  document.getElementById("news-modal-title").textContent = news.title;
  document.getElementById("news-modal-content").textContent = news.content;

  document.getElementById("student-news-modal").classList.remove("hidden");
}

function closeStudentNewsModal() {
  document.getElementById("student-news-modal").classList.add("hidden");
}

// 2. Modal ดูรายละเอียดเคสร้องเรียนปัญหา (ใช้ได้ทั้ง นักเรียน และ แอดมิน)
function openReportDetailModal(id, isAdminMode = false) {
  const rep = window.StudentCouncilDB.getReports().find(r => r.id === id);
  if (!rep) return;

  currentEditingReportId = id;

  // กำหนด badge สถานะ
  const badge = document.getElementById("report-detail-badge");
  let statusText = "";
  let badgeStyle = "";
  switch (rep.status) {
    case "pending": statusText = "รอรับเรื่อง"; badgeStyle = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"; break;
    case "processing": statusText = "กำลังดำเนินการ"; badgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"; break;
    case "completed": statusText = "ดำเนินการแล้ว"; badgeStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"; break;
    case "failed": statusText = "ไม่สามารถดำเนินการได้"; badgeStyle = "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300"; break;
  }
  badge.textContent = statusText;
  badge.className = `px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${badgeStyle}`;

  document.getElementById("report-detail-title").textContent = rep.title;
  document.getElementById("report-detail-reporter").textContent = rep.studentName;
  document.getElementById("report-detail-classroom").textContent = rep.classroom;
  document.getElementById("report-detail-category").textContent = rep.category;
  document.getElementById("report-detail-location").textContent = rep.location;
  document.getElementById("report-detail-datetime").textContent = rep.dateTime.replace("T", " ");
  document.getElementById("report-detail-desc").textContent = rep.description || "ไม่มีรายละเอียดเพิ่มเติม";

  // แนบรูปภาพประกอบในรายละเอียด
  const photoContainer = document.getElementById("report-detail-photos");
  if (rep.images && rep.images.length > 0) {
    photoContainer.innerHTML = rep.images.map(img => `
      <a href="${img}" target="_blank" class="h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 hover:opacity-90 transition block">
        <img src="${img}" class="w-full h-full object-cover">
      </a>
    `).join("");
  } else {
    photoContainer.innerHTML = `<span class="text-xs text-slate-400 font-medium italic">ไม่มีรูปภาพประกอบ</span>`;
  }

  // อัปเดต บันทึกการแก้ไข
  document.getElementById("report-detail-resdate").textContent = rep.resolvedDate ? formatThaiDate(rep.resolvedDate) : "-";
  document.getElementById("report-detail-notes").textContent = rep.adminNotes || "ไม่มีบันทึกข้อความถึงนักเรียน";

  // แสดง/ซ่อน เมนูดำเนินการของ แอดมิน
  const adminSection = document.getElementById("admin-actions-section");
  const saveBtn = document.getElementById("admin-save-report-btn");

  if (isAdminMode && currentRole === "admin") {
    adminSection.classList.remove("hidden");
    saveBtn.classList.remove("hidden");

    // ตั้งค่าฟิลด์ฟอร์มแอดมิน
    document.getElementById("admin-action-status").value = rep.status;
    document.getElementById("admin-action-resdate").value = rep.resolvedDate || "";
    document.getElementById("admin-action-notes").value = rep.adminNotes || "";
  } else {
    adminSection.classList.add("hidden");
    saveBtn.classList.add("hidden");
  }

  document.getElementById("report-detail-modal").classList.remove("hidden");
}

function closeReportDetailModal() {
  document.getElementById("report-detail-modal").classList.add("hidden");
  currentEditingReportId = null;
}

function saveReportFromAdmin() {
  if (!currentEditingReportId) return;

  const reports = window.StudentCouncilDB.getReports();
  const reportIndex = reports.findIndex(r => r.id === currentEditingReportId);
  if (reportIndex === -1) return;

  const status = document.getElementById("admin-action-status").value;
  const resdate = document.getElementById("admin-action-resdate").value;
  const notes = document.getElementById("admin-action-notes").value.trim();

  // อัปเดตค่า
  reports[reportIndex].status = status;
  reports[reportIndex].resolvedDate = resdate;
  reports[reportIndex].adminNotes = notes;

  window.StudentCouncilDB.saveReports(reports);

  showLoading(() => {
    closeReportDetailModal();
    alert("บันทึกการแก้ไขข้อมูลและการเปลี่ยนสถานะสำเร็จแล้ว!");
    renderAdminReports();
  });
}

// 3. Modals สำหรับแอดมินจัดพิมพ์จัดการ ข่าวสาร
function openNewsModal(id = "") {
  const form = document.getElementById("form-news-editor");
  form.reset();

  const titleEl = document.getElementById("news-editor-title");
  const preview = document.getElementById("news-editor-img-preview");
  preview.classList.add("hidden");
  uploadedNewsImage = "";

  if (id) {
    titleEl.textContent = "แก้ไขข่าวสารประชาสัมพันธ์";
    const news = window.StudentCouncilDB.getNews().find(n => n.id === id);
    if (news) {
      document.getElementById("news-editor-id").value = news.id;
      document.getElementById("news-editor-headline").value = news.title;
      document.getElementById("news-editor-date").value = news.date;
      document.getElementById("news-editor-content").value = news.content;
      document.getElementById("news-editor-img-url").value = news.image;
      
      if (news.image) {
        document.getElementById("news-preview-element").src = news.image;
        preview.classList.remove("hidden");
      }
    }
  } else {
    titleEl.textContent = "เพิ่มข่าวประชาสัมพันธ์ชิ้นใหม่";
    document.getElementById("news-editor-id").value = "";
    document.getElementById("news-editor-date").value = new Date().toISOString().split("T")[0];
  }

  document.getElementById("admin-news-modal").classList.remove("hidden");
}

function closeNewsModal() {
  document.getElementById("admin-news-modal").classList.add("hidden");
}

function saveNewsItem() {
  const id = document.getElementById("news-editor-id").value;
  const title = document.getElementById("news-editor-headline").value.trim();
  const date = document.getElementById("news-editor-date").value;
  const content = document.getElementById("news-editor-content").value.trim();
  let image = document.getElementById("news-editor-img-url").value.trim();

  if (uploadedNewsImage) {
    image = uploadedNewsImage;
  }
  if (!image) {
    image = "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80"; // ค่ารูปเริ่มต้น
  }

  const newsList = window.StudentCouncilDB.getNews();

  if (id) {
    // แก้ไข
    const idx = newsList.findIndex(n => n.id === id);
    if (idx !== -1) {
      newsList[idx] = { id, title, date, content, image };
    }
  } else {
    // เพิ่มใหม่
    newsList.unshift({
      id: `news-${Date.now()}`,
      title,
      date,
      content,
      image
    });
  }

  window.StudentCouncilDB.saveNews(newsList);
  showLoading(() => {
    closeNewsModal();
    renderAdminNewsTable();
  });
}

function deleteNewsItem(id) {
  if (confirm("คุณต้องการลบข่าวประชาสัมพันธ์นี้ใช่หรือไม่?")) {
    const newsList = window.StudentCouncilDB.getNews().filter(n => n.id !== id);
    window.StudentCouncilDB.saveNews(newsList);
    renderAdminNewsTable();
  }
}

// 4. Modals สำหรับแอดมินจัดการ ลิงก์เชื่อมโยง
function openLinkModal(id = "") {
  const form = document.getElementById("form-link-editor");
  form.reset();

  const titleEl = document.getElementById("link-editor-title");

  if (id) {
    titleEl.textContent = "แก้ไขลิงก์สำคัญ";
    const link = window.StudentCouncilDB.getLinks().find(l => l.id === id);
    if (link) {
      document.getElementById("link-editor-id").value = link.id;
      document.getElementById("link-editor-category").value = link.category;
      document.getElementById("link-editor-name").value = link.title;
      document.getElementById("link-editor-url").value = link.url;
    }
  } else {
    titleEl.textContent = "เพิ่มลิงก์สำคัญเข้าระบบ";
    document.getElementById("link-editor-id").value = "";
  }

  document.getElementById("admin-link-modal").classList.remove("hidden");
}

function closeLinkModal() {
  document.getElementById("admin-link-modal").classList.add("hidden");
}

function saveLinkItem() {
  const id = document.getElementById("link-editor-id").value;
  const category = document.getElementById("link-editor-category").value;
  const title = document.getElementById("link-editor-name").value.trim();
  const url = document.getElementById("link-editor-url").value.trim();

  const links = window.StudentCouncilDB.getLinks();

  if (id) {
    const idx = links.findIndex(l => l.id === id);
    if (idx !== -1) {
      links[idx] = { id, category, title, url };
    }
  } else {
    links.push({
      id: `link-${Date.now()}`,
      category,
      title,
      url
    });
  }

  window.StudentCouncilDB.saveLinks(links);
  showLoading(() => {
    closeLinkModal();
    renderAdminLinksTable();
  });
}

function deleteLinkItem(id) {
  if (confirm("คุณแน่ใจว่าต้องการลบลิงก์เชื่อมโยงนี้?")) {
    const links = window.StudentCouncilDB.getLinks().filter(l => l.id !== id);
    window.StudentCouncilDB.saveLinks(links);
    renderAdminLinksTable();
  }
}

// 5. Modals สำหรับแอดมินจัดการ บันทึกผลงานสภานักเรียน
function openAchievementModal(id = "") {
  const form = document.getElementById("form-achievement-editor");
  form.reset();

  const titleEl = document.getElementById("achievement-editor-title");
  const preview = document.getElementById("achievement-editor-img-preview");
  preview.classList.add("hidden");
  uploadedAchievementImage = "";

  if (id) {
    titleEl.textContent = "แก้ไขบันทึกผลงานสภานักเรียน";
    const ach = window.StudentCouncilDB.getAchievements().find(a => a.id === id);
    if (ach) {
      document.getElementById("achievement-editor-id").value = ach.id;
      document.getElementById("achievement-editor-headline").value = ach.title;
      document.getElementById("achievement-editor-date").value = ach.date;
      document.getElementById("achievement-editor-responsible").value = ach.responsible;
      document.getElementById("achievement-editor-content").value = ach.description;
      document.getElementById("achievement-editor-img-url").value = ach.image;

      if (ach.image) {
        document.getElementById("achievement-preview-element").src = ach.image;
        preview.classList.remove("hidden");
      }
    }
  } else {
    titleEl.textContent = "เพิ่มบันทึกผลงานสภานักเรียนชิ้นใหม่";
    document.getElementById("achievement-editor-id").value = "";
    document.getElementById("achievement-editor-date").value = new Date().toISOString().split("T")[0];
  }

  document.getElementById("admin-achievement-modal").classList.remove("hidden");
}

function closeAchievementModal() {
  document.getElementById("admin-achievement-modal").classList.add("hidden");
}

function saveAchievementItem() {
  const id = document.getElementById("achievement-editor-id").value;
  const title = document.getElementById("achievement-editor-headline").value.trim();
  const date = document.getElementById("achievement-editor-date").value;
  const responsible = document.getElementById("achievement-editor-responsible").value.trim();
  const description = document.getElementById("achievement-editor-content").value.trim();
  let image = document.getElementById("achievement-editor-img-url").value.trim();

  if (uploadedAchievementImage) {
    image = uploadedAchievementImage;
  }
  if (!image) {
    image = "https://images.unsplash.com/photo-1618477388954-7852f32655ec?auto=format&fit=crop&w=800&q=80"; // ค่าภาพผลงานเริ่มต้น
  }

  const list = window.StudentCouncilDB.getAchievements();

  if (id) {
    const idx = list.findIndex(a => a.id === id);
    if (idx !== -1) {
      list[idx] = { id, title, date, responsible, description, image };
    }
  } else {
    list.unshift({
      id: `ach-${Date.now()}`,
      title,
      date,
      responsible,
      description,
      image
    });
  }

  window.StudentCouncilDB.saveAchievements(list);
  showLoading(() => {
    closeAchievementModal();
    renderAdminAchievementsTable();
  });
}

function deleteAchievementItem(id) {
  if (confirm("ต้องการลบบันทึกผลงานข้อนี้ออกจากระบบ?")) {
    const list = window.StudentCouncilDB.getAchievements().filter(a => a.id !== id);
    window.StudentCouncilDB.saveAchievements(list);
    renderAdminAchievementsTable();
  }
}

// ==================== FILE UPLOAD HANDLERS ====================
function setupFileUploadListeners() {
  // 1. อัปโหลดในหน้าฟอร์มแจ้งปัญหา (มี Drag & Drop และหลายไฟล์)
  const dragArea = document.getElementById("image-drag-area");
  const fileInput = document.getElementById("report-images-input");

  if (dragArea && fileInput) {
    dragArea.addEventListener("click", () => fileInput.click());

    dragArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      dragArea.classList.add("dragover");
    });

    ["dragleave", "drop"].forEach(event => {
      dragArea.addEventListener(event, () => dragArea.classList.remove("dragover"));
    });

    dragArea.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        handleFiles(fileInput.files);
      }
    });
  }

  // 2. ไฟล์ปกข่าวประกาศ
  const newsImgInput = document.getElementById("news-editor-img-file");
  if (newsImgInput) {
    newsImgInput.addEventListener("change", () => {
      if (newsImgInput.files.length > 0) {
        getBase64(newsImgInput.files[0], (base64) => {
          uploadedNewsImage = base64;
          document.getElementById("news-preview-element").src = base64;
          document.getElementById("news-editor-img-preview").classList.remove("hidden");
        });
      }
    });
  }

  // 3. ไฟล์รูปประกอบผลงานสภาฯ
  const achImgInput = document.getElementById("achievement-editor-img-file");
  if (achImgInput) {
    achImgInput.addEventListener("change", () => {
      if (achImgInput.files.length > 0) {
        getBase64(achImgInput.files[0], (base64) => {
          uploadedAchievementImage = base64;
          document.getElementById("achievement-preview-element").src = base64;
          document.getElementById("achievement-editor-img-preview").classList.remove("hidden");
        });
      }
    });
  }

  // 4. ไฟล์รูปภาพของหายได้คืน
  const lfImgInput = document.getElementById("lf-image-input");
  const lfDragArea = document.getElementById("lf-drag-area");
  if (lfImgInput && lfDragArea) {
    lfDragArea.addEventListener("click", () => lfImgInput.click());
    lfDragArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      lfDragArea.classList.add("bg-slate-100", "dark:bg-slate-700");
    });
    ["dragleave", "drop"].forEach(event => {
      lfDragArea.addEventListener(event, () => lfDragArea.classList.remove("bg-slate-100", "dark:bg-slate-700"));
    });
    lfDragArea.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        getBase64(e.dataTransfer.files[0], (base64) => {
          uploadedLostFoundImage = base64;
          document.getElementById("lf-image-preview").src = base64;
          document.getElementById("lf-image-preview-container").classList.remove("hidden");
        });
      }
    });
    lfImgInput.addEventListener("change", () => {
      if (lfImgInput.files.length > 0) {
        getBase64(lfImgInput.files[0], (base64) => {
          uploadedLostFoundImage = base64;
          document.getElementById("lf-image-preview").src = base64;
          document.getElementById("lf-image-preview-container").classList.remove("hidden");
        });
      }
    });
  }
}

function handleFiles(files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith("image/")) return;

    getBase64(file, (base64Str) => {
      uploadedReportImages.push(base64Str);
      renderUploadedPreviews();
    });
  });
}

function renderUploadedPreviews() {
  const container = document.getElementById("image-previews");
  if (!container) return;

  if (uploadedReportImages.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = uploadedReportImages.map((img, idx) => `
    <div class="relative h-16 w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100">
      <img src="${img}" class="w-full h-full object-cover">
      <button type="button" onclick="removeUploadedReportImage(${idx})" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center text-[10px] shadow">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `).join("");
}

function removeUploadedReportImage(index) {
  uploadedReportImages.splice(index, 1);
  renderUploadedPreviews();
}

// ==================== HELPER UTILITIES ====================
function getBase64(file, callback) {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => callback(reader.result);
  reader.onerror = error => console.error("Error reading file", error);
}

function formatThaiDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  
  const year = parseInt(parts[0]) + 543; // แปลง ค.ศ. เป็น พ.ศ.
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", 
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  const month = months[parseInt(parts[1]) - 1];
  const day = parseInt(parts[2]);
  
  return `${day} ${month} ${year}`;
}

function showLoading(callback) {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.classList.remove("hidden");
    setTimeout(() => {
      overlay.classList.add("hidden");
      if (callback) callback();
    }, 600);
  } else {
    if (callback) callback();
  }
}

function destroyChart(chartId) {
  if (charts[chartId]) {
    charts[chartId].destroy();
    delete charts[chartId];
  }
}

// Dark Mode Toggle
function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle("dark");
  if (isDark) {
    localStorage.setItem("sc_dark_mode", "enabled");
    updateThemeUI(true);
  } else {
    localStorage.setItem("sc_dark_mode", "disabled");
    updateThemeUI(false);
  }
}

function updateThemeUI(isDark) {
  const icon = document.getElementById("theme-icon");
  const text = document.getElementById("theme-text");
  
  if (isDark) {
    if (icon) icon.className = "fa-solid fa-sun text-yellow-400";
    if (text) text.textContent = "โหมดสว่าง";
  } else {
    if (icon) icon.className = "fa-solid fa-moon text-blue-500";
    if (text) text.textContent = "โหมดมืด";
  }
}

// Mobile Navigation Drawer Toggle
function toggleSidebar() {
  const sidebar = getEl("sidebar");
  const overlay = getEl("sidebar-overlay");

  if (!sidebar || !overlay) return;

  const isOpen = !sidebar.classList.contains("-translate-x-full");
  sidebar.classList.toggle("-translate-x-full");
  overlay.classList.toggle("hidden");

  requestFrame(() => {
    if (isOpen) {
      sidebar.classList.add("-translate-x-full");
      overlay.classList.add("hidden");
    }
  });
}

// ==================== SONG REQUESTS LOGIC ====================

// 1. ฟังก์ชันส่งคำขอเปิดเพลง (นักเรียน)
function submitSongRequest() {
  const title = document.getElementById("song-title").value.trim();
  const artist = document.getElementById("song-artist").value.trim();
  const url = document.getElementById("song-url").value.trim();
  const message = document.getElementById("song-message").value.trim();

  if (!title || !artist) {
    alert("กรุณากรอกข้อมูลชื่อเพลงและศิลปิน");
    return;
  }

  const songs = window.StudentCouncilDB.getSongs();
  const newSong = {
    id: `song-${Date.now()}`,
    songTitle: title,
    artist,
    songUrl: url,
    message,
    requestDate: new Date().toISOString().split("T")[0],
    status: "pending",
    adminFeedback: "",
    studentName: currentUser.name,
    studentId: currentUser.id,
    studentClass: currentUser.class
  };

  songs.unshift(newSong);
  window.StudentCouncilDB.saveSongs(songs);

  showLoading(() => {
    alert("ส่งคำขอเปิดเพลงไปยังดีเจสภานักเรียนเรียบร้อยแล้ว! รอลุ้นในคาบพักครั้งถัดไปได้เลย");
    document.getElementById("form-request-song").reset();
    renderStudentSongs();
  });
}

// 2. ฟังก์ชันแสดงคิวขอเพลงทั้งหมด (นักเรียน) - แยกแสดงตามวัน
function renderStudentSongs() {
  const container = document.getElementById("student-songs-list");
  const songs = window.StudentCouncilDB.getSongs();

  document.getElementById("student-songs-count").textContent = songs.length;

  if (songs.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-premium">
        <i class="fa-solid fa-music text-3xl text-slate-300 dark:text-slate-600 mb-2 block"></i>
        <span class="text-slate-400 text-xs">ยังไม่มีเพื่อนๆ ส่งคำขอเพลงในระบบ</span>
      </div>
    `;
    return;
  }

  // จัดกลุ่มเพลงตามวันที่ขอเพลง
  const groupedSongs = {};
  songs.forEach(song => {
    const date = song.requestDate;
    if (!groupedSongs[date]) {
      groupedSongs[date] = [];
    }
    groupedSongs[date].push(song);
  });

  // เรียงลำดับวันที่จากใหม่สุดไปเก่าสุด
  const sortedDates = Object.keys(groupedSongs).sort((a, b) => new Date(b) - new Date(a));

  // ตั้งค่าเริ่มต้นการพับ: วันล่าสุดเปิดเสมอ วันอื่นพับไว้
  if (Object.keys(collapsedDates).length === 0 && sortedDates.length > 0) {
    collapsedDates[sortedDates[0]] = false;
    for (let i = 1; i < sortedDates.length; i++) {
      collapsedDates[sortedDates[i]] = true;
    }
  }

  container.innerHTML = sortedDates.map(date => {
    const dateSongs = groupedSongs[date];
    const isCollapsed = collapsedDates[date] === true;

    const dateHeader = `
      <div class="pt-4 pb-1">
        <button onclick="toggleDateCollapse('${date}')" class="text-xs font-bold text-slate-500 bg-slate-200/60 dark:bg-slate-700/50 px-3 py-1.5 rounded-full flex items-center w-fit border border-slate-300/40 dark:border-slate-600/30 hover:bg-slate-300 dark:hover:bg-slate-600 transition focus:outline-none">
          <i class="fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'} mr-1.5 text-[9px] w-3"></i>
          <i class="fa-regular fa-calendar-days mr-1.5 font-english"></i> คำขอประจำวันที่ ${formatThaiDate(date)}
          <span class="text-[10px] text-slate-400 font-normal ml-2">(${dateSongs.length} เพลง)</span>
        </button>
      </div>
    `;

    const songCardsHtml = dateSongs.map(song => {
      let badgeClass = "";
      let badgeText = "";
      let badgeIcon = "";

      switch (song.status) {
        case "pending":
          badgeClass = "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-900/30";
          badgeText = "รอคิว (Pending)";
          badgeIcon = "fa-solid fa-clock";
          break;
        case "approved":
          badgeClass = "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30";
          badgeText = "เตรียมเปิด (Approved)";
          badgeIcon = "fa-solid fa-circle-play";
          break;
        case "played":
          badgeClass = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30";
          badgeText = "เปิดแล้ว (Played)";
          badgeIcon = "fa-solid fa-circle-check";
          break;
        case "rejected":
          badgeClass = "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30";
          badgeText = "ไม่ผ่านการคัดเลือก (Rejected)";
          badgeIcon = "fa-solid fa-circle-xmark";
          break;
      }

      const hasFeedback = song.adminFeedback && song.adminFeedback.trim().length > 0;
      const hasUrl = song.songUrl && song.songUrl.trim().length > 0;

      return `
        <div class="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div class="space-y-1.5 flex-1 min-w-0">
            <div class="flex items-center space-x-2 flex-wrap gap-y-1">
              <span class="text-[10px] px-2.5 py-0.5 ${badgeClass} rounded-full font-semibold flex items-center gap-1.5">
                <i class="${badgeIcon} text-[9px]"></i>${badgeText}
              </span>
              <span class="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded font-english truncate max-w-[120px]">${song.studentName}</span>
            </div>
            <h4 class="font-bold text-sm text-slate-800 dark:text-white leading-snug flex items-center gap-2">
              <span><i class="fa-solid fa-music text-slate-400"></i> ${song.songTitle}</span>
              <span class="text-xs text-slate-400 font-medium font-normal">- ${song.artist}</span>
            </h4>
            ${song.message ? `<p class="text-xs text-slate-500 dark:text-slate-400 font-light italic leading-relaxed truncate">"ฝากข้อความ: ${song.message}"</p>` : ""}
            
            ${hasFeedback ? `
              <div class="mt-2 p-2 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                <span class="font-bold"><i class="fa-solid fa-comment-dots mr-1"></i>ดีเจสภาฯ ตอบกลับ:</span> ${song.adminFeedback}
              </div>
            ` : ""}
          </div>
          
          ${hasUrl ? `
            <a href="${song.songUrl}" target="_blank" class="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shrink-0 self-end md:self-center">
              <i class="fa-brands fa-youtube text-sm"></i>
              <span>ฟังเพลง</span>
            </a>
          ` : ""}
        </div>
      `;
    }).join("");

    return dateHeader + `<div class="${isCollapsed ? 'hidden' : 'space-y-4 mt-2 mb-6'}">${songCardsHtml}</div>`;
  }).join("");
}

// 3. ฟังก์ชันแสดงรายการขอเปิดเพลงตาราง (แอดมิน) - แยกตารางตามวัน
function renderAdminSongs() {
  const songs = window.StudentCouncilDB.getSongs();
  const searchQuery = document.getElementById("admin-song-search").value.toLowerCase();
  const filterStatus = document.getElementById("admin-song-filter-status") ? document.getElementById("admin-song-filter-status").value : "all";
  const filterDate = document.getElementById("admin-song-filter-date") ? document.getElementById("admin-song-filter-date").value : "all";

  // 1. อัปเดตตัวเลือกวันที่ใน Dropdown
  const uniqueDates = [...new Set(songs.map(s => s.requestDate))].sort((a, b) => new Date(b) - new Date(a));
  const dateSelect = document.getElementById("admin-song-filter-date");
  if (dateSelect) {
    const currentValue = dateSelect.value;
    const existingOptionsCount = dateSelect.options.length;
    const existingDates = [];
    for (let i = 1; i < existingOptionsCount; i++) {
      existingDates.push(dateSelect.options[i].value);
    }
    const datesMatch = JSON.stringify(existingDates) === JSON.stringify(uniqueDates);
    
    if (!datesMatch) {
      let optionsHtml = '<option value="all">วันที่ส่งคำขอทั้งหมด</option>';
      uniqueDates.forEach(d => {
        optionsHtml += `<option value="${d}">${formatThaiDate(d)}</option>`;
      });
      dateSelect.innerHTML = optionsHtml;
      
      if (uniqueDates.includes(currentValue) || currentValue === 'all') {
        dateSelect.value = currentValue;
      } else {
        dateSelect.value = 'all';
      }
    }
  }

  // 2. คัดกรองรายการเพลง
  let filtered = songs;
  if (filterStatus !== "all") {
    filtered = filtered.filter(s => s.status === filterStatus);
  }
  if (filterDate !== "all") {
    filtered = filtered.filter(s => s.requestDate === filterDate);
  }
  if (searchQuery) {
    filtered = filtered.filter(s => 
      s.songTitle.toLowerCase().includes(searchQuery) ||
      s.artist.toLowerCase().includes(searchQuery) ||
      s.studentName.toLowerCase().includes(searchQuery)
    );
  }

  const tableBody = document.getElementById("admin-songs-table-body");
  const emptyDiv = document.getElementById("admin-songs-empty");

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-12 text-slate-400">
          <i class="fa-solid fa-radio text-3xl mb-2 block font-normal"></i>
          <span class="block">ไม่พบคำขอเพลงตามเงื่อนไขที่เลือก</span>
        </td>
      </tr>
    `;
    emptyDiv.classList.add("hidden");
    updateBatchActionBar();
    return;
  }
  emptyDiv.classList.add("hidden");

  // 3. จัดกลุ่มตามวันที่ขอเพลง
  const groupedSongs = {};
  filtered.forEach(song => {
    const date = song.requestDate;
    if (!groupedSongs[date]) {
      groupedSongs[date] = [];
    }
    groupedSongs[date].push(song);
  });

  const sortedDates = Object.keys(groupedSongs).sort((a, b) => new Date(b) - new Date(a));

  // ตั้งค่าพับ/กางเริ่มต้น
  if (Object.keys(collapsedDates).length === 0 && sortedDates.length > 0) {
    collapsedDates[sortedDates[0]] = false;
    for (let i = 1; i < sortedDates.length; i++) {
      collapsedDates[sortedDates[i]] = true;
    }
  }

  let finalHtml = "";

  sortedDates.forEach(date => {
    const dateSongs = groupedSongs[date];
    const isCollapsed = collapsedDates[date] === true;

    // ตรวจสอบว่าเพลงทั้งหมดของวันนี้ถูกเลือกไว้แล้วหรือไม่
    const allSongIdsOfDate = dateSongs.map(s => s.id);
    const isAllSelected = allSongIdsOfDate.every(id => selectedSongIds.includes(id)) && allSongIdsOfDate.length > 0;

    // สรุปยอด
    const totalCount = dateSongs.length;
    const playedCount = dateSongs.filter(s => s.status === "played").length;

    // แถวหัวข้อระบุวัน + ปุ่มยุบ/ขยาย และปุ่มเคลียร์เฉพาะวัน
    finalHtml += `
      <tr class="bg-slate-100 dark:bg-slate-900/60 font-semibold text-slate-700 dark:text-slate-200">
        <td class="p-3 border-y border-slate-200 dark:border-slate-700">
          <div class="flex items-center space-x-3">
            <input type="checkbox" onchange="toggleSelectAllForDate('${date}', this.checked)" class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700" ${isAllSelected ? 'checked' : ''}>
            <button onclick="toggleDateCollapse('${date}')" class="flex items-center space-x-1.5 focus:outline-none hover:text-blue-600 dark:hover:text-school-yellow">
              <i class="fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'} text-xs w-4"></i>
              <span>คำขอประจำวันที่ ${formatThaiDate(date)}</span>
              <span class="text-[10px] text-slate-400 font-normal ml-2">(คิว: ${totalCount} | เปิดแล้ว: ${playedCount})</span>
            </button>
          </div>
        </td>
        <td colspan="3" class="p-3 border-y border-slate-200 dark:border-slate-700"></td>
        <td class="p-3 border-y border-slate-200 dark:border-slate-700 text-right">
          <div class="flex justify-end items-center space-x-2">
            <button onclick="deletePlayedSongsByDate('${date}')" class="py-1 px-2.5 bg-amber-600/10 hover:bg-amber-600 text-amber-700 dark:text-amber-400 dark:hover:text-white rounded text-[10px] font-semibold transition" title="ลบเฉพาะเพลงที่เล่นเสร็จแล้วของวันนี้">
              <i class="fa-solid fa-circle-minus mr-1"></i> ลบที่เปิดแล้ว
            </button>
            <button onclick="deleteAllSongsByDate('${date}')" class="py-1 px-2.5 bg-rose-600/10 hover:bg-rose-600 text-rose-700 dark:text-rose-400 dark:hover:text-white rounded text-[10px] font-semibold transition" title="ลบเพลงทั้งหมดของวันนี้">
              <i class="fa-solid fa-trash-can mr-1"></i> ลบทั้งหมดของวัน
            </button>
          </div>
        </td>
      </tr>
    `;

    const rowsHtml = dateSongs.map(song => {
      const isChecked = selectedSongIds.includes(song.id);
      let badgeClass = "";
      let badgeText = "";
      if (song.status === "pending") { badgeClass = "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"; badgeText = "รอคิว"; }
      else if (song.status === "approved") { badgeClass = "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"; badgeText = "เตรียมเปิด"; }
      else if (song.status === "played") { badgeClass = "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"; badgeText = "เปิดแล้ว"; }
      else { badgeClass = "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"; badgeText = "ปฏิเสธ"; }

      return `
        <tr class="${isCollapsed ? 'hidden' : ''} hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${isChecked ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}">
          <td class="p-4 flex items-center space-x-3">
            <input type="checkbox" onchange="toggleSelectSong('${song.id}')" class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700" ${isChecked ? 'checked' : ''}>
            <div>
              <p class="font-bold text-slate-700 dark:text-slate-200">${song.songTitle}</p>
              <span class="text-[10px] text-slate-400 font-english">- ${song.artist}</span>
            </div>
          </td>
          <td class="p-4">
            <p class="font-bold text-slate-700 dark:text-slate-200">${song.studentName}</p>
            <span class="text-[10px] text-slate-400 font-english">ชั้น: ${song.studentClass || '-'}</span>
          </td>
          <td class="p-4">
            <p class="text-slate-500 italic max-w-xs truncate">${song.message || "-"}</p>
            ${song.songUrl ? `<a href="${song.songUrl}" target="_blank" class="text-blue-500 underline text-[10px] font-english block mt-0.5 truncate max-w-xs">${song.songUrl}</a>` : ""}
          </td>
          <td class="p-4">
            <span class="px-2.5 py-0.5 rounded text-[10px] font-bold ${badgeClass}">${badgeText}</span>
          </td>
          <td class="p-4 text-right">
            <div class="flex justify-end space-x-2">
              <button onclick="openAdminSongModal('${song.id}')" class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition">
                จัดการคิว
              </button>
              <button onclick="deleteSongRequest('${song.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg transition" title="ลบคำขอ">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    finalHtml += rowsHtml;
  });

  tableBody.innerHTML = finalHtml;
  updateBatchActionBar();
}

// 4. หน้าต่างแก้ไขคิวเพลงของแอดมิน
function openAdminSongModal(songId) {
  const song = window.StudentCouncilDB.getSongs().find(s => s.id === songId);
  if (!song) return;

  document.getElementById("admin-song-id").value = song.id;
  document.getElementById("admin-song-lbl-title").textContent = song.songTitle;
  document.getElementById("admin-song-lbl-artist").textContent = song.artist;
  document.getElementById("admin-song-status").value = song.status;
  document.getElementById("admin-song-feedback").value = song.adminFeedback || "";

  showModal("admin-song-modal");
}

function closeAdminSongModal() {
  hideModal("admin-song-modal");
}

function saveSongStatus() {
  const id = document.getElementById("admin-song-id").value;
  const status = document.getElementById("admin-song-status").value;
  const feedback = document.getElementById("admin-song-feedback").value.trim();

  const songs = window.StudentCouncilDB.getSongs();
  const idx = songs.findIndex(s => s.id === id);
  if (idx !== -1) {
    songs[idx].status = status;
    songs[idx].adminFeedback = feedback;
  }

  window.StudentCouncilDB.saveSongs(songs);

  showLoading(() => {
    closeAdminSongModal();
    alert("บันทึกการแก้ไขสถานะคิวเพลงสำเร็จแล้ว!");
    renderAdminSongs();
  });
}

// 5. ลบคำขอเพลงเดี่ยว (แอดมิน)
function deleteSongRequest(songId) {
  if (confirm("คุณต้องการลบคำขอเพลงนี้ออกจากระบบใช่หรือไม่?")) {
    const songs = window.StudentCouncilDB.getSongs();
    const updated = songs.filter(s => s.id !== songId);
    window.StudentCouncilDB.saveSongs(updated);
    
    alert("ลบคำขอเพลงเสร็จสิ้น!");
    renderAdminSongs();
  }
}

// 6. ล้างเพลงที่เปิดแล้วทั้งหมด (แอดมิน)
function clearPlayedSongs() {
  const songs = window.StudentCouncilDB.getSongs();
  const playedSongs = songs.filter(s => s.status === "played");
  
  if (playedSongs.length === 0) {
    alert("ไม่มีเพลงที่เปิดแล้ว (Played) ค้างอยู่ในระบบขณะนี้");
    return;
  }

  if (confirm(`คุณต้องการลบคำขอเพลงที่เปิดเล่นเสร็จสิ้นแล้วทั้งหมดจำนวน ${playedSongs.length} เพลง ออกจากระบบเพื่อจัดคิวใหม่ใช่หรือไม่?`)) {
    const updated = songs.filter(s => s.status !== "played");
    window.StudentCouncilDB.saveSongs(updated);
    
    alert(`ล้างรายการเพลงที่เล่นเสร็จแล้วจำนวน ${playedSongs.length} เพลง ออกเรียบร้อยครับ!`);
    renderAdminSongs();
  }
}

// =========================================================================
// *************************************************************************
//                   [ส่วนของหายได้คืน / LOST & FOUND SECTION]
//      คุณสามารถค้นหา ตกแต่ง หรือแก้ไขฟังก์ชันทั้งหมดเกี่ยวกับของหายได้คืนที่นี่
// *************************************************************************
// =========================================================================

// 1. แสดงรายการของหายและของที่เก็บได้สำหรับฝั่งนักเรียน
function createLostFoundCard(item) {
  const categoryMeta = getLostFoundCategoryMeta(item.category);
  const imageHtml = item.images && item.images.length > 0
    ? `<div class="h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 mb-3"><img src="${item.images[0]}" class="w-full h-full object-cover" alt="${item.itemName}"></div>`
    : `<div class="h-32 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center text-slate-400 mb-3"><i class="fa-solid fa-box text-xl"></i></div>`;

  let statusBadge = "";
  if (item.status === "searching") {
    statusBadge = `<span class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">กำลังตามหา</span>`;
  } else if (item.status === "found_matching") {
    statusBadge = `<span class="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">พบของ/ติดต่อรับ</span>`;
  } else if (item.status === "returned") {
    statusBadge = `<span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">ส่งคืนแล้ว</span>`;
  }

  const pinnedBadge = item.pinned ? `<span class="px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-semibold"><i class="fa-solid fa-thumbtack mr-1"></i>ปักหมุด</span>` : "";
  const categoryBadge = getLostFoundCategoryBadge(item.category);

  const notesHtml = item.adminNotes
    ? `<div class="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-[10px] text-emerald-700"><i class="fa-solid fa-circle-check mr-1"></i>${item.adminNotes}</div>`
    : "";

  const comments = item.comments || [];
  const commentsHtml = `
    <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 space-y-2">
      <div class="flex items-center justify-between text-slate-400 font-bold text-[10px] uppercase">
        <span class="flex items-center"><i class="fa-solid fa-comments mr-1.5 text-blue-500"></i>เบาะแส / ข้อความพูดคุย (${comments.length})</span>
      </div>
      <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
        ${comments.length === 0
          ? `<p class="text-slate-400 italic text-[10px] text-center py-2">ยังไม่มีคอมเมนต์แจ้งเบาะแส</p>`
          : comments.map(c => `
              <div class="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100/30 dark:border-slate-800/30">
                <div class="flex items-center justify-between text-[9px] text-slate-400 mb-0.5">
                  <span class="font-bold text-blue-600 dark:text-blue-400">${c.name} (${c.classroom})</span>
                  <span>${formatThaiDate(c.dateTime.split("T")[0])} (${c.dateTime.split("T")[1] || ""})</span>
                </div>
                <p class="text-[11px] text-slate-700 dark:text-slate-200 select-all font-medium leading-normal">${c.message}</p>
              </div>
            `).join("")
        }
      </div>
    </div>
  `;

  const commentFormHtml = `
    <div class="mt-3">
      <button onclick="toggleCommentForm('${item.id}')" class="text-[10px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition duration-150">
        <i class="fa-regular fa-comment"></i>
        <span>แจ้งเบาะแส / แสดงตัวเป็นเจ้าของ</span>
      </button>
      <div id="comment-form-container-${item.id}" class="hidden mt-2 p-2 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-2">
        <div class="grid grid-cols-2 gap-2">
          <input type="text" id="comment-name-${item.id}" placeholder="ชื่อผู้แจ้ง" value="${currentUser ? currentUser.name : ""}" class="py-1 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] focus:outline-none">
          <input type="text" id="comment-class-${item.id}" placeholder="ชั้น" value="${currentUser ? currentUser.class : ""}" class="py-1 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] focus:outline-none">
        </div>
        <div class="flex gap-2">
          <input type="text" id="comment-msg-${item.id}" placeholder="พิมพ์ข้อความติดต่อหรือเบาะแสที่นี่..." class="flex-1 py-1 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] focus:outline-none">
          <button onclick="submitLostFoundComment('${item.id}')" class="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition duration-150">ส่ง</button>
        </div>
      </div>
    </div>
  `;

  const displayName = item.type === "money_found" && currentRole !== "admin"
    ? "*".repeat(String(item.itemName).replace(/\D/g, "").length || 4)
    : item.itemName;
  return `
    <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-premium flex flex-col justify-between text-xs fade-in-up">
      <div>
        ${imageHtml}
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h4 class="font-bold text-sm text-slate-800 dark:text-white leading-snug min-w-0">${displayName}</h4>
          <div class="flex items-center gap-2 flex-wrap">
            ${pinnedBadge}
            ${categoryBadge}
            ${statusBadge}
          </div>
        </div>
        <div class="space-y-1.5 text-slate-500 dark:text-slate-400 font-medium">
          <div class="flex items-center"><i class="fa-solid fa-map-marker-alt w-4 text-slate-400"></i><span>สถานที่: ${item.roomLocation}</span></div>
          <div class="flex items-center"><i class="fa-solid fa-clock w-4 text-slate-400"></i><span>วันเวลา: ${formatThaiDate(item.dateTime.split("T")[0])} (${item.dateTime.split("T")[1] || ""})</span></div>
          <div class="flex items-center"><i class="fa-solid fa-user w-4 text-slate-400"></i><span>ผู้แจ้ง: ${item.reporterName} (${item.classroom})</span></div>
          <div class="flex items-center"><i class="fa-solid fa-tags w-4 text-slate-400"></i><span>หมวด: ${categoryMeta.icon} ${categoryMeta.label}</span></div>
          <div class="flex items-center"><i class="fa-solid fa-phone w-4 text-slate-400"></i><span class="text-blue-600 dark:text-blue-400 font-semibold select-all">ติดต่อ: ${item.contact}</span></div>
          ${item.description ? `<p class="mt-2 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/30 p-2 rounded">${item.description}</p>` : ""}
        </div>
        ${notesHtml}
        ${commentsHtml}
        ${commentFormHtml}
      </div>
    </div>
  `;
}

function renderStudentLostFound() {
  const lostListContainer = getEl("lost-items-list");
  const foundListContainer = getEl("found-items-list");

  if (!lostListContainer || !foundListContainer) return;

  const searchQuery = (getEl("lf-search")?.value || "").toLowerCase();
  const dbItems = window.StudentCouncilDB.getLostFound();

  let filtered = dbItems.filter(item => {
    const matchesStatus = currentLfFilter === "searching"
      ? item.status === "searching" || item.status === "found_matching"
      : currentLfFilter === "returned"
        ? item.status === "returned"
        : true;
    const matchesCategory = currentLfCategory === "all" || item.category === currentLfCategory;
    return matchesStatus && matchesCategory;
  });

  if (searchQuery) {
    filtered = filtered.filter(item =>
      item.itemName.toLowerCase().includes(searchQuery) ||
      item.roomLocation.toLowerCase().includes(searchQuery) ||
      item.description.toLowerCase().includes(searchQuery) ||
      item.reporterName.toLowerCase().includes(searchQuery)
    );
  }

  const lostItems = filtered.filter(item => item.type === "lost" || item.type === "money_lost");
  const foundItems = filtered.filter(item => item.type === "found" || item.type === "money_found");

  lostItems.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  foundItems.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  setText("lost-count", lostItems.length);
  setText("found-count", foundItems.length);

  lostListContainer.innerHTML = lostItems.length === 0
    ? `<div class="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 text-slate-400 text-xs"><i class="fa-solid fa-search text-2xl mb-2 block"></i><span>ไม่พบรายการของหาย</span></div>`
    : lostItems.map(item => createLostFoundCard(item)).join("");

  foundListContainer.innerHTML = foundItems.length === 0
    ? `<div class="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 text-slate-400 text-xs"><i class="fa-solid fa-box text-2xl mb-2 block"></i><span>ไม่พบรายการที่เก็บได้</span></div>`
    : foundItems.map(item => createLostFoundCard(item)).join("");
}

// 2. จัดการตัวกรองสถานะสำหรับนักเรียน
function filterLostFound(status) {
  currentLfFilter = status;

  // ปรับเปลี่ยนสีปุ่มแท็บ
  const tabs = ["all", "searching", "returned"];
  tabs.forEach(t => {
    const btn = document.getElementById(`lf-filter-${t}`);
    if (btn) {
      if (t === status) {
        btn.className = "px-4 py-2 text-xs font-semibold border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400";
      } else {
        btn.className = "px-4 py-2 text-xs font-semibold border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200";
      }
    }
  });

  renderStudentLostFound();
}

function filterLostFoundByCategory(category) {
  currentLfCategory = category;
  renderStudentLostFound();
}

// helper to open money modal programmatically and pre-configure
function openMoneyModal() {
  openLostFoundModal('money');
}


// 3. เปิดโมดอลแจ้งเรื่องเงิน
function openLostFoundModal(type) {
  // สำหรับปุ่มแจ้งเงิน ให้เซ็ตเป็น "money" และแสดง selector
  if (type === "money") {
    document.getElementById("lf-type").value = "money"; // ยังไม่ได้เซ็ต money_lost/money_found ที่นี่ เรียกใช้ selector
    
    const title = document.getElementById("lf-modal-title");
    title.innerHTML = `<i class="fa-solid fa-coins text-amber-600 mr-2"></i>แจ้งเงินเอา`;
    
    const locLabel = document.getElementById("lf-location-label");
    const dateLabel = document.getElementById("lf-date-label");
    locLabel.innerHTML = `เงินหายที่ไหน <span class="text-rose-500">*</span>`;
    dateLabel.innerHTML = `วันที่และเวลาที่เงินหาย/เก็บ <span class="text-rose-500">*</span>`;
    
    const roomInput = document.getElementById("lf-room-location");
    roomInput.placeholder = "ระบุสถานที่ เช่น ชั้น 432 / โรงอาหาร";
    
    document.getElementById("lf-category-options")?.parentElement?.classList.add("hidden");
    document.getElementById("lf-image-upload-section")?.classList.add("hidden");
    document.getElementById("lf-money-type-section")?.classList.remove("hidden");
    
    const itemNameLabel = document.getElementById("lf-item-name-label");
    const itemNameInput = document.getElementById("lf-item-name");
    if (itemNameLabel) itemNameLabel.innerHTML = `ระบุจำนวนเงิน <span class="text-rose-500">*</span>`;
    if (itemNameInput) {
      itemNameInput.type = "number";
      itemNameInput.placeholder = "เช่น 500 (บาท)";
      itemNameInput.min = "0";
      itemNameInput.step = "1";
    }
    renderLostFoundCategoryOptions("money");
  } else {
    document.getElementById("lf-type").value = type;
    const title = document.getElementById("lf-modal-title");
    if (type === "lost") {
      title.innerHTML = `<i class="fa-solid fa-bullhorn text-rose-600 mr-2"></i>แจ้งของหาย`;
    } else if (type === "found") {
      title.innerHTML = `<i class="fa-solid fa-box-archive text-emerald-600 mr-2"></i>แจ้งเก็บได้`;
    } else {
      title.innerHTML = `แจ้งของหาย / เก็บของได้`;
    }

    const locLabel = document.getElementById("lf-location-label");
    const dateLabel = document.getElementById("lf-date-label");
    locLabel.innerHTML = `สถานที่ <span class="text-rose-500">*</span>`;
    dateLabel.innerHTML = `วันที่และเวลา <span class="text-rose-500">*</span>`;
    
    const roomInput = document.getElementById("lf-room-location");
    roomInput.placeholder = "เช่น ห้อง 421 / โรงอาหาร";
    
    document.getElementById("lf-category-options")?.parentElement?.classList.remove("hidden");
    document.getElementById("lf-image-upload-section")?.classList.remove("hidden");
    document.getElementById("lf-money-type-section")?.classList.add("hidden");
    
    const itemNameLabel = document.getElementById("lf-item-name-label");
    const itemNameInput = document.getElementById("lf-item-name");
    if (itemNameLabel) itemNameLabel.innerHTML = `ชื่อสิ่งของ / รายการ <span class="text-rose-500">*</span>`;
    if (itemNameInput) {
      itemNameInput.type = "text";
      itemNameInput.placeholder = "เช่น กระเป๋า, โทรศัพท์, สมุด";
      itemNameInput.removeAttribute('min');
      itemNameInput.removeAttribute('step');
    }
    renderLostFoundCategoryOptions("others");
  }

  // พรีฟิลข้อมูลผู้รายงาน
  document.getElementById("lf-reporter-name").value = currentUser.name || "";
  document.getElementById("lf-student-id").value = currentUser.id || "";
  document.getElementById("lf-classroom").value = currentUser.class || "";

  // รีเซ็ตข้อมูลในฟอร์ม
  document.getElementById("lf-item-name").value = "";
  document.getElementById("lf-room-location").value = "";
  
  // วันที่เวลาปัจจุบัน
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("lf-datetime").value = now.toISOString().slice(0, 16);

  document.getElementById("lf-description").value = "";
  document.getElementById("lf-contact").value = "";
  const radios = document.querySelectorAll('input[name="money-type"]');
  radios.forEach(r => r.checked = false);
  
  // เคลียร์รูปภาพอัปโหลด
  uploadedLostFoundImage = "";
  document.getElementById("lf-image-preview").src = "";
  document.getElementById("lf-image-preview-container").classList.add("hidden");

  showModal("student-lostfound-modal");
  // Focus amount input for money flow
  setTimeout(() => {
    const f = document.getElementById('lf-item-name');
    if (f) f.focus();
  }, 120);
}




function closeLostFoundModal() {
  hideModal("student-lostfound-modal");
}

// 4. บันทึกคำร้องเรียนของหาย/เก็บได้ของนักเรียน
function submitLostFoundReport() {
  if (!currentUser) {
    alert("กรุณาเข้าสู่ระบบก่อนแจ้งข้อมูลครับ");
    return;
  }

  let type = document.getElementById("lf-type").value;
  // If this is the generic money flow, read the radio selector
  if (type === "money") {
    const sel = document.querySelector('input[name="money-type"]:checked');
    if (sel) {
      type = sel.value === "lost" ? "money_lost" : "money_found";
    } else {
      alert("กรุณาเลือกว่าเป็น เงินหาย หรือ เก็บได้");
      return;
    }
  }
  const itemName = document.getElementById("lf-item-name").value.trim();
  const roomLocation = document.getElementById("lf-room-location").value.trim();
  const dateTime = document.getElementById("lf-datetime").value;
  const description = document.getElementById("lf-description").value.trim();
  const contact = document.getElementById("lf-contact").value.trim();
  const category = document.getElementById("lf-category").value || "others";

  // ดึงข้อมูลผู้แจ้งที่กรอกล่าสุด
  const typedName = document.getElementById("lf-reporter-name").value.trim();
  const typedId = document.getElementById("lf-student-id").value.trim();
  const typedClass = document.getElementById("lf-classroom").value.trim();

  if (!typedName || typedId.length !== 5 || isNaN(typedId) || !typedClass) {
    alert("กรุณากรอกชื่อผู้แจ้ง รหัสนักเรียน 5 หลัก (ตัวเลข) และชั้นให้ถูกต้อง");
    return;
  }

  if (!itemName || !roomLocation || !dateTime || !contact) {
    alert("กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน");
    return;
  }

  // อัปเดตข้อมูลผู้ใช้ใน Session
  currentUser.name = typedName;
  currentUser.id = typedId;
  currentUser.class = typedClass;
  persistAuthSession(currentUser, currentRole || "student");
  updateAuthUI();

  // บันทึกลงตารางนักเรียนเพื่อให้จำไว้ใช้
  const students = window.StudentCouncilDB.getStudents();
  const sIdx = students.findIndex(s => s.id === typedId);
  if (sIdx !== -1) {
    students[sIdx].name = typedName;
    students[sIdx].class = typedClass;
  } else {
    students.push({ name: typedName, id: typedId, class: typedClass });
  }
  window.StudentCouncilDB.saveStudents(students);

  const dbList = window.StudentCouncilDB.getLostFound();
  const newItem = {
    id: `lf-${Date.now()}`,
    reporterName: typedName,
    studentId: typedId,
    classroom: typedClass,
    type,
    itemName,
    roomLocation,
    dateTime,
    description,
    contact,
    category,
    status: "searching",
    pinned: false,
    images: uploadedLostFoundImage ? [uploadedLostFoundImage] : [],
    comments: [], // เพิ่มอาเรย์คอมเมนต์เตรียมไว้
    adminNotes: "",
    resolvedDate: "",
    // กำหนดความเป็นส่วนตัว: ถ้าเป็น money_found ให้เป็น admin_only, ถ้า money_lost เป็น public
    visibility: type === "money_found" ? "admin_only" : "public"
  };

  dbList.unshift(newItem);
  window.StudentCouncilDB.saveLostFound(dbList);

  showLoading(() => {
    closeLostFoundModal();
    showToast("ส่งข้อมูลสำเร็จแล้ว! สภานักเรียนจะดำเนินการตรวจสอบและช่วยประชาสัมพันธ์ให้โดยเร็วที่สุด", "success");
    renderStudentLostFound();
    // If money_found was submitted, admin-only: keep modal closed; otherwise notify
  });
}

// 5. แสดงตารางจัดการของแอดมิน
function renderAdminLostFound() {
  const tableBody = document.getElementById("admin-lf-table-body");
  const emptyEl = document.getElementById("admin-lf-empty");

  if (!tableBody) return;

  const dbItems = window.StudentCouncilDB.getLostFound();
  const statusFilter = document.getElementById("admin-lf-filter-status").value;
  const typeFilter = document.getElementById("admin-lf-filter-type").value;
  const categoryFilter = document.getElementById("admin-lf-filter-category").value;
  const searchVal = document.getElementById("admin-lf-search").value.toLowerCase();

  let filtered = dbItems;

  if (statusFilter !== "all") {
    filtered = filtered.filter(item => item.status === statusFilter);
  }
  if (typeFilter !== "all") {
    filtered = filtered.filter(item => typeFilter === "lost"
      ? item.type === "lost" || item.type === "money_lost"
      : item.type === "found" || item.type === "money_found");
  }
  if (categoryFilter !== "all") {
    filtered = filtered.filter(item => item.category === categoryFilter);
  }

  filtered.sort((a, b) => {
    const pinDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    if (pinDiff !== 0) return pinDiff;
    return new Date(b.dateTime) - new Date(a.dateTime);
  });
  if (searchVal) {
    filtered = filtered.filter(item => 
      item.itemName.toLowerCase().includes(searchVal) ||
      item.reporterName.toLowerCase().includes(searchVal) ||
      item.roomLocation.toLowerCase().includes(searchVal)
    );
  }

  if (filtered.length === 0) {
    tableBody.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  
  emptyEl.classList.add("hidden");

  tableBody.innerHTML = filtered.map(item => {
    const categoryMeta = getLostFoundCategoryMeta(item.category);
    const typeBadge = item.type === "lost"
      ? `<span class="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">ของหาย</span>`
      : item.type === "money_lost"
        ? `<span class="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">เงินหาย</span>`
        : item.type === "money_found"
          ? `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">เก็บเงินได้</span>`
          : `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">เก็บได้</span>`;

    let statusText = "";
    if (item.status === "searching") statusText = `<span class="text-rose-600 font-bold"><i class="fa-solid fa-spinner animate-spin mr-1 text-[10px]"></i>กำลังตามหา</span>`;
    if (item.status === "found_matching") statusText = `<span class="text-blue-600 font-bold"><i class="fa-solid fa-circle-info mr-1 text-[10px]"></i>พบของ/ติดต่อรับ</span>`;
    if (item.status === "returned") statusText = `<span class="text-emerald-600 font-bold"><i class="fa-solid fa-circle-check mr-1 text-[10px]"></i>ส่งคืนแล้ว</span>`;

    const imgTag = item.images && item.images.length > 0
      ? `<img src="${item.images[0]}" class="w-12 h-12 object-cover rounded border">`
      : `<div class="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-slate-400 text-lg border"><i class="fa-solid fa-box"></i></div>`;

    return `
      <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
        <td class="p-4">${imgTag}</td>
        <td class="p-4">${typeBadge}</td>
        <td class="p-4"><span class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">${categoryMeta.icon} ${categoryMeta.label}</span></td>
        <td class="p-4 font-bold text-slate-800 dark:text-slate-200">${item.itemName}</td>
        <td class="p-4 font-medium text-slate-600 dark:text-slate-400">${item.roomLocation}</td>
        <td class="p-4">
          <div class="font-bold">${item.reporterName} (${item.classroom})</div>
          <div class="text-[10px] text-slate-400 mt-0.5 font-english">${formatThaiDate(item.dateTime.split("T")[0])} (${item.dateTime.split("T")[1] || ""})</div>
        </td>
        <td class="p-4">${statusText}</td>
        <td class="p-4 text-center">
          ${item.pinned ? `<span class="inline-flex items-center px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-[10px] font-semibold"><i class="fa-solid fa-thumbtack mr-1"></i>ปักหมุด</span>` : `<span class="text-slate-400 text-[10px]">-</span>`}
        </td>
        <td class="p-4 text-right">
          <div class="flex flex-wrap items-center justify-end gap-1.5">
            <button onclick="toggleLostFoundPin('${item.id}')" class="p-1 px-2.5 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200 hover:bg-yellow-100 rounded text-[11px] font-bold border border-yellow-200/50">
              <i class="fa-solid fa-thumbtack mr-1"></i>${item.pinned ? 'ปลดปักหมุด' : 'ปักหมุด'}
            </button>
            <button onclick="openAdminLostFoundModal('${item.id}')" class="p-1 px-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded text-[11px] font-bold border border-blue-200/50">
              <i class="fa-solid fa-edit mr-1"></i>จัดการ
            </button>
            <button onclick="deleteLostFoundItem('${item.id}')" class="p-1 px-2.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded text-[11px] font-bold border border-rose-200/50">
              <i class="fa-solid fa-trash mr-1"></i>ลบ
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// 6. เปิดโมดอลแอดมินแก้ไขข้อมูล
function openAdminLostFoundModal(id) {
  const dbItems = window.StudentCouncilDB.getLostFound();
  const item = dbItems.find(i => i.id === id);
  if (!item) return;

  document.getElementById("admin-lf-id").value = item.id;
  document.getElementById("admin-lf-lbl-type").innerHTML = item.type === "lost"
    ? `<span class="text-rose-500">ของหาย</span>`
    : item.type === "money_lost"
      ? `<span class="text-rose-500">เงินหาย</span>`
      : item.type === "money_found"
        ? `<span class="text-emerald-500">เก็บเงินได้</span>`
        : `<span class="text-emerald-500">เก็บได้</span>`;
  document.getElementById("admin-lf-lbl-name").textContent = item.itemName;
  document.getElementById("admin-lf-lbl-location").textContent = item.roomLocation;
  document.getElementById("admin-lf-lbl-category").textContent = `${getLostFoundCategoryMeta(item.category).icon} ${getLostFoundCategoryMeta(item.category).label}`;
  document.getElementById("admin-lf-lbl-datetime").textContent = `${formatThaiDate(item.dateTime.split("T")[0])} (${item.dateTime.split("T")[1] || ""})`;
  document.getElementById("admin-lf-lbl-reporter").textContent = `${item.reporterName} ชั้น ${item.classroom} (รหัสนักเรียน: ${item.studentId})`;
  document.getElementById("admin-lf-lbl-desc").textContent = item.description || "- ไม่มีรายละเอียดเพิ่มเติม -";
  document.getElementById("admin-lf-lbl-contact").textContent = item.contact;

  // รูปภาพ
  const imgContainer = document.getElementById("admin-lf-img-container");
  const imgEl = document.getElementById("admin-lf-img");
  if (item.images && item.images.length > 0) {
    imgContainer.classList.remove("hidden");
    imgEl.src = item.images[0];
  } else {
    imgContainer.classList.add("hidden");
    imgEl.src = "";
  }

  // ค่าควบคุม
  document.getElementById("admin-lf-status").value = item.status;
  document.getElementById("admin-lf-resdate").value = item.resolvedDate || "";
  document.getElementById("admin-lf-notes").value = item.adminNotes || "";
  document.getElementById("admin-lf-pinned").checked = !!item.pinned;

  document.getElementById("admin-lostfound-modal").classList.remove("hidden");
}

function closeAdminLostFoundModal() {
  document.getElementById("admin-lostfound-modal").classList.add("hidden");
}

// 7. แอดมินบันทึกสถานะของหายได้คืน
function saveAdminLostFoundStatus() {
  const id = document.getElementById("admin-lf-id").value;
  const status = document.getElementById("admin-lf-status").value;
  const resolvedDate = document.getElementById("admin-lf-resdate").value;
  const adminNotes = document.getElementById("admin-lf-notes").value.trim();
  const pinned = document.getElementById("admin-lf-pinned").checked;

  const dbList = window.StudentCouncilDB.getLostFound();
  const idx = dbList.findIndex(i => i.id === id);

  if (idx !== -1) {
    dbList[idx].status = status;
    dbList[idx].resolvedDate = resolvedDate;
    dbList[idx].adminNotes = adminNotes;
    dbList[idx].pinned = pinned;

    window.StudentCouncilDB.saveLostFound(dbList);

    showLoading(() => {
      closeAdminLostFoundModal();
      alert("บันทึกข้อมูลและปรับเปลี่ยนสถานะเรียบร้อยแล้ว!");
      renderAdminLostFound();
    });
  }
}

// 8. ลบรายการของหายได้คืน
function deleteLostFoundItem(id) {
  if (confirm("คุณแน่ใจว่าต้องการลบรายการแจ้งของหายได้คืนรายการนี้ใช่หรือไม่? การลบจะไม่สามารถกู้คืนข้อมูลกลับมาได้")) {
    const dbList = window.StudentCouncilDB.getLostFound();
    const updated = dbList.filter(i => i.id !== id);
    window.StudentCouncilDB.saveLostFound(updated);
    
    alert("ลบรายการออกจากระบบเสร็จสิ้น!");
    renderAdminLostFound();
  }
}

function toggleLostFoundPin(id) {
  const dbList = window.StudentCouncilDB.getLostFound();
  const idx = dbList.findIndex(i => i.id === id);
  if (idx === -1) return;
  dbList[idx].pinned = !dbList[idx].pinned;
  window.StudentCouncilDB.saveLostFound(dbList);
  renderAdminLostFound();
}

// 9. แสดง/ซ่อนฟอร์มแสดงความคิดเห็นใต้โพสต์
function toggleCommentForm(id) {
  const form = document.getElementById(`comment-form-container-${id}`);
  if (form) {
    form.classList.toggle("hidden");
  }
}

// 10. ส่งความคิดเห็น/ข้อความยืนยันสิทธิ์ใต้โพสต์ของหายได้คืน
function submitLostFoundComment(id) {
  const nameVal = document.getElementById(`comment-name-${id}`).value.trim();
  const classVal = document.getElementById(`comment-class-${id}`).value.trim();
  const msgVal = document.getElementById(`comment-msg-${id}`).value.trim();

  if (!nameVal || !classVal || !msgVal) {
    alert("กรุณากรอกชื่อ ชั้น และข้อความแสดงความเห็นให้ครบถ้วน");
    return;
  }

  const dbList = window.StudentCouncilDB.getLostFound();
  const idx = dbList.findIndex(i => i.id === id);

  if (idx !== -1) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const newComment = {
      name: nameVal,
      classroom: classVal,
      message: msgVal,
      dateTime: now.toISOString().slice(0, 16)
    };

    dbList[idx].comments = dbList[idx].comments || [];
    dbList[idx].comments.push(newComment);

    window.StudentCouncilDB.saveLostFound(dbList);

    alert("ส่งข้อความแสดงความคิดเห็นสำเร็จ!");
    renderStudentLostFound();
  }
}


