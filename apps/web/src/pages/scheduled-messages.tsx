import { useState } from 'react';
import { format } from 'date-fns';
import { Clock, Plus, X, Send, AlertCircle, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { SimpleSelect } from '@/components/ui/CustomSelect';
import {
  useScheduledMessages,
  useCreateScheduledMessage,
  useCancelScheduledMessage,
  useDeleteScheduledMessage,
  type ScheduledMessage,
} from '@/hooks/use-scheduled-messages';
import { useSessions } from '@/hooks/use-sessions';
import { DataTable } from '@/components/ui/DataTable';

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950', label: 'Pending' },
  sent: { icon: CheckCircle, color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950', label: 'Sent' },
  failed: { icon: XCircle, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950', label: 'Failed' },
  cancelled: { icon: X, color: 'text-muted-foreground bg-muted', label: 'Cancelled' },
};

function StatusBadge({ status }: { status: ScheduledMessage['status'] }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function CreateScheduledMessageModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    sessionId: '',
    contactPhone: '',
    content: '',
    scheduledFor: '',
    scheduledTime: '',
  });
  const { data: sessions } = useSessions();
  const createMutation = useCreateScheduledMessage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const scheduledDateTime = new Date(`${formData.scheduledFor}T${formData.scheduledTime}`);

    try {
      await createMutation.mutateAsync({
        sessionId: formData.sessionId,
        contactPhone: formData.contactPhone,
        content: formData.content,
        scheduledFor: scheduledDateTime.toISOString(),
      });
      onClose();
      setFormData({
        sessionId: '',
        contactPhone: '',
        content: '',
        scheduledFor: '',
        scheduledTime: '',
      });
    } catch (error) {
      console.error('Failed to create scheduled message:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Schedule New Message</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded" aria-label="Close dialog">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              WhatsApp Session
            </label>
            <SimpleSelect
              value={formData.sessionId}
              onChange={(value) => setFormData({ ...formData, sessionId: value })}
              options={sessions?.map((session) => ({
                value: session.id,
                label: `${session.name} (${session.phoneNumber || 'No number'})`,
              })) || []}
              placeholder="Select a session"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Recipient Phone Number
            </label>
            <input
              type="text"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              placeholder="+1234567890"
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Message
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              placeholder="Type your message..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Date
              </label>
              <input
                type="date"
                value={formData.scheduledFor}
                onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Time
              </label>
              <input
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              Schedule Message
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ScheduledMessagesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading } = useScheduledMessages({ status: statusFilter || undefined });
  const cancelMutation = useCancelScheduledMessage();
  const deleteMutation = useDeleteScheduledMessage();

  const columns = [
    {
      key: 'contactPhone',
      header: 'Recipient',
      cell: (row: ScheduledMessage) => (
        <span className="font-medium">{row.contactPhone}</span>
      ),
    },
    {
      key: 'content',
      header: 'Message',
      cell: (row: ScheduledMessage) => (
        <span className="text-sm text-muted-foreground truncate max-w-xs block">
          {row.content}
        </span>
      ),
    },
    {
      key: 'scheduledFor',
      header: 'Scheduled For',
      cell: (row: ScheduledMessage) => (
        <span className="text-sm">
          {format(new Date(row.scheduledFor), 'MMM d, yyyy h:mm a')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: ScheduledMessage) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      cell: (row: ScheduledMessage) => (
        <div className="flex items-center gap-2">
          {row.status === 'pending' && (
            <button
              onClick={() => cancelMutation.mutate(row.id)}
              className="p-1 text-muted-foreground hover:text-yellow-600 rounded"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {(row.status === 'cancelled' || row.status === 'failed') && (
            <button
              onClick={() => deleteMutation.mutate(row.id)}
              className="p-1 text-muted-foreground hover:text-red-600 rounded"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {row.status === 'failed' && row.error && (
            <span className="text-xs text-red-500 dark:text-red-400" title={row.error}>
              <AlertCircle className="w-4 h-4" />
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scheduled Messages</h1>
          <p className="text-muted-foreground mt-1">Schedule messages to be sent at a specific time</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Schedule Message
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <SimpleSelect
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'sent', label: 'Sent' },
            { value: 'failed', label: 'Failed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          placeholder="All statuses"
        />
      </div>

      {/* Table */}
      <DataTable
        data={data?.data || []}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No scheduled messages found"
      />

      {/* Create Modal */}
      <CreateScheduledMessageModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
