import { useEffect } from 'react';

const KEY = 'familyhomecenter.settings.open';

function openSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? '[]'));
  } catch {
    return new Set();
  }
}
function saveOpen(key: string, s: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...s]));
  } catch {
    /* not remembered — fine */
  }
}

/**
 * Every section (a `.panel` straight inside `root` with an <h2>) starts folded down to its
 * heading; tap the heading to open or close it. Which ones are open is remembered on this screen.
 * Works on sections that show up later too (each part of Settings loads on its own). `storageKey`
 * keeps each page's open sections separate (Settings, Music…).
 */
export function useCollapsibleSections(root: HTMLElement | null, storageKey = KEY) {
  useEffect(() => {
    if (!root) return;
    const open = openSet(storageKey);
    const titleOf = (h: Element) => (h.textContent ?? '').trim().slice(0, 60);
    const apply = () => {
      root.querySelectorAll(':scope > .panel').forEach((sec) => {
        const h = sec.querySelector(':scope > h2');
        if (!h) return;
        sec.classList.add('collapsible');
        h.classList.add('collapsible__head');
        h.setAttribute('role', 'button');
        h.setAttribute('tabindex', '0');
        const isOpen = open.has(titleOf(h));
        sec.classList.toggle('collapsible--open', isOpen);
        h.setAttribute('aria-expanded', String(isOpen));
      });
    };
    const toggle = (h: Element) => {
      const t = titleOf(h);
      if (open.has(t)) open.delete(t);
      else open.add(t);
      saveOpen(storageKey, open);
      apply();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element;
      // A button or link in the heading does its own thing.
      if (target.closest('button, a, input, select, label')) return;
      const h = target.closest('.collapsible__head');
      if (h && h.parentElement?.parentElement === root) toggle(h);
    };
    const onKey = (e: KeyboardEvent) => {
      const h = (e.target as Element).closest?.('.collapsible__head');
      if (h && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        toggle(h);
      }
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(root, { childList: true });
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    return () => {
      mo.disconnect();
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
    };
  }, [root, storageKey]);
}
