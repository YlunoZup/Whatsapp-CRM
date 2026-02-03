import { useEffect, useState, useCallback } from 'react';
import { socketService } from '../../services/socket';

interface TypingUser {
  userId: string;
  conversationId: string;
  timestamp: number;
}

interface TypingIndicatorProps {
  conversationId: string;
  className?: string;
}

const TYPING_TIMEOUT = 3000; // 3 seconds

export function TypingIndicator({ conversationId, className = '' }: TypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());

  useEffect(() => {
    const handleTypingIndicator = (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (data.conversationId !== conversationId) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (data.isTyping) {
          next.set(data.userId, {
            userId: data.userId,
            conversationId: data.conversationId,
            timestamp: Date.now(),
          });
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    };

    socketService.on('typing_indicator', handleTypingIndicator);

    return () => {
      socketService.off('typing_indicator', handleTypingIndicator);
    };
  }, [conversationId]);

  // Clean up stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const next = new Map(prev);
        for (const [userId, data] of prev) {
          if (now - data.timestamp > TYPING_TIMEOUT) {
            next.delete(userId);
          }
        }
        return next.size !== prev.size ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (typingUsers.size === 0) return null;

  return (
    <div className={`flex justify-start mb-1 px-4 ${className}`}>
      <div className="relative max-w-[65%]">
        <div className="relative rounded-lg px-4 py-3 shadow-sm bg-white dark:bg-[#202C33]">
          {/* WhatsApp-style message tail */}
          <div className="absolute top-0 w-3 h-3 overflow-hidden -left-[6px]">
            <div className="absolute transform rotate-45 w-3 h-3 bg-white dark:bg-[#202C33] -right-[6px]" />
          </div>
          {/* Typing dots */}
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-[#667781] dark:bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-[#667781] dark:bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-[#667781] dark:bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for managing typing state in the input
export function useTypingIndicator(conversationId: string | null) {
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useState<NodeJS.Timeout | null>(null);

  const sendTypingStart = useCallback(() => {
    if (!conversationId) return;

    // Clear existing timeout
    if (timeoutRef[0]) {
      clearTimeout(timeoutRef[0]);
    }

    // Only send if not already typing
    if (!isTyping) {
      socketService.emit('typing', { conversationId, isTyping: true });
      setIsTyping(true);
    }

    // Set timeout to stop typing
    timeoutRef[0] = setTimeout(() => {
      socketService.emit('typing', { conversationId, isTyping: false });
      setIsTyping(false);
    }, 2000);
  }, [conversationId, isTyping, timeoutRef]);

  const sendTypingStop = useCallback(() => {
    if (!conversationId) return;

    if (timeoutRef[0]) {
      clearTimeout(timeoutRef[0]);
      timeoutRef[0] = null;
    }

    if (isTyping) {
      socketService.emit('typing', { conversationId, isTyping: false });
      setIsTyping(false);
    }
  }, [conversationId, isTyping, timeoutRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef[0]) {
        clearTimeout(timeoutRef[0]);
      }
      if (isTyping && conversationId) {
        socketService.emit('typing', { conversationId, isTyping: false });
      }
    };
  }, []);

  return {
    onKeyPress: sendTypingStart,
    onBlur: sendTypingStop,
    onMessageSent: sendTypingStop,
  };
}

// Alternative compact indicator with just dots
export function TypingDots({ className = '' }: { className?: string }) {
  return (
    <div className={`flex space-x-1 ${className}`}>
      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

// Inline typing indicator for use in message bubbles
export function TypingBubble({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-3 bg-muted rounded-2xl rounded-bl-md ${className}`}>
      <TypingDots />
    </div>
  );
}
