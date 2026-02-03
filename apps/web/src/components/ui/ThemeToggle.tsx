import { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Monitor, Check } from 'lucide-react';
import { useThemeStore } from '@/stores/theme-store';

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const themes = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ] as const;

  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`p-1.5 rounded-md transition-colors ${
            theme === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={label}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}

export function ThemeToggleDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useThemeStore();

  const themes = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ] as const;

  const currentTheme = themes.find((t) => t.value === theme) || themes[2];
  const CurrentIcon = currentTheme.icon;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (value: 'light' | 'dark' | 'system') => {
    setTheme(value);
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors ${isOpen ? 'relative z-[75]' : ''}`}
        title={`Theme: ${currentTheme.label}`}
      >
        <CurrentIcon className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
          <div
            ref={dropdownRef}
            className="fixed right-14 top-16 bg-card border border-border/50 rounded-xl shadow-2xl py-1.5 min-w-[140px] z-[70] animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {themes.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => handleSelect(value)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors ${
                  theme === value
                    ? 'bg-accent/50 text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {label}
                </span>
                {theme === value && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
