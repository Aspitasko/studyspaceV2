import { useEffect, useRef, useState } from 'react';

export interface AutoSaveOptions<T> {
  /** debounce wait in ms */
  wait?: number;
  /** optional predicate to decide whether to save a value */
  shouldSave?: (value: T) => boolean;
}

export function useAutoSave<T = any>(key: string, value: T, opts: AutoSaveOptions<T> = {}) {
  const { wait = 1000, shouldSave } = opts;
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.savedAt) {
        setHasDraft(true);
        setLastSavedAt(parsed.savedAt);
      }
    } catch (e) {
      // ignore
    }
  }, [key]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const should = typeof shouldSave === 'function' ? shouldSave(value) : Boolean(value && JSON.stringify(value) !== JSON.stringify({}));
    if (!should) {
      return;
    }

    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        const payload = { value, savedAt: Date.now() };
        localStorage.setItem(key, JSON.stringify(payload));
        setHasDraft(true);
        setLastSavedAt(payload.savedAt);
      } catch (e) {
        // ignore storage errors
      }
    }, wait);

    return () => window.clearTimeout(timer.current);
  }, [key, value, wait, shouldSave]);

  const restore = (): T | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.value ?? null;
    } catch (e) {
      return null;
    }
  };

  const clear = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
    setHasDraft(false);
    setLastSavedAt(null);
  };

  return { hasDraft, lastSavedAt, restore, clear };
}

export default useAutoSave;
