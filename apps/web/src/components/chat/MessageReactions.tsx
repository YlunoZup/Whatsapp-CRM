import { useState } from 'react';
import { Plus, Smile } from 'lucide-react';
import {
  useReactions,
  useAddReaction,
  useRemoveReaction,
  ALLOWED_EMOJIS,
  type GroupedReactions,
} from '@/hooks/use-reactions';
import { useAuthStore } from '@/stores/auth-store';

interface MessageReactionsProps {
  messageId: string;
  reactions?: GroupedReactions;
  compact?: boolean;
}

export function MessageReactions({ messageId, reactions: initialReactions, compact }: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const { data: fetchedReactions } = useReactions(messageId);
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const reactions = fetchedReactions || initialReactions || {};
  const hasReactions = Object.keys(reactions).length > 0;

  const handleReaction = (emoji: string) => {
    const emojiReactions = reactions[emoji] || [];
    const hasReacted = emojiReactions.some((r) => r.userId === currentUserId);

    if (hasReacted) {
      removeReaction.mutate({ messageId, emoji });
    } else {
      addReaction.mutate({ messageId, emoji });
    }
    setShowPicker(false);
  };

  if (!hasReactions && compact) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {/* Existing reactions */}
      {Object.entries(reactions).map(([emoji, users]) => {
        const hasReacted = users.some((r) => r.userId === currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors ${
              hasReacted
                ? 'bg-primary/20 border border-primary/30'
                : 'bg-muted hover:bg-muted/80 border border-transparent'
            }`}
            title={users.map((u) => u.userName || 'Unknown').join(', ')}
          >
            <span>{emoji}</span>
            {users.length > 1 && (
              <span className="text-muted-foreground">{users.length}</span>
            )}
          </button>
        );
      })}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Add reaction"
        >
          {hasReactions ? (
            <Plus className="w-3.5 h-3.5" />
          ) : (
            <Smile className="w-4 h-4" />
          )}
        </button>

        {/* Emoji picker */}
        {showPicker && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowPicker(false)}
            />
            <div className="absolute bottom-full left-0 mb-1 z-50 bg-popover border rounded-lg shadow-lg p-2">
              <div className="flex gap-1 flex-wrap max-w-[200px]">
                {ALLOWED_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="p-1.5 hover:bg-muted rounded transition-colors text-lg"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Quick reaction bar shown on hover - WhatsApp style
export function QuickReactionBar({ messageId, onClose }: { messageId: string; onClose?: () => void }) {
  const addReaction = useAddReaction();
  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const handleReaction = (emoji: string) => {
    addReaction.mutate({ messageId, emoji });
    onClose?.();
  };

  return (
    <div className="flex items-center gap-0.5 bg-card rounded-lg shadow-md border border-border px-1.5 py-0.5">
      {quickEmojis.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          className="w-7 h-7 flex items-center justify-center hover:bg-muted rounded transition-colors text-base"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
