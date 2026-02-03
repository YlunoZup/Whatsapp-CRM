import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContacts, useDeleteContact, useUpdateContactStatus } from '../hooks/use-contacts';
import { useTags } from '../hooks/use-tags';
import { useSessions } from '../hooks/use-sessions';
import { useStartConversation } from '../hooks/use-conversations';
import { ContactFormModal } from '../components/contacts/ContactFormModal';
import { ImportContactsModal } from '../components/contacts/ImportContactsModal';
import { ContactFilters, ContactFiltersState, SmartList, FilterGroup } from '../components/contacts/ContactFilters';
import { BulkActionsToolbar } from '../components/contacts/BulkActionsToolbar';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  MessageSquare,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Smartphone,
  Upload,
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronDown,
  Circle,
  Phone,
  ThumbsUp,
  ThumbsDown,
  Trophy,
  XCircle,
} from 'lucide-react';
import type { Contact, Tag } from '@whatsapp-crm/shared';

// Lead status configuration
const LEAD_STATUSES = {
  new: { label: 'New', color: '#6366f1', bgColor: 'bg-indigo-500/10', textColor: 'text-indigo-500', icon: Circle },
  contacted: { label: 'Contacted', color: '#0ea5e9', bgColor: 'bg-sky-500/10', textColor: 'text-sky-500', icon: Phone },
  interested: { label: 'Interested', color: '#22c55e', bgColor: 'bg-green-500/10', textColor: 'text-green-500', icon: ThumbsUp },
  not_interested: { label: 'Not Interested', color: '#f97316', bgColor: 'bg-orange-500/10', textColor: 'text-orange-500', icon: ThumbsDown },
  closed_won: { label: 'Closed Won', color: '#10b981', bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-500', icon: Trophy },
  closed_lost: { label: 'Closed Lost', color: '#ef4444', bgColor: 'bg-red-500/10', textColor: 'text-red-500', icon: XCircle },
} as const;

type LeadStatus = keyof typeof LEAD_STATUSES;

// Status dropdown component
function StatusDropdown({
  status,
  onStatusChange,
  disabled,
}: {
  status: string;
  onStatusChange: (status: LeadStatus) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentStatus = LEAD_STATUSES[status as LeadStatus] || LEAD_STATUSES.new;
  const StatusIcon = currentStatus.icon;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
          currentStatus.bgColor,
          currentStatus.textColor,
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'
        )}
      >
        <StatusIcon className="w-3 h-3" />
        <span>{currentStatus.label}</span>
        {!disabled && <ChevronDown className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-44 bg-card border border-border rounded-xl shadow-premium-lg overflow-hidden animate-scale-in">
          <div className="py-1">
            {Object.entries(LEAD_STATUSES).map(([key, config]) => {
              const Icon = config.icon;
              const isActive = key === status;
              return (
                <button
                  key={key}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(key as LeadStatus);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm transition-all',
                    isActive ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                >
                  <Icon className="w-4 h-4" style={{ color: config.color }} />
                  <span className={isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                    {config.label}
                  </span>
                  {isActive && <Check className="w-3 h-3 ml-auto text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Local storage key for smart lists
const SMART_LISTS_KEY = 'whatsapp-crm-smart-lists';

export function ContactsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Contact | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allPagesSelected, setAllPagesSelected] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<ContactFiltersState>({ groups: [] });
  const [activeSmartListId, setActiveSmartListId] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');

  // Smart lists (persisted to localStorage)
  const [smartLists, setSmartLists] = useState<SmartList[]>(() => {
    try {
      const stored = localStorage.getItem(SMART_LISTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist smart lists to localStorage
  useEffect(() => {
    localStorage.setItem(SMART_LISTS_KEY, JSON.stringify(smartLists));
  }, [smartLists]);

  // Build query params from filters
  const queryParams = useMemo(() => {
    const params: Record<string, any> = {
      page,
      limit: 20,
      search: search || undefined,
    };

    // Extract tag filters
    const tagConditions = filters.groups.flatMap(g =>
      g.conditions.filter(c => c.field === 'tags' && Array.isArray(c.value) && c.value.length > 0)
    );
    if (tagConditions.length > 0) {
      params.tagIds = tagConditions[0].value;
    }

    // Extract session filter
    const sessionConditions = filters.groups.flatMap(g =>
      g.conditions.filter(c => c.field === 'assignedSession' && c.value)
    );
    if (sessionConditions.length > 0) {
      params.sessionId = sessionConditions[0].value;
    }

    // Status filter
    if (statusFilter) {
      params.status = statusFilter;
    }

    return params;
  }, [page, search, filters, statusFilter]);

  const { data: contactsData, isLoading } = useContacts(queryParams);
  const { data: tags } = useTags();
  const { data: sessions } = useSessions();
  const deleteContact = useDeleteContact();
  const startConversation = useStartConversation();
  const updateStatus = useUpdateContactStatus();

  const connectedSession = sessions?.find(s => s.status === 'connected');
  const contacts = contactsData?.data || [];
  const meta = contactsData?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;

  // Clear selection when page/filters change
  useEffect(() => {
    setSelectedIds(new Set());
    setAllPagesSelected(false);
  }, [page, search, filters]);

  const handleEdit = (contact: Contact) => {
    setSelectedContact(contact);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (showDeleteConfirm) {
      await deleteContact.mutateAsync(showDeleteConfirm.id);
      setShowDeleteConfirm(null);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedContact(null);
  };

  const handleMessage = async (contact: Contact) => {
    if (!connectedSession) {
      alert('No connected WhatsApp session. Please connect a session first.');
      return;
    }

    try {
      const conversation = await startConversation.mutateAsync({
        contactId: contact.id,
        sessionId: connectedSession.id,
      });
      navigate(`/conversations?id=${conversation.id}`);
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
      setAllPagesSelected(false);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAllOnPage = () => {
    const newSet = new Set(selectedIds);
    contacts.forEach(c => newSet.add(c.id));
    setSelectedIds(newSet);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setAllPagesSelected(false);
  };

  const handleSelectAll = () => {
    if (allPagesSelected) {
      clearSelection();
    } else {
      selectAllOnPage();
      setAllPagesSelected(true);
    }
  };

  // Smart list handlers
  const handleSaveSmartList = (name: string, filterGroups: FilterGroup[]) => {
    const newSmartList: SmartList = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      filters: filterGroups,
      createdAt: new Date().toISOString(),
    };
    setSmartLists(prev => [...prev, newSmartList]);
    setActiveSmartListId(newSmartList.id);
  };

  const handleLoadSmartList = (smartList: SmartList) => {
    setFilters({ groups: smartList.filters });
    setActiveSmartListId(smartList.id);
    setPage(1);
  };

  const handleDeleteSmartList = (id: string) => {
    setSmartLists(prev => prev.filter(s => s.id !== id));
    if (activeSmartListId === id) {
      setActiveSmartListId(undefined);
    }
  };

  const handleFiltersChange = (newFilters: ContactFiltersState) => {
    setFilters(newFilters);
    setActiveSmartListId(undefined); // Clear active smart list when filters change
    setPage(1);
  };

  // Avatar colors
  const getAvatarColor = (id: string) => {
    const colors = [
      'bg-slate-600',
      'bg-slate-700',
      'bg-zinc-600',
      'bg-zinc-700',
      'bg-neutral-600',
      'bg-neutral-700',
      'bg-stone-600',
      'bg-gray-600',
    ];
    const hash = (id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const selectedIdsArray = Array.from(selectedIds);
  const hasSelection = selectedIdsArray.length > 0;
  const allOnPageSelected = contacts.length > 0 && contacts.every(c => selectedIds.has(c.id));

  return (
    <div className="flex flex-col h-full">
      {/* Bulk Actions Toolbar */}
      {hasSelection && (
        <BulkActionsToolbar
          selectedIds={selectedIdsArray}
          totalCount={meta?.total || 0}
          allSelected={allPagesSelected}
          onSelectAll={handleSelectAll}
          onClearSelection={clearSelection}
          onActionComplete={clearSelection}
        />
      )}

      <div className="flex-1 overflow-auto p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
              Contacts
            </h1>
            <p className="text-muted-foreground">
              Manage your WhatsApp contacts and their information
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className={cn(
                'group inline-flex items-center gap-2 px-4 py-2.5',
                'bg-secondary text-foreground font-medium rounded-xl border border-border',
                'transition-all duration-200 ease-out',
                'hover:bg-accent hover:border-primary/30',
                'active:scale-[0.98]'
              )}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={() => {
                setSelectedContact(null);
                setShowModal(true);
              }}
              className={cn(
                'group inline-flex items-center gap-2 px-5 py-2.5',
                'bg-primary text-primary-foreground font-medium rounded-xl',
                'transition-all duration-200 ease-out',
                'hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25',
                'active:scale-[0.98]'
              )}
            >
              <Plus className="w-5 h-5" />
              Add Contact
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className={cn(
                  'w-full pl-12 pr-4 py-3 bg-secondary/50 border border-border rounded-xl',
                  'text-foreground placeholder:text-muted-foreground/60',
                  'transition-all duration-200 ease-out',
                  'focus:outline-none focus:bg-background focus:border-primary/50 focus:ring-4 focus:ring-primary/10'
                )}
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as LeadStatus | '');
                  setPage(1);
                }}
                className={cn(
                  'appearance-none px-4 py-3 pr-10 bg-secondary/50 border border-border rounded-xl',
                  'text-foreground cursor-pointer min-w-[160px]',
                  'transition-all duration-200 ease-out',
                  'focus:outline-none focus:bg-background focus:border-primary/50 focus:ring-4 focus:ring-primary/10',
                  !statusFilter && 'text-muted-foreground'
                )}
              >
                <option value="">All Statuses</option>
                {Object.entries(LEAD_STATUSES).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <ContactFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            smartLists={smartLists}
            onSaveSmartList={handleSaveSmartList}
            onLoadSmartList={handleLoadSmartList}
            onDeleteSmartList={handleDeleteSmartList}
            activeSmartListId={activeSmartListId}
          />
        </div>

        {/* Table */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border/50">
                  {/* Checkbox column */}
                  <th className="pl-4 pr-2 py-4 w-12">
                    <button
                      onClick={() => allOnPageSelected ? clearSelection() : selectAllOnPage()}
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                        allOnPageSelected
                          ? 'bg-primary border-primary text-white'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      {allOnPageSelected && <Check className="w-3 h-3" />}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Assigned SIM
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Tags
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {isLoading ? (
                  [...Array(5)].map((_, index) => (
                    <tr key={index}>
                      <td className="pl-4 pr-2 py-5">
                        <div className="w-5 h-5 bg-muted/50 rounded animate-pulse" />
                      </td>
                      <td className="px-6 py-5">
                        <div className="h-5 bg-muted/50 rounded-lg animate-pulse w-3/4" />
                      </td>
                      <td className="px-6 py-5">
                        <div className="h-5 bg-muted/50 rounded-lg animate-pulse w-1/2" />
                      </td>
                      <td className="px-6 py-5">
                        <div className="h-6 w-20 bg-muted/50 rounded-lg animate-pulse" />
                      </td>
                      <td className="px-6 py-5">
                        <div className="h-5 bg-muted/50 rounded-lg animate-pulse w-1/2" />
                      </td>
                      <td className="px-6 py-5">
                        <div className="h-5 bg-muted/50 rounded-lg animate-pulse w-1/2" />
                      </td>
                      <td className="px-6 py-5">
                        <div className="h-5 bg-muted/50 rounded-lg animate-pulse w-1/3" />
                      </td>
                      <td className="px-6 py-5">
                        <div className="h-5 bg-muted/50 rounded-lg animate-pulse w-1/2 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="w-8 h-8 text-muted-foreground/50" />
                        <p>No contacts found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact, index) => {
                    const isSelected = selectedIds.has(contact.id);
                    return (
                      <tr
                        key={contact.id}
                        className={cn(
                          'transition-colors duration-150 cursor-pointer',
                          isSelected ? 'bg-primary/5' : index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20',
                          'hover:bg-accent/50'
                        )}
                        onClick={() => handleEdit(contact)}
                      >
                        {/* Checkbox */}
                        <td className="pl-4 pr-2 py-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleSelect(contact.id)}
                            className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                              isSelected
                                ? 'bg-primary border-primary text-white'
                                : 'border-border hover:border-primary/50'
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </button>
                        </td>

                        {/* Contact */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              'h-11 w-11 rounded-xl flex items-center justify-center text-white font-medium text-base',
                              getAvatarColor(contact.id)
                            )}>
                              {contact.name?.[0]?.toUpperCase() || contact.phone?.[0] || '?'}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">
                                {contact.name || 'Unnamed'}
                              </div>
                              <div className="text-sm text-muted-foreground">{contact.email || '—'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-6 py-4">
                          <span className="text-sm text-foreground font-mono">{contact.phone}</span>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <StatusDropdown
                            status={(contact as any).status || 'new'}
                            onStatusChange={(newStatus) => {
                              updateStatus.mutate({ id: contact.id, status: newStatus });
                            }}
                            disabled={updateStatus.isPending}
                          />
                        </td>

                        {/* Assigned Session */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {contact.assignedSession ? (
                              <>
                                <div className="p-1.5 rounded-lg bg-[#00A884]/10">
                                  <Smartphone className="w-3.5 h-3.5 text-[#00A884]" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-foreground">{contact.assignedSession.name}</div>
                                  {contact.assignedSession.phoneNumber && (
                                    <div className="text-xs text-muted-foreground">{contact.assignedSession.phoneNumber}</div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">Not assigned</span>
                            )}
                          </div>
                        </td>

                        {/* Tags */}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {contact.tags?.slice(0, 3).map((tag: Tag) => (
                              <span
                                key={tag.id}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg"
                                style={{
                                  backgroundColor: `${tag.color}15`,
                                  color: tag.color,
                                }}
                              >
                                {tag.name}
                              </span>
                            ))}
                            {contact.tags && contact.tags.length > 3 && (
                              <span className="px-2 py-1 text-xs text-muted-foreground bg-muted rounded-lg">
                                +{contact.tags.length - 3}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Added */}
                        <td className="px-6 py-4">
                          <span className="text-sm text-muted-foreground">
                            {contact.createdAt && new Date(contact.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleMessage(contact)}
                              disabled={!connectedSession || startConversation.isPending}
                              className={cn(
                                'p-2 rounded-xl transition-all duration-200',
                                'text-primary hover:bg-primary/10',
                                'disabled:opacity-50 disabled:cursor-not-allowed'
                              )}
                              title={!connectedSession ? 'Connect a WhatsApp session first' : 'Send message'}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(contact)}
                              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(contact)}
                              className="p-2 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all duration-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                Showing{' '}
                <span className="font-medium text-foreground">
                  {(meta.page - 1) * meta.limit + 1}
                </span>
                {' '}to{' '}
                <span className="font-medium text-foreground">
                  {Math.min(meta.page * meta.limit, meta.total)}
                </span>
                {' '}of{' '}
                <span className="font-medium text-foreground">{meta.total}</span>
                {' '}results
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className={cn(
                    'p-2 rounded-xl transition-all duration-200',
                    'text-muted-foreground hover:text-foreground hover:bg-accent',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - page) <= 1) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={cn(
                          'min-w-[40px] h-10 px-3 text-sm font-medium rounded-xl transition-all duration-200',
                          pageNum === page
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  if (Math.abs(pageNum - page) === 2) {
                    return (
                      <span key={pageNum} className="px-2 text-muted-foreground">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}

                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className={cn(
                    'p-2 rounded-xl transition-all duration-200',
                    'text-muted-foreground hover:text-foreground hover:bg-accent',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contact Form Modal */}
      <ContactFormModal
        isOpen={showModal}
        onClose={handleCloseModal}
        contact={selectedContact}
      />

      {/* Import Contacts Modal */}
      <ImportContactsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="relative bg-card rounded-2xl shadow-premium-lg border border-border/50 p-6 max-w-md w-full animate-scale-in">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-500/10">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">Delete Contact</h3>
                <p className="text-muted-foreground mt-1">
                  Are you sure you want to delete{' '}
                  <strong className="text-foreground">{showDeleteConfirm.name || showDeleteConfirm.phone}</strong>?
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteContact.isPending}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-xl',
                  'bg-red-500 text-white hover:bg-red-600',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {deleteContact.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
