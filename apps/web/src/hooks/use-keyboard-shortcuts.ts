import { useEffect, useCallback } from 'react';

type KeyboardShortcut = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
  category: string;
};

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

export function useKeyboardShortcut(
  key: string,
  handler: () => void,
  options: {
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
    enabled?: boolean;
  } = {}
) {
  const { ctrl = false, meta = false, shift = false, alt = false, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape in inputs
        if (key !== 'Escape') return;
      }

      const ctrlOrMeta = isMac ? event.metaKey : event.ctrlKey;
      const matchesCtrl = ctrl ? ctrlOrMeta : !ctrlOrMeta;
      const matchesMeta = meta ? event.metaKey : true;
      const matchesShift = shift ? event.shiftKey : !event.shiftKey;
      const matchesAlt = alt ? event.altKey : !event.altKey;
      const matchesKey = event.key.toLowerCase() === key.toLowerCase();

      if (matchesKey && matchesCtrl && matchesMeta && matchesShift && matchesAlt) {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, ctrl, meta, shift, alt, handler, enabled]);
}

// Global shortcuts registry for help modal
const registeredShortcuts: KeyboardShortcut[] = [];

export function registerShortcut(shortcut: KeyboardShortcut) {
  if (!registeredShortcuts.find((s) => s.key === shortcut.key && s.ctrl === shortcut.ctrl)) {
    registeredShortcuts.push(shortcut);
  }
}

export function getRegisteredShortcuts() {
  return registeredShortcuts;
}

export function formatShortcut(shortcut: Omit<KeyboardShortcut, 'handler' | 'description' | 'category'>) {
  const parts: string[] = [];

  if (shortcut.ctrl || shortcut.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  let keyDisplay = shortcut.key;
  if (keyDisplay === 'Escape') keyDisplay = 'Esc';
  if (keyDisplay === 'ArrowUp') keyDisplay = '↑';
  if (keyDisplay === 'ArrowDown') keyDisplay = '↓';
  if (keyDisplay === 'ArrowLeft') keyDisplay = '←';
  if (keyDisplay === 'ArrowRight') keyDisplay = '→';
  if (keyDisplay === 'Enter') keyDisplay = '↵';

  parts.push(keyDisplay.toUpperCase());

  return parts.join(isMac ? '' : '+');
}

// Predefined shortcuts list for help
export const SHORTCUTS = {
  GLOBAL_SEARCH: {
    key: 'k',
    ctrl: true,
    description: 'Open global search',
    category: 'Navigation',
  },
  KEYBOARD_HELP: {
    key: '/',
    ctrl: true,
    description: 'Show keyboard shortcuts',
    category: 'General',
  },
  NEW_MESSAGE: {
    key: 'n',
    ctrl: true,
    description: 'New conversation',
    category: 'Conversations',
  },
  CLOSE_PANEL: {
    key: 'Escape',
    description: 'Close panel/modal',
    category: 'General',
  },
  SEND_MESSAGE: {
    key: 'Enter',
    ctrl: true,
    description: 'Send message',
    category: 'Conversations',
  },
  PREV_CONVERSATION: {
    key: 'ArrowUp',
    alt: true,
    description: 'Previous conversation',
    category: 'Navigation',
  },
  NEXT_CONVERSATION: {
    key: 'ArrowDown',
    alt: true,
    description: 'Next conversation',
    category: 'Navigation',
  },
} as const;
