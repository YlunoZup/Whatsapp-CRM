import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
    />
  );
}

// Conversation list item skeleton
export function ConversationSkeleton() {
  return (
    <div className="flex items-center p-3 gap-3">
      <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

// Message bubble skeleton
export function MessageSkeleton({ isOutbound = false }: { isOutbound?: boolean }) {
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={cn(
          'rounded-lg p-3 max-w-[70%]',
          isOutbound ? 'bg-primary/20' : 'bg-muted'
        )}
      >
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
        <div className="flex justify-end mt-2">
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

// Contact card skeleton
export function ContactSkeleton() {
  return (
    <div className="p-4 border-b">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

// Card skeleton
export function CardSkeleton() {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

// Dashboard stats skeleton
export function DashboardStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// Chat header skeleton
export function ChatHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-b">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  );
}

// Full page loading skeleton
export function PageLoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <DashboardStatsSkeleton />
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRowSkeleton key={i} columns={4} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Conversation list skeleton (multiple items)
export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: count }).map((_, i) => (
        <ConversationSkeleton key={i} />
      ))}
    </div>
  );
}

// Messages list skeleton (chat view)
export function MessagesListSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4">
      <MessageSkeleton isOutbound={false} />
      <MessageSkeleton isOutbound={true} />
      <MessageSkeleton isOutbound={false} />
      <MessageSkeleton isOutbound={true} />
      <MessageSkeleton isOutbound={false} />
    </div>
  );
}

// Profile/detail panel skeleton
export function DetailPanelSkeleton() {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center mb-6">
        <Skeleton className="w-24 h-24 rounded-full mb-4" />
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
