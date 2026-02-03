import { useState } from 'react';
import {
  X,
  Tag,
  Smartphone,
  Trash2,
  Download,
  CheckSquare,
  Square,
  Loader2,
  GitMerge,
  Edit3,
  Check,
  Star,
  MessageSquare,
  Circle,
  Phone,
  ThumbsUp,
  ThumbsDown,
  Trophy,
  XCircle,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTags } from '@/hooks/use-tags';
import { useSessions } from '@/hooks/use-sessions';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

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

interface BulkActionsToolbarProps {
  selectedIds: string[];
  totalCount: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onActionComplete: () => void;
}

interface BulkActionResult {
  success: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}

interface ContactForMerge {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  metadata: Record<string, unknown>;
  conversationCount: number;
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
  assignedSession: { id: string; name: string; phoneNumber: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export function BulkActionsToolbar({
  selectedIds,
  totalCount,
  allSelected,
  onSelectAll,
  onClearSelection,
  onActionComplete,
}: BulkActionsToolbarProps) {
  const { data: tags = [] } = useTags();
  const { data: sessions = [] } = useSessions();
  const queryClient = useQueryClient();

  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: string; result: BulkActionResult } | null>(null);

  // Merge state
  const [mergeContacts, setMergeContacts] = useState<ContactForMerge[]>([]);
  const [masterContactId, setMasterContactId] = useState<string | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);

  // Bulk edit state
  const [bulkEditName, setBulkEditName] = useState('');
  const [bulkEditEmail, setBulkEditEmail] = useState('');
  const [bulkEditCompany, setBulkEditCompany] = useState('');
  const [bulkEditJobTitle, setBulkEditJobTitle] = useState('');

  const connectedSessions = sessions.filter(s => s.status === 'connected');

  // Bulk Add Tags
  const addTagsMutation = useMutation({
    mutationFn: async ({ contactIds, tagIds }: { contactIds: string[]; tagIds: string[] }) => {
      const { data } = await api.post<BulkActionResult>('/contacts/bulk/add-tags', {
        contactIds,
        tagIds,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setActionResult({ type: 'Tags added', result: data });
      setShowTagDropdown(false);
    },
  });

  // Bulk Remove Tags
  const removeTagsMutation = useMutation({
    mutationFn: async ({ contactIds, tagIds }: { contactIds: string[]; tagIds: string[] }) => {
      const { data } = await api.post<BulkActionResult>('/contacts/bulk/remove-tags', {
        contactIds,
        tagIds,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setActionResult({ type: 'Tags removed', result: data });
    },
  });

  // Bulk Assign Session
  const assignSessionMutation = useMutation({
    mutationFn: async ({ contactIds, sessionId }: { contactIds: string[]; sessionId: string }) => {
      const { data } = await api.post<BulkActionResult>('/contacts/bulk/assign-session', {
        contactIds,
        sessionId,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setActionResult({ type: 'Session assigned', result: data });
      setShowSessionDropdown(false);
    },
  });

  // Bulk Delete
  const deleteMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const { data } = await api.post<BulkActionResult>('/contacts/bulk/delete', {
        contactIds,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setActionResult({ type: 'Contacts deleted', result: data });
      setShowDeleteConfirm(false);
      onActionComplete();
    },
  });

  // Bulk Update Status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ contactIds, status }: { contactIds: string[]; status: LeadStatus }) => {
      const { data } = await api.post<BulkActionResult>('/contacts/bulk/update-status', {
        contactIds,
        status,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setActionResult({ type: 'Status updated', result: data });
      setShowStatusDropdown(false);
    },
  });

  // Bulk Edit
  const bulkEditMutation = useMutation({
    mutationFn: async (updates: { name?: string; email?: string; metadata?: Record<string, unknown> }) => {
      const { data } = await api.post<BulkActionResult>('/contacts/bulk/edit', {
        contactIds: selectedIds,
        updates,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setActionResult({ type: 'Contacts updated', result: data });
      setShowBulkEditModal(false);
      resetBulkEditForm();
    },
  });

  // Merge Contacts
  const mergeMutation = useMutation({
    mutationFn: async ({ masterContactId, mergeContactIds }: { masterContactId: string; mergeContactIds: string[] }) => {
      const { data } = await api.post('/contacts/bulk/merge', {
        masterContactId,
        mergeContactIds,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setActionResult({ type: 'Contacts merged', result: { success: mergeContacts.length, failed: 0 } });
      setShowMergeModal(false);
      setMergeContacts([]);
      setMasterContactId(null);
      onActionComplete();
    },
  });

  const resetBulkEditForm = () => {
    setBulkEditName('');
    setBulkEditEmail('');
    setBulkEditCompany('');
    setBulkEditJobTitle('');
  };

  const handleOpenMergeModal = async () => {
    if (selectedIds.length < 2) {
      setActionResult({ type: 'Error', result: { success: 0, failed: 1, errors: [{ id: '', error: 'Select at least 2 contacts to merge' }] } });
      return;
    }
    if (selectedIds.length > 10) {
      setActionResult({ type: 'Error', result: { success: 0, failed: 1, errors: [{ id: '', error: 'Cannot merge more than 10 contacts' }] } });
      return;
    }

    setMergeLoading(true);
    try {
      const { data } = await api.post<ContactForMerge[]>('/contacts/bulk/find-duplicates', {
        contactIds: selectedIds,
      });
      setMergeContacts(data);
      setMasterContactId(data[0]?.id || null);
      setShowMergeModal(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load contacts for merge';
      setActionResult({ type: 'Error', result: { success: 0, failed: 1, errors: [{ id: '', error: message }] } });
    } finally {
      setMergeLoading(false);
    }
  };

  const handleBulkEdit = () => {
    const updates: { name?: string; email?: string; metadata?: Record<string, unknown> } = {};

    if (bulkEditName) updates.name = bulkEditName;
    if (bulkEditEmail) updates.email = bulkEditEmail;

    const metadata: Record<string, unknown> = {};
    if (bulkEditCompany) metadata.company = bulkEditCompany;
    if (bulkEditJobTitle) metadata.jobTitle = bulkEditJobTitle;
    if (Object.keys(metadata).length > 0) updates.metadata = metadata;

    if (Object.keys(updates).length === 0) {
      setActionResult({ type: 'Error', result: { success: 0, failed: 1, errors: [{ id: '', error: 'No fields to update' }] } });
      return;
    }

    bulkEditMutation.mutate(updates);
  };

  const handleMerge = () => {
    if (!masterContactId) return;
    const mergeIds = mergeContacts.filter(c => c.id !== masterContactId).map(c => c.id);
    mergeMutation.mutate({ masterContactId, mergeContactIds: mergeIds });
  };

  // Export Selected
  const handleExportSelected = async () => {
    try {
      const { data } = await api.post<{ content: string; filename: string }>('/contacts/bulk/export', {
        contactIds: selectedIds,
      });

      const blob = new Blob([data.content], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename || `contacts-export-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      setActionResult({ type: 'Error', result: { success: 0, failed: 1, errors: [{ id: '', error: message }] } });
    }
  };

  const isPending = addTagsMutation.isPending || removeTagsMutation.isPending ||
                    assignSessionMutation.isPending || deleteMutation.isPending ||
                    bulkEditMutation.isPending || mergeMutation.isPending ||
                    updateStatusMutation.isPending || mergeLoading;

  if (selectedIds.length === 0) return null;

  return (
    <>
      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border px-4 py-3 animate-slide-down">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Selection Info */}
          <div className="flex items-center gap-4">
            <button
              onClick={allSelected ? onClearSelection : onSelectAll}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>

            <div className="h-5 w-px bg-border" />

            <span className="text-sm font-medium text-foreground">
              {selectedIds.length} selected
              {allSelected && totalCount > selectedIds.length && (
                <span className="text-muted-foreground"> of {totalCount}</span>
              )}
            </span>

            <button
              onClick={onClearSelection}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Add Tags */}
            <div className="relative">
              <button
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                disabled={isPending}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all',
                  'bg-secondary hover:bg-accent text-foreground',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Tag className="w-4 h-4" />
                <span className="hidden sm:inline">Tags</span>
              </button>

              {showTagDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTagDropdown(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-card rounded-xl border border-border shadow-lg z-50 py-2 animate-scale-in">
                    <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Add Tags</p>
                    {tags.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground">No tags available</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto px-2">
                        {tags.map(tag => (
                          <button
                            key={tag.id}
                            onClick={() => addTagsMutation.mutate({ contactIds: selectedIds, tagIds: [tag.id] })}
                            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-accent transition-colors"
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="text-sm text-foreground">{tag.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Assign Session */}
            <div className="relative">
              <button
                onClick={() => setShowSessionDropdown(!showSessionDropdown)}
                disabled={isPending || connectedSessions.length === 0}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all',
                  'bg-secondary hover:bg-accent text-foreground',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                title={connectedSessions.length === 0 ? 'No connected sessions' : 'Assign session'}
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden sm:inline">Session</span>
              </button>

              {showSessionDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSessionDropdown(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-card rounded-xl border border-border shadow-lg z-50 py-2 animate-scale-in">
                    <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Assign to Session</p>
                    {connectedSessions.map(session => (
                      <button
                        key={session.id}
                        onClick={() => assignSessionMutation.mutate({ contactIds: selectedIds, sessionId: session.id })}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-accent transition-colors"
                      >
                        <div className="p-1.5 rounded-lg bg-[#00A884]/10">
                          <Smartphone className="w-3.5 h-3.5 text-[#00A884]" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-foreground">{session.name}</p>
                          {session.phoneNumber && (
                            <p className="text-xs text-muted-foreground">{session.phoneNumber}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Change Status */}
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={isPending}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all',
                  'bg-secondary hover:bg-accent text-foreground',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Status</span>
              </button>

              {showStatusDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowStatusDropdown(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-card rounded-xl border border-border shadow-lg z-50 py-2 animate-scale-in">
                    <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Change Status</p>
                    {Object.entries(LEAD_STATUSES).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => updateStatusMutation.mutate({ contactIds: selectedIds, status: key as LeadStatus })}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-accent transition-colors"
                        >
                          <Icon className="w-4 h-4" style={{ color: config.color }} />
                          <span className="text-sm text-foreground">{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Bulk Edit */}
            <button
              onClick={() => setShowBulkEditModal(true)}
              disabled={isPending}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all',
                'bg-secondary hover:bg-accent text-foreground',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </button>

            {/* Merge */}
            <button
              onClick={handleOpenMergeModal}
              disabled={isPending || selectedIds.length < 2 || selectedIds.length > 10}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all',
                'bg-primary/10 hover:bg-primary/20 text-primary',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title={selectedIds.length < 2 ? 'Select at least 2 contacts' : selectedIds.length > 10 ? 'Max 10 contacts' : 'Merge contacts'}
            >
              <GitMerge className="w-4 h-4" />
              <span className="hidden sm:inline">Merge</span>
            </button>

            {/* Export */}
            <button
              onClick={handleExportSelected}
              disabled={isPending}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all',
                'bg-secondary hover:bg-accent text-foreground',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Delete */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isPending}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all',
                'bg-red-500/10 hover:bg-red-500/20 text-red-500',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        {isPending && (
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-card rounded-xl border border-border shadow-lg p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-500/10">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">Delete {selectedIds.length} Contacts</h3>
                <p className="text-muted-foreground mt-1">
                  Are you sure you want to delete {selectedIds.length} contact{selectedIds.length !== 1 ? 's' : ''}?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(selectedIds)}
                disabled={deleteMutation.isPending}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg',
                  'bg-red-500 text-white hover:bg-red-600',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBulkEditModal(false)} />
          <div className="relative bg-card rounded-xl border border-border shadow-lg p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Edit3 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Bulk Edit</h3>
                  <p className="text-sm text-muted-foreground">{selectedIds.length} contacts selected</p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkEditModal(false)}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Leave fields empty to keep existing values. Filled fields will be applied to all selected contacts.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input
                  type="text"
                  value={bulkEditName}
                  onChange={(e) => setBulkEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Leave empty to keep existing"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={bulkEditEmail}
                  onChange={(e) => setBulkEditEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Leave empty to keep existing"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Company</label>
                <input
                  type="text"
                  value={bulkEditCompany}
                  onChange={(e) => setBulkEditCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Leave empty to keep existing"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Job Title</label>
                <input
                  type="text"
                  value={bulkEditJobTitle}
                  onChange={(e) => setBulkEditJobTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Leave empty to keep existing"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowBulkEditModal(false);
                  resetBulkEditForm();
                }}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkEdit}
                disabled={bulkEditMutation.isPending}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg',
                  'bg-primary text-white hover:bg-primary/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {bulkEditMutation.isPending ? 'Updating...' : 'Update All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Contacts Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMergeModal(false)} />
          <div className="relative bg-card rounded-xl border border-border shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <GitMerge className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Merge Contacts</h3>
                  <p className="text-sm text-muted-foreground">Select the master record to keep</p>
                </div>
              </div>
              <button
                onClick={() => setShowMergeModal(false)}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  <strong>Warning:</strong> The master contact will keep all conversations, tags, and data.
                  Other contacts will be deleted. This action cannot be undone.
                </p>
              </div>

              <div className="space-y-3">
                {mergeContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setMasterContactId(contact.id)}
                    className={cn(
                      'w-full p-4 rounded-xl border text-left transition-all',
                      masterContactId === contact.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="relative flex-shrink-0">
                        <div className="h-12 w-12 rounded-xl bg-slate-600 flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {contact.name?.charAt(0).toUpperCase() || contact.phone.slice(-2)}
                          </span>
                        </div>
                        {masterContactId === contact.id && (
                          <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5">
                            <Star className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">
                            {contact.name || 'No Name'}
                          </p>
                          {masterContactId === contact.id && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
                              Master
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{contact.phone}</p>
                        {contact.email && (
                          <p className="text-sm text-muted-foreground truncate">{contact.email}</p>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {contact.conversationCount} conversations
                          </span>
                          {contact.tags.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              {contact.tags.length} tags
                            </span>
                          )}
                          {contact.assignedSession && (
                            <span className="flex items-center gap-1">
                              <Smartphone className="w-3 h-3" />
                              {contact.assignedSession.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={cn(
                        'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center',
                        masterContactId === contact.id
                          ? 'border-primary bg-primary'
                          : 'border-border'
                      )}>
                        {masterContactId === contact.id && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-border bg-muted/50">
              <p className="text-sm text-muted-foreground">
                {mergeContacts.length - 1} contact{mergeContacts.length - 1 !== 1 ? 's' : ''} will be merged into the master
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMergeModal(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMerge}
                  disabled={mergeMutation.isPending || !masterContactId}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg',
                    'bg-primary text-white hover:bg-primary/90',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {mergeMutation.isPending ? 'Merging...' : 'Merge Contacts'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Result Toast */}
      {actionResult && (
        <div className="fixed bottom-4 right-4 z-[100] animate-slide-up">
          <div className="bg-card rounded-xl border border-border shadow-lg p-4 max-w-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{actionResult.type}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {actionResult.result.success} successful
                  {actionResult.result.failed > 0 && `, ${actionResult.result.failed} failed`}
                </p>
              </div>
              <button
                onClick={() => setActionResult(null)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
