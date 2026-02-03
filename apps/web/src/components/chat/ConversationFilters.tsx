import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSessions } from '@/hooks/use-sessions';
import { useAgents } from '@/hooks/use-users';

export interface ConversationFilters {
  status: string | null;
  sessionId: string | null;
  assignedTo: string | null;
  sortBy: 'lastMessage' | 'unread' | 'oldest';
}

interface ConversationFiltersProps {
  filters: ConversationFilters;
  onChange: (filters: ConversationFilters) => void;
}

const statusOptions = [
  { value: null, label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

const sortOptions = [
  { value: 'lastMessage', label: 'Latest' },
  { value: 'unread', label: 'Unread' },
  { value: 'oldest', label: 'Oldest' },
];

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Array<{ value: string | null; label: string }>;
  onChange: (value: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);
  const hasValue = value !== null;

  return (
    <div className="relative flex-1 min-w-0" ref={dropdownRef}>
      <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border transition-all',
          'bg-background hover:bg-accent/50',
          hasValue
            ? 'border-primary/50 text-foreground'
            : 'border-border text-muted-foreground'
        )}
      >
        <span className="truncate">{selectedOption?.label || 'Select...'}</span>
        <ChevronDown className={cn('w-4 h-4 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-card rounded-lg shadow-lg border border-border z-50 py-1 max-h-48 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value ?? 'null'}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/50 transition-colors',
                value === option.value && 'bg-primary/10 text-primary'
              )}
            >
              <span>{option.label}</span>
              {value === option.value && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConversationFiltersBar({ filters, onChange }: ConversationFiltersProps) {
  const { data: sessions } = useSessions();
  const { data: agents } = useAgents();

  const sessionOptions = [
    { value: null, label: 'All Sessions' },
    ...(sessions?.map((s) => ({ value: s.id, label: s.name })) || []),
  ];

  const agentOptions = [
    { value: null, label: 'All Agents' },
    { value: 'unassigned', label: 'Unassigned' },
    ...(agents?.map((a) => ({ value: a.id, label: a.name })) || []),
  ];

  const activeFiltersCount = [
    filters.status,
    filters.sessionId,
    filters.assignedTo,
  ].filter((f) => f !== null).length;

  const clearFilters = () => {
    onChange({
      status: null,
      sessionId: null,
      assignedTo: null,
      sortBy: 'lastMessage',
    });
  };

  return (
    <div className="px-4 py-3 border-b border-border/50 bg-secondary/30 space-y-3">
      {/* Filter row */}
      <div className="grid grid-cols-2 gap-2">
        <FilterSelect
          label="Status"
          value={filters.status}
          options={statusOptions}
          onChange={(value) => onChange({ ...filters, status: value })}
        />
        <FilterSelect
          label="Session"
          value={filters.sessionId}
          options={sessionOptions}
          onChange={(value) => onChange({ ...filters, sessionId: value })}
        />
        <FilterSelect
          label="Assigned To"
          value={filters.assignedTo}
          options={agentOptions}
          onChange={(value) => onChange({ ...filters, assignedTo: value })}
        />
        <FilterSelect
          label="Sort By"
          value={filters.sortBy}
          options={sortOptions as Array<{ value: string | null; label: string }>}
          onChange={(value) => onChange({ ...filters, sortBy: (value as ConversationFilters['sortBy']) || 'lastMessage' })}
        />
      </div>

      {/* Clear button */}
      {activeFiltersCount > 0 && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-background hover:bg-accent rounded-lg border border-border transition-all w-full justify-center"
        >
          <X className="w-3.5 h-3.5" />
          Clear {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
