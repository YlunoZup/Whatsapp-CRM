import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Check, ChevronDown, X, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  group?: string;
}

export interface CustomSelectProps {
  options: SelectOption[];
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  multiple?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  maxHeight?: number;
  emptyMessage?: string;
  renderOption?: (option: SelectOption, selected: boolean) => React.ReactNode;
  renderValue?: (selected: SelectOption | SelectOption[]) => React.ReactNode;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  disabled = false,
  loading = false,
  error,
  multiple = false,
  searchable = false,
  clearable = false,
  className,
  triggerClassName,
  menuClassName,
  maxHeight = 280,
  emptyMessage = 'No options found',
  renderOption,
  renderValue,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Normalize value to array for consistent handling
  const selectedValues = useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // Get selected options
  const selectedOptions = useMemo(() => {
    return options.filter(opt => selectedValues.includes(opt.value));
  }, [options, selectedValues]);

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(opt =>
      opt.label.toLowerCase().includes(query) ||
      opt.description?.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Group options
  const groupedOptions = useMemo(() => {
    const groups: Record<string, SelectOption[]> = {};
    const ungrouped: SelectOption[] = [];

    filteredOptions.forEach(opt => {
      if (opt.group) {
        if (!groups[opt.group]) groups[opt.group] = [];
        groups[opt.group].push(opt);
      } else {
        ungrouped.push(opt);
      }
    });

    return { groups, ungrouped };
  }, [filteredOptions]);

  // Get flat list of options for keyboard navigation
  const flatOptions = useMemo(() => {
    const result: SelectOption[] = [];
    Object.values(groupedOptions.groups).forEach(group => result.push(...group));
    result.push(...groupedOptions.ungrouped);
    return result;
  }, [groupedOptions]);

  // Handle selection
  const handleSelect = useCallback((optionValue: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(newValues);
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
    setSearchQuery('');
  }, [multiple, selectedValues, onChange]);

  // Handle clear
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(multiple ? [] : '');
  }, [multiple, onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (isOpen && flatOptions[highlightedIndex]) {
          handleSelect(flatOptions[highlightedIndex].value);
        } else {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchQuery('');
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev =>
            prev < flatOptions.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev =>
            prev > 0 ? prev - 1 : flatOptions.length - 1
          );
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchQuery('');
        break;
    }
  }, [disabled, isOpen, flatOptions, highlightedIndex, handleSelect]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      highlightedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, highlightedIndex]);

  // Reset highlighted index when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Render display value
  const displayValue = useMemo(() => {
    if (renderValue && selectedOptions.length > 0) {
      return renderValue(multiple ? selectedOptions : selectedOptions[0]);
    }

    if (selectedOptions.length === 0) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    if (multiple) {
      if (selectedOptions.length === 1) {
        return selectedOptions[0].label;
      }
      return `${selectedOptions.length} selected`;
    }

    return selectedOptions[0].label;
  }, [renderValue, selectedOptions, multiple, placeholder]);

  // Render single option
  const renderSingleOption = (option: SelectOption, index: number) => {
    const isSelected = selectedValues.includes(option.value);
    const isHighlighted = index === highlightedIndex;

    if (renderOption) {
      return (
        <div
          key={option.value}
          data-index={index}
          onClick={() => !option.disabled && handleSelect(option.value)}
          className={cn(
            'cursor-pointer',
            option.disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {renderOption(option, isSelected)}
        </div>
      );
    }

    return (
      <div
        key={option.value}
        data-index={index}
        onClick={() => !option.disabled && handleSelect(option.value)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors rounded-lg mx-1',
          isHighlighted && 'bg-accent',
          isSelected && !isHighlighted && 'bg-primary/10',
          option.disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {option.icon && (
          <span className="flex-shrink-0 text-muted-foreground">
            {option.icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className={cn(
            'text-sm font-medium truncate',
            isSelected ? 'text-primary' : 'text-foreground'
          )}>
            {option.label}
          </div>
          {option.description && (
            <div className="text-xs text-muted-foreground truncate">
              {option.description}
            </div>
          )}
        </div>
        {isSelected && (
          <Check className="w-4 h-4 text-primary flex-shrink-0" />
        )}
      </div>
    );
  };

  let optionIndex = 0;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left',
          'bg-card border border-border rounded-lg',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
          isOpen && 'ring-2 ring-primary/50 border-primary',
          error && 'border-red-500 focus:ring-red-500/50',
          disabled && 'opacity-50 cursor-not-allowed bg-muted',
          triggerClassName
        )}
      >
        <span className="flex-1 truncate text-sm">
          {loading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </span>
          ) : (
            displayValue
          )}
        </span>

        <div className="flex items-center gap-1">
          {clearable && selectedValues.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 w-full mt-1 py-1',
            'bg-card border border-border rounded-xl shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            menuClassName
          )}
        >
          {/* Search Input */}
          {searchable && (
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={searchPlaceholder}
                  className={cn(
                    'w-full pl-9 pr-3 py-2 text-sm',
                    'bg-muted/50 border-0 rounded-lg',
                    'placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50'
                  )}
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div
            ref={listRef}
            className="overflow-y-auto"
            style={{ maxHeight }}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              <>
                {/* Grouped Options */}
                {Object.entries(groupedOptions.groups).map(([groupName, groupOptions]) => (
                  <div key={groupName}>
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {groupName}
                    </div>
                    {groupOptions.map(option => {
                      const currentIndex = optionIndex++;
                      return renderSingleOption(option, currentIndex);
                    })}
                  </div>
                ))}

                {/* Ungrouped Options */}
                {groupedOptions.ungrouped.map(option => {
                  const currentIndex = optionIndex++;
                  return renderSingleOption(option, currentIndex);
                })}
              </>
            )}
          </div>

          {/* Multi-select footer */}
          {multiple && selectedValues.length > 0 && (
            <div className="border-t border-border px-3 py-2 mt-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{selectedValues.length} selected</span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-primary hover:text-primary/80 font-medium"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Convenience wrapper for simple single-select dropdowns
export function SimpleSelect({
  options,
  value,
  onChange,
  ...props
}: Omit<CustomSelectProps, 'multiple' | 'onChange' | 'value'> & {
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <CustomSelect
      {...props}
      options={options}
      value={value}
      onChange={(v) => onChange(v as string)}
      multiple={false}
    />
  );
}

// Convenience wrapper for multi-select dropdowns
export function MultiSelect({
  options,
  value = [],
  onChange,
  ...props
}: Omit<CustomSelectProps, 'multiple' | 'onChange' | 'value'> & {
  value?: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <CustomSelect
      {...props}
      options={options}
      value={value}
      onChange={(v) => onChange(v as string[])}
      multiple={true}
    />
  );
}
