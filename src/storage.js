import { deepClone, safeParse } from "./utils.js";

const STORAGE_KEY = "mutabaa:data:v1";
const BACKUP_KEY = `${STORAGE_KEY}:backup`;
const VERSION = 1;

const defaultData = Object.freeze({
  version: VERSION,
  profile: {
    name: "اسمي الجميل",
    avatar: "🌱",
  },
  projects: [],
  createdAt: null,
  updatedAt: null,
});

function timestamp() {
  return new Date().toISOString();
}

export function loadAppData() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn("تعذّر الوصول إلى مساحة التخزين:", error);
  }
  if (!raw) {
    const seeded = deepClone(defaultData);
    seeded.createdAt = timestamp();
    seeded.updatedAt = seeded.createdAt;
    return seeded;
  }

  const data = safeParse(raw, null);
  if (!data || data.version !== VERSION) {
    console.warn("إصدار البيانات غير متوافق، سيتم إنشاء نسخة جديدة.");
    const fresh = deepClone(defaultData);
    fresh.createdAt = timestamp();
    fresh.updatedAt = fresh.createdAt;
    return fresh;
  }

  return {
    ...deepClone(defaultData),
    ...data,
  };
}

export function saveAppData(data) {
  const payload = deepClone(data);
  payload.updatedAt = timestamp();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(
      BACKUP_KEY,
      JSON.stringify({ savedAt: payload.updatedAt, snapshot: payload })
    );
  } catch (error) {
    console.error("فشل حفظ البيانات:", error);
  }
  return payload;
}

export function exportAppData(data) {
  return JSON.stringify(
    {
      exportedAt: timestamp(),
      ...deepClone(data),
    },
    null,
    2
  );
}

export function importAppData(json) {
  const parsed = safeParse(json, null);
  if (!parsed || parsed.version !== VERSION) {
    throw new Error("ملف البيانات غير صالح أو الإصدار غير مدعوم.");
  }
  parsed.updatedAt = timestamp();
  return parsed;
}

export function loadBackup() {
  let raw = null;
  try {
    raw = localStorage.getItem(BACKUP_KEY);
  } catch (error) {
    console.warn("لا يوجد صلاحية للوصول إلى النسخة الاحتياطية:", error);
    return null;
  }
  if (!raw) {
    return null;
  }
  const parsed = safeParse(raw, null);
  return parsed?.snapshot ?? null;
}
