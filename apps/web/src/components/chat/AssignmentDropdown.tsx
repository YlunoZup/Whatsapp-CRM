import { useState, useRef, useEffect } from 'react';
import { UserPlus, Check, X, Loader2 } from 'lucide-react';
import { useAgents } from '@/hooks/use-users';
import { useAssignConversation } from '@/hooks/use-conversations';
import { cn } from '@/lib/utils';

interface AssignmentDropdownProps {
  conversationId: string;
  currentAssignee?: {
    id: string;
    name: string;
    avatarUrl?: string;
  } | null;
  onAssigned?: () => void;
  variant?: 'default' | 'compact';
}

export function AssignmentDropdown({
  conversationId,
  currentAssignee,
  onAssigned,
  variant = 'default',
}: AssignmentDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: agents, isLoading } = useAgents();
  const assignMutation = useAssignConversation();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAssign = async (userId: string | null) => {
    try {
      await assignMutation.mutateAsync({ id: conversationId, userId });
      setIsOpen(false);
      onAssigned?.();
    } catch (error) {
      console.error('Failed to assign conversation:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 text-sm rounded-lg transition-colors',
          variant === 'compact' ? 'w-full px-3 py-2' : 'px-3 py-1.5',
          currentAssignee
            ? 'bg-primary/10 text-primary hover:bg-primary/15'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}
      >
        {currentAssignee ? (
          <>
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
              {currentAssignee.name.charAt(0).toUpperCase()}
            </div>
            <span className={cn('truncate', variant === 'compact' ? 'flex-1 text-left' : 'max-w-[100px]')}>
              {currentAssignee.name}
            </span>
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4" />
            <span className={variant === 'compact' ? 'flex-1 text-left' : ''}>Assign</span>
          </>
        )}
      </button>

      {isOpen && (
        <div className={cn(
          'bg-card rounded-lg shadow-lg border border-border z-50 overflow-hidden',
          variant === 'compact' ? 'absolute left-0 right-0 mt-1' : 'absolute right-0 mt-1 w-56'
        )}>
          <div className="p-2 border-b border-border bg-muted/50">
            <p className="text-xs font-medium text-muted-foreground uppercase">Assign to</p>
          </div>

          {isLoading ? (
            <div className="p-4 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {/* Unassign option */}
              {currentAssignee && (
                <button
                  onClick={() => handleAssign(null)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 text-muted-foreground"
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </div>
                  <span>Unassign</span>
                </button>
              )}

              {/* Agent list */}
              {agents?.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleAssign(agent.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50',
                    currentAssignee?.id === agent.id && 'bg-primary/10'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    currentAssignee?.id === agent.id
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{agent.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                  </div>
                  {currentAssignee?.id === agent.id && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}

              {agents?.length === 0 && (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No agents available
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
