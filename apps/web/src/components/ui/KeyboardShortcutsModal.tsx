import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useKeyboardShortcut, SHORTCUTS, formatShortcut } from '@/hooks/use-keyboard-shortcuts';

const shortcutsList = [
  { ...SHORTCUTS.GLOBAL_SEARCH, key: 'k', ctrl: true },
  { ...SHORTCUTS.KEYBOARD_HELP, key: '/', ctrl: true },
  { ...SHORTCUTS.NEW_MESSAGE, key: 'n', ctrl: true },
  { ...SHORTCUTS.CLOSE_PANEL, key: 'Escape' },
  { ...SHORTCUTS.SEND_MESSAGE, key: 'Enter', ctrl: true },
  { ...SHORTCUTS.PREV_CONVERSATION, key: 'ArrowUp', alt: true },
  { ...SHORTCUTS.NEXT_CONVERSATION, key: 'ArrowDown', alt: true },
];

const groupedShortcuts = shortcutsList.reduce(
  (acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  },
  {} as Record<string, typeof shortcutsList>
);

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  useKeyboardShortcut('/', () => setIsOpen(true), { ctrl: true });
  useKeyboardShortcut('Escape', () => setIsOpen(false), { enabled: isOpen });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      <div className="relative bg-card border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-4rem)]">
          <div className="grid gap-8">
            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
                    >
                      <span className="text-sm text-foreground">
                        {shortcut.description}
                      </span>
                      <kbd className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-muted text-muted-foreground rounded border">
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 mx-1 text-xs font-mono bg-muted rounded border">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}

export function KeyboardShortcutsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        title="Keyboard shortcuts (Ctrl+/)"
      >
        <Keyboard className="w-5 h-5" />
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative bg-card border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-4rem)]">
              <div className="grid gap-8">
                {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {shortcuts.map((shortcut, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
                        >
                          <span className="text-sm text-foreground">
                            {shortcut.description}
                          </span>
                          <kbd className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-muted text-muted-foreground rounded border">
                            {formatShortcut(shortcut)}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground text-center">
                Press <kbd className="px-1.5 py-0.5 mx-1 text-xs font-mono bg-muted rounded border">Esc</kbd> to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
