// 本地 gallery 持久化：生成的卡片存进 localStorage，刷新页面记录还在。
// 纯函数 + 显式传入 storage（可注入假实现测试，也方便换掉存储后端）。
// 个人本地工具场景，结构化 JSON 存 localStorage 足够，不需要数据库。

export const STORAGE_KEY = 'roma.gallery.v1';
export const MAX_ENTRIES = 30; // 控制 localStorage 占用，只留最近的

export function loadGallery(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // 存储内容损坏时安全降级，不让一条坏数据拖垮整个 gallery
  }
}

export function saveGallery(storage, list) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 配额超限/隐私模式下 setItem 可能抛错；gallery 只是锦上添花，静默失败即可
  }
}

// 把新条目加到最前面（最近生成的先看到），超过 MAX_ENTRIES 时裁掉最旧的。纯函数，不修改入参。
export function addEntry(list, entry) {
  return [entry, ...list].slice(0, MAX_ENTRIES);
}
