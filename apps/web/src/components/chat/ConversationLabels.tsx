import { useState } from 'react';
import { Tag, ChevronDown, AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent', icon: AlertTriangle, color: 'text-red-600 bg-red-100 dark:bg-red-950 dark:text-red-400' },
  { value: 'high', label: 'High', icon: ArrowUp, color: 'text-orange-600 bg-orange-100 dark:bg-orange-950 dark:text-orange-400' },
  { value: 'normal', label: 'Normal', icon: Minus, color: 'text-blue-600 bg-blue-100 dark:bg-blue-950 dark:text-blue-400' },
  { value: 'low', label: 'Low', icon: ArrowDown, color: 'text-muted-foreground bg-muted/50' },
];

const PRESET_LABELS = [
  { value: 'sales', label: 'Sales', color: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400' },
  { value: 'support', label: 'Support', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400' },
  { value: 'billing', label: 'Billing', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400' },
  { value: 'feedback', label: 'Feedback', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-400' },
  { value: 'spam', label: 'Spam', color: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400' },
  { value: 'vip', label: 'VIP', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400' },
];

interface ConversationLabelsProps {
  conversationId: string;
  currentPriority?: string;
  currentLabel?: string | null;
}

export function ConversationLabels({
  conversationId,
  currentPriority = 'normal',
  currentLabel,
}: ConversationLabelsProps) {
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (data: { priority?: string; label?: string | null }) => {
      const { data: result } = await api.patch(`/conversations/${conversationId}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const currentPriorityConfig = PRIORITIES.find((p) => p.value === currentPriority) || PRIORITIES[2];
  const currentLabelConfig = PRESET_LABELS.find((l) => l.value === currentLabel);

  const handlePriorityChange = (priority: string) => {
    updateMutation.mutate({ priority });
    setShowPriorityDropdown(false);
  };

  const handleLabelChange = (label: string | null) => {
    updateMutation.mutate({ label });
    setShowLabelDropdown(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Priority dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${currentPriorityConfig.color}`}
        >
          <currentPriorityConfig.icon className="w-3 h-3" />
          {currentPriorityConfig.label}
          <ChevronDown className="w-3 h-3" />
        </button>

        {showPriorityDropdown && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowPriorityDropdown(false)}
            />
            <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[120px]">
              {PRIORITIES.map((priority) => {
                const Icon = priority.icon;
                return (
                  <button
                    key={priority.value}
                    onClick={() => handlePriorityChange(priority.value)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted ${
                      currentPriority === priority.value ? 'bg-muted' : ''
                    }`}
                  >
                    <Icon className={`w-3 h-3 ${priority.color.split(' ')[0]}`} />
                    {priority.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Label dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowLabelDropdown(!showLabelDropdown)}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
            currentLabelConfig
              ? currentLabelConfig.color
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <Tag className="w-3 h-3" />
          {currentLabelConfig?.label || 'Add Label'}
          <ChevronDown className="w-3 h-3" />
        </button>

        {showLabelDropdown && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowLabelDropdown(false)}
            />
            <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[120px]">
              {currentLabel && (
                <button
                  onClick={() => handleLabelChange(null)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted text-muted-foreground"
                >
                  Remove Label
                </button>
              )}
              {PRESET_LABELS.map((label) => (
                <button
                  key={label.value}
                  onClick={() => handleLabelChange(label.value)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted ${
                    currentLabel === label.value ? 'bg-muted' : ''
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${label.color.split(' ')[0]}`} />
                  {label.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Priority badge for display
export function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITIES.find((p) => p.value === priority) || PRIORITIES[2];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// Label badge for display
export function LabelBadge({ label }: { label: string }) {
  const config = PRESET_LABELS.find((l) => l.value === label);
  if (!config) return null;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded ${config.color}`}>
      {config.label}
    </span>
  );
}
