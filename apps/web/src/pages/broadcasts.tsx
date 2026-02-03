import { useState } from 'react';
import {
  useBroadcasts,
  useBroadcastStats,
  useCreateBroadcast,
  useStartBroadcast,
  useCancelBroadcast,
  useDeleteBroadcast,
} from '../hooks/use-broadcasts';
import { useContacts } from '../hooks/use-contacts';
import { useSessions } from '../hooks/use-sessions';
import { useTags } from '../hooks/use-tags';
import { SimpleSelect } from '@/components/ui/CustomSelect';
import type { Contact, Tag } from '@whatsapp-crm/shared';

export function BroadcastsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [selectedBroadcast, setSelectedBroadcast] = useState<string | null>(null);

  // API hooks
  const { data: broadcastsData, isLoading } = useBroadcasts({ page, limit: 10, status: statusFilter || undefined });
  const { data: stats } = useBroadcastStats();
  const createBroadcast = useCreateBroadcast();
  const startBroadcast = useStartBroadcast();
  const cancelBroadcast = useCancelBroadcast();
  const deleteBroadcast = useDeleteBroadcast();

  const broadcasts = broadcastsData?.data || [];
  const pagination = broadcastsData?.pagination;

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sessionId: '',
    content: '',
    type: 'text' as const,
    contactIds: [] as string[],
    scheduledAt: '',
  });
  const [filterTag, setFilterTag] = useState<string>('');
  const [selectAll, setSelectAll] = useState(false);

  // Data for form
  const { data: sessions = [] } = useSessions();
  const { data: contactsData } = useContacts({ limit: 500 });
  const { data: tagsData } = useTags();

  const contacts = contactsData?.data || [];
  const tags = tagsData || [];

  const filteredContacts = filterTag
    ? contacts.filter((c: Contact) => c.tags?.some((t: Tag) => t.id === filterTag))
    : contacts;

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setFormData({
        ...formData,
        contactIds: filteredContacts.map((c: Contact) => c.id),
      });
    } else {
      setFormData({ ...formData, contactIds: [] });
    }
  };

  const handleContactToggle = (contactId: string) => {
    if (formData.contactIds.includes(contactId)) {
      setFormData({
        ...formData,
        contactIds: formData.contactIds.filter((id) => id !== contactId),
      });
    } else {
      setFormData({
        ...formData,
        contactIds: [...formData.contactIds, contactId],
      });
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sessionId || !formData.content || formData.contactIds.length === 0) {
      return;
    }

    try {
      await createBroadcast.mutateAsync({
        name: formData.name,
        sessionId: formData.sessionId,
        content: formData.content,
        type: formData.type,
        contactIds: formData.contactIds,
        scheduledAt: formData.scheduledAt || undefined,
      });
      setShowCreateModal(false);
      setFormData({
        name: '',
        sessionId: '',
        content: '',
        type: 'text',
        contactIds: [],
        scheduledAt: '',
      });
      setFilterTag('');
      setSelectAll(false);
    } catch (error) {
      console.error('Failed to create broadcast:', error);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await startBroadcast.mutateAsync(id);
    } catch (error) {
      console.error('Failed to start broadcast:', error);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelBroadcast.mutateAsync(id);
    } catch (error) {
      console.error('Failed to cancel broadcast:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteBroadcast.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete broadcast:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-muted text-foreground',
      scheduled: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
      processing: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
      completed: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
      failed: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
      cancelled: 'bg-muted text-muted-foreground',
    };
    return styles[status] || styles.pending;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Broadcasts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Send messages to multiple contacts at once
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Broadcast
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total Broadcasts</p>
            <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-semibold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Processing</p>
            <p className="text-2xl font-semibold text-yellow-600">{stats.processing}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Scheduled</p>
            <p className="text-2xl font-semibold text-blue-600">{stats.scheduled}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <SimpleSelect
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All Status' },
            { value: 'pending', label: 'Pending' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'processing', label: 'Processing' },
            { value: 'completed', label: 'Completed' },
            { value: 'failed', label: 'Failed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          className="w-48"
        />
      </div>

      {/* Broadcasts List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-4 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/4 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : broadcasts.length > 0 ? (
        <div className="space-y-4">
          {broadcasts.map((broadcast) => (
            <div key={broadcast.id} className="bg-card rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-foreground">{broadcast.name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${getStatusBadge(broadcast.status)}`}>
                      {broadcast.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{broadcast.content}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>Recipients: {broadcast.totalCount}</span>
                    <span className="text-green-600">Sent: {broadcast.sentCount}</span>
                    {broadcast.failedCount > 0 && (
                      <span className="text-red-600">Failed: {broadcast.failedCount}</span>
                    )}
                    <span>Created: {formatDate(broadcast.createdAt)}</span>
                    {broadcast.scheduledAt && (
                      <span className="text-blue-600">Scheduled: {formatDate(broadcast.scheduledAt)}</span>
                    )}
                  </div>

                  {/* Progress bar for processing broadcasts */}
                  {broadcast.status === 'processing' && broadcast.totalCount > 0 && (
                    <div className="mt-3">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-whatsapp-primary transition-all"
                          style={{
                            width: `${((broadcast.sentCount + broadcast.failedCount) / broadcast.totalCount) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.round(((broadcast.sentCount + broadcast.failedCount) / broadcast.totalCount) * 100)}% complete
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {broadcast.status === 'scheduled' && (
                    <button
                      onClick={() => handleStart(broadcast.id)}
                      disabled={startBroadcast.isPending}
                      className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                      title="Start now"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  )}
                  {(broadcast.status === 'pending' || broadcast.status === 'processing' || broadcast.status === 'scheduled') && (
                    <button
                      onClick={() => handleCancel(broadcast.id)}
                      disabled={cancelBroadcast.isPending}
                      className="p-2 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
                      title="Cancel"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  )}
                  {broadcast.status !== 'processing' && (
                    <button
                      onClick={() => setDeleteConfirm({ id: broadcast.id, name: broadcast.name })}
                      className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-lg border p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="font-medium text-foreground">No broadcasts yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Create your first broadcast to send messages to multiple contacts at once
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark transition-colors"
          >
            Create First Broadcast
          </button>
        </div>
      )}

      {/* Create Broadcast Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b p-4">
              <h3 className="text-lg font-semibold text-foreground">Create Broadcast</h3>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Broadcast Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Promotion Announcement"
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Send from Session
                </label>
                <SimpleSelect
                  value={formData.sessionId}
                  onChange={(value) => setFormData({ ...formData, sessionId: value })}
                  placeholder="Select a session"
                  options={sessions
                    .filter((s) => s.status === 'connected')
                    .map((session) => ({
                      value: session.id,
                      label: `${session.name}${session.phoneNumber ? ` (${session.phoneNumber})` : ''}`,
                    }))}
                  className="w-full"
                />
                {sessions.filter((s) => s.status === 'connected').length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    No connected sessions. Please connect a WhatsApp session first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Message
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Type your message here..."
                  rows={4}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Schedule (optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to send immediately
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">
                    Select Recipients ({formData.contactIds.length} selected)
                  </label>
                  <div className="flex items-center gap-4">
                    <SimpleSelect
                      value={filterTag}
                      onChange={(value) => {
                        setFilterTag(value);
                        setSelectAll(false);
                        setFormData({ ...formData, contactIds: [] });
                      }}
                      options={[
                        { value: '', label: 'All Tags' },
                        ...tags.map((tag) => ({
                          value: tag.id,
                          label: tag.name,
                        })),
                      ]}
                      className="text-sm"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-border text-whatsapp-primary focus:ring-whatsapp-primary"
                      />
                      Select All
                    </label>
                  </div>
                </div>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {filteredContacts.length > 0 ? (
                    filteredContacts.map((contact: Contact) => (
                      <label
                        key={contact.id}
                        className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={formData.contactIds.includes(contact.id)}
                          onChange={() => handleContactToggle(contact.id)}
                          className="rounded border-border text-whatsapp-primary focus:ring-whatsapp-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {contact.name || contact.phone}
                          </p>
                          <p className="text-xs text-muted-foreground">{contact.phone}</p>
                        </div>
                        {contact.tags && contact.tags.length > 0 && (
                          <div className="flex gap-1">
                            {contact.tags.slice(0, 2).map((tag: Tag) => (
                              <span
                                key={tag.id}
                                className="px-1.5 py-0.5 text-xs rounded"
                                style={{ backgroundColor: tag.color + '20', color: tag.color }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </label>
                    ))
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground text-center">
                      No contacts found
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    createBroadcast.isPending ||
                    !formData.name ||
                    !formData.sessionId ||
                    !formData.content ||
                    formData.contactIds.length === 0
                  }
                  className="px-4 py-2 text-sm bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50 transition-colors"
                >
                  {createBroadcast.isPending
                    ? 'Creating...'
                    : formData.scheduledAt
                    ? 'Schedule Broadcast'
                    : 'Send Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-card rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Broadcast</h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBroadcast.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteBroadcast.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
