import { describe, it, expect, beforeEach } from 'vitest';
import { loadGallery, saveGallery, addEntry, STORAGE_KEY, MAX_ENTRIES } from './gallery.js';

// vitest 默认 node 环境没有 localStorage，用一个最小假实现注入。
function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const entry = (id) => ({ id, card: { perfumeName: `香水${id}` }, risoArt: '<svg/>', asciiArt: 'x' });

describe('loadGallery', () => {
  it('没有记录时返回空数组', () => {
    expect(loadGallery(fakeStorage())).toEqual([]);
  });

  it('存储内容损坏（非法 JSON）时返回空数组，不抛错', () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, '{not valid json');
    expect(() => loadGallery(storage)).not.toThrow();
    expect(loadGallery(storage)).toEqual([]);
  });

  it('存储内容不是数组时返回空数组', () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ not: 'array' }));
    expect(loadGallery(storage)).toEqual([]);
  });
});

describe('saveGallery / loadGallery 往返', () => {
  it('存进去再读出来内容一致', () => {
    const storage = fakeStorage();
    saveGallery(storage, [entry(1), entry(2)]);
    expect(loadGallery(storage)).toEqual([entry(1), entry(2)]);
  });

  it('setItem 抛错（如配额超限/隐私模式）时静默吞掉，不抛给调用者', () => {
    const storage = fakeStorage();
    storage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => saveGallery(storage, [entry(1)])).not.toThrow();
  });
});

describe('addEntry', () => {
  it('追加一条，新的排在最前面（最近生成的先看到）', () => {
    const list = addEntry([entry(1)], entry(2));
    expect(list.map((e) => e.id)).toEqual([2, 1]);
  });

  it('超过 MAX_ENTRIES 时裁掉最旧的，只保留最近的', () => {
    let list = [];
    for (let i = 0; i < MAX_ENTRIES + 5; i++) list = addEntry(list, entry(i));
    expect(list).toHaveLength(MAX_ENTRIES);
    expect(list[0].id).toBe(MAX_ENTRIES + 4); // 最新的在最前
  });

  it('不修改传入的原数组（纯函数）', () => {
    const original = [entry(1)];
    addEntry(original, entry(2));
    expect(original).toHaveLength(1);
  });
});
