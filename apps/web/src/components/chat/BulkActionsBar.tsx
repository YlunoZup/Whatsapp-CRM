import { useState } from 'react';
import {
  X,
  CheckSquare,
  XCircle,
  UserPlus,
  Tag,
  AlertTriangle,
  Archive,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAgents } from '@/hooks/use-users';

interface BulkActionsBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  totalSelected: number;
}

export function BulkActionsBar({
  selectedIds,
  onClearSelection,
  totalSelected,
}: BulkActionsBarProps) {
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const queryClient = useQueryClient();
  const { data: agents } = useAgents();

  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: {
      ids: string[];
      status?: string;
      priority?: string;
      label?: string | null;
      assignedTo?: string | null;
    }) => {
      const { data: result } = await api.post('/conversations/bulk-update', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onClearSelection();
    },
  });

  const handleBulkClose = () => {
    bulkUpdateMutation.mutate({ ids: selectedIds, status: 'closed' });
  };

  const handleBulkReopen = () => {
    bulkUpdateMutation.mutate({ ids: selectedIds, status: 'open' });
  };

  const handleBulkAssign = (userId: string | null) => {
    bulkUpdateMutation.mutate({ ids: selectedIds, assignedTo: userId });
    setShowAssignDropdown(false);
  };

  const handleBulkPriority = (priority: string) => {
    bulkUpdateMutation.mutate({ ids: selectedIds, priority });
    setShowPriorityDropdown(false);
  };

  const handleBulkLabel = (label: string | null) => {
    bulkUpdateMutation.mutate({ ids: selectedIds, label });
    setShowLabelDropdown(false);
  };

  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-card border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4">
        {/* Selection info */}
        <div className="flex items-center gap-2 pr-4 border-r">
          <CheckSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {totalSelected} selected
          </span>
          <button
            onClick={onClearSelection}
            className="p-1 text-muted-foreground hover:text-foreground rounded"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Close */}
          <button
            onClick={handleBulkClose}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors"
            title="Close conversations"
          >
            <XCircle className="w-4 h-4" />
            Close
          </button>

          {/* Reopen */}
          <button
            onClick={handleBulkReopen}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors"
            title="Reopen conversations"
          >
            <Archive className="w-4 h-4" />
            Reopen
          </button>

          {/* Assign */}
          <div className="relative">
            <button
              onClick={() => setShowAssignDropdown(!showAssignDropdown)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors"
              title="Assign to agent"
            >
              <UserPlus className="w-4 h-4" />
              Assign
            </button>

            {showAssignDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAssignDropdown(false)}
                />
                <div className="absolute bottom-full left-0 mb-1 z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]">
                  <button
                    onClick={() => handleBulkAssign(null)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Unassign
                  </button>
                  {agents?.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => handleBulkAssign(agent.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      {agent.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Priority */}
          <div className="relative">
            <button
              onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors"
              title="Set priority"
            >
              <AlertTriangle className="w-4 h-4" />
              Priority
            </button>

            {showPriorityDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowPriorityDropdown(false)}
                />
                <div className="absolute bottom-full left-0 mb-1 z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[120px]">
                  {['urgent', 'high', 'normal', 'low'].map((p) => (
                    <button
                      key={p}
                      onClick={() => handleBulkPriority(p)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted capitalize"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Label */}
          <div className="relative">
            <button
              onClick={() => setShowLabelDropdown(!showLabelDropdown)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors"
              title="Add label"
            >
              <Tag className="w-4 h-4" />
              Label
            </button>

            {showLabelDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowLabelDropdown(false)}
                />
                <div className="absolute bottom-full left-0 mb-1 z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[120px]">
                  <button
                    onClick={() => handleBulkLabel(null)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Remove label
                  </button>
                  {['sales', 'support', 'billing', 'feedback', 'spam', 'vip'].map((l) => (
                    <button
                      key={l}
                      onClick={() => handleBulkLabel(l)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted capitalize"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {bulkUpdateMutation.isPending && (
          <div className="pl-4 border-l">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
