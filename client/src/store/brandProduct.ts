import { atom } from 'recoil';
import type { AtomEffect } from 'recoil';

function localStorageEffect<T>(key: string): AtomEffect<T> {
  return ({ setSelf, onSet }) => {
    const saved = localStorage.getItem(key);
    if (saved != null) {
      try {
        setSelf(JSON.parse(saved) as T);
      } catch {
        localStorage.removeItem(key);
      }
    }
    onSet((value, _, isReset) => {
      if (isReset || value == null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    });
  };
}

const activeBrandId = atom<number | null>({
  key: 'activeBrandId',
  default: null,
  effects: [localStorageEffect<number | null>('nucleant_activeBrandId')],
});

const activeBrandName = atom<string | null>({
  key: 'activeBrandName',
  default: null,
  effects: [localStorageEffect<string | null>('nucleant_activeBrandName')],
});

const activeProductId = atom<number | null>({
  key: 'activeProductId',
  default: null,
  effects: [localStorageEffect<number | null>('nucleant_activeProductId')],
});

const activeProductName = atom<string | null>({
  key: 'activeProductName',
  default: null,
  effects: [localStorageEffect<string | null>('nucleant_activeProductName')],
});

export default { activeBrandId, activeBrandName, activeProductId, activeProductName };
