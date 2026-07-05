// ข้อมูลเริ่มต้นสำหรับระบบสภานักเรียน (Seed Data)

const initialNews = [];

const initialLinks = [];

const initialReports = [];

const initialAchievements = [];

const initialStudents = [
];

const LEGACY_ADMIN_PASSWORDS = ["SCLRPCADMIN", "SCLRPCADMIN2026", "admin123", "Admin123", "admin1234"];
const DEFAULT_ADMIN_PASSWORD = "admin123";
const ADMIN_USERNAME = "Admin";

const initialAdmins = [
  { username: ADMIN_USERNAME, password: DEFAULT_ADMIN_PASSWORD, name: "แอดมิน", displayName: "ผู้ดูแลระบบ" }
];

const initialChat = [];

const initialSongs = [];

const DATA_VERSION = 3;
const DATA_VERSION_KEY = "sc_data_version";
const DATA_STORAGE_KEYS = [
  "sc_news",
  "sc_links",
  "sc_reports",
  "sc_achievements",
  "sc_students",
  "sc_songs",
  "sc_lost_found",
  "sc_chat",
  "sc_admins"
];

// ฟังก์ชันสำหรับดึงข้อมูล (ถ้าไม่มีใน LocalStorage ให้ใช้ข้อมูลเริ่มต้น)
function getStorageData(key, fallback) {
  const storedVersion = localStorage.getItem(DATA_VERSION_KEY);
  if (storedVersion !== DATA_VERSION.toString()) {
    DATA_STORAGE_KEYS.forEach((storageKey) => localStorage.removeItem(storageKey));
    localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION.toString());
  }

  const data = localStorage.getItem(key);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Error parsing " + key + " from localStorage", e);
    }
  }
  localStorage.setItem(key, JSON.stringify(fallback));
  return fallback;
}

function scheduleSyncData() {
  if (typeof window.scheduleSyncData === "function") {
    window.scheduleSyncData();
  }
}

function migrateAdmins(admins) {
  if (!Array.isArray(admins)) {
    return initialAdmins;
  }

  let hasChanges = false;
  const migratedAdmins = admins.map((admin) => {
    if (admin && admin.username === initialAdmins[0].username) {
      const currentPassword = admin.password;
      const shouldResetPassword = !currentPassword || LEGACY_ADMIN_PASSWORDS.includes(currentPassword);

      if (shouldResetPassword) {
        hasChanges = true;
        return {
          ...admin,
          username: initialAdmins[0].username,
          password: initialAdmins[0].password,
          name: initialAdmins[0].name,
          displayName: initialAdmins[0].displayName
        };
      }
    }
    return admin;
  });

  return hasChanges ? migratedAdmins : admins;
}

function ensureAdminCredentials() {
  const admins = getStorageData("sc_admins", initialAdmins);
  const migratedAdmins = migrateAdmins(admins);
  if (JSON.stringify(migratedAdmins) !== JSON.stringify(admins)) {
    localStorage.setItem("sc_admins", JSON.stringify(migratedAdmins));
  }
  return migratedAdmins;
}

const initialLostFound = [];

window.StudentCouncilDB = {
  getNews: () => getStorageData("sc_news", initialNews),
  saveNews: (news) => {
    localStorage.setItem("sc_news", JSON.stringify(news));
    scheduleSyncData();
  },
  
  getLinks: () => getStorageData("sc_links", initialLinks),
  saveLinks: (links) => {
    localStorage.setItem("sc_links", JSON.stringify(links));
    scheduleSyncData();
  },
  
  getReports: () => getStorageData("sc_reports", initialReports),
  saveReports: (reports) => {
    localStorage.setItem("sc_reports", JSON.stringify(reports));
    scheduleSyncData();
  },
  
  getAchievements: () => getStorageData("sc_achievements", initialAchievements),
  saveAchievements: (achievements) => {
    localStorage.setItem("sc_achievements", JSON.stringify(achievements));
    scheduleSyncData();
  },
  
  getStudents: () => getStorageData("sc_students", initialStudents),
  saveStudents: (students) => {
    localStorage.setItem("sc_students", JSON.stringify(students));
    scheduleSyncData();
  },

  getSongs: () => getStorageData("sc_songs", initialSongs),
  saveSongs: (songs) => {
    localStorage.setItem("sc_songs", JSON.stringify(songs));
    scheduleSyncData();
  },

  getLostFound: () => getStorageData("sc_lost_found", initialLostFound),
  saveLostFound: (items) => {
    localStorage.setItem("sc_lost_found", JSON.stringify(items));
    scheduleSyncData();
  },

  getChat: () => getStorageData("sc_chat", initialChat),
  saveChat: (messages) => {
    localStorage.setItem("sc_chat", JSON.stringify(messages));
    scheduleSyncData();
  },

  getAdmins: () => ensureAdminCredentials(),
  saveAdmins: (admins) => {
    localStorage.setItem("sc_admins", JSON.stringify(admins));
    scheduleSyncData();
  }
};

ensureAdminCredentials();
