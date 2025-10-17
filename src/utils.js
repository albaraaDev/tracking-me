export function createId(prefix = "id") {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const random = Math.random().toString(16).slice(2, 10);
  const time = Date.now().toString(16);
  return `${prefix}-${time}${random}`;
}

export function deepClone(obj) {
  if (typeof structuredClone === "function") {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

export function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.warn("تعذر قراءة البيانات:", error);
    return fallback;
  }
}
