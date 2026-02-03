import React from 'react';
import { useSessions } from '../../hooks/use-sessions';

interface SessionsOverviewProps {
  onManageSessions?: () => void;
}

export function SessionsOverview({ onManageSessions }: SessionsOverviewProps) {
  const { data, isLoading } = useSessions();

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-5">
        <h3 className="text-base font-semibold text-foreground mb-4">WhatsApp Sessions</h3>
        <div className="animate-pulse space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-muted rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const sessions = data || [];
  const connectedCount = sessions.filter((s) => s.status === 'connected').length;
  const totalCount = sessions.length;

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">WhatsApp Sessions</h3>
        <button
          onClick={onManageSessions}
          className="text-sm text-[#00A884] hover:text-[#008069] font-medium"
        >
          Manage
        </button>
      </div>

      {totalCount === 0 ? (
        <div className="text-center py-6">
          <div className="w-14 h-14 mx-auto mb-3 bg-[#00A884]/10 rounded-full flex items-center justify-center">
            <svg
              className="w-7 h-7 text-[#00A884]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>
          <p className="text-[#667781] dark:text-[#8696A0] text-sm">No sessions configured</p>
          <button
            onClick={onManageSessions}
            className="mt-3 px-4 py-2 bg-[#00A884] hover:bg-[#008069] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Add your first session
          </button>
        </div>
      ) : (
        <>
          {/* Status overview - WhatsApp style circular progress */}
          <div className="flex items-center justify-center mb-4 py-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-[#F0F2F5] dark:border-[#202C33] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {connectedCount}
                  </div>
                  <div className="text-[10px] text-[#667781] dark:text-[#8696A0] uppercase">of {totalCount}</div>
                </div>
              </div>
              {/* Progress ring */}
              <svg className="absolute inset-0 w-20 h-20 -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="38"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="text-[#00A884]"
                  strokeDasharray={`${(connectedCount / (totalCount || 1)) * 239} 239`}
                />
              </svg>
            </div>
          </div>

          {/* Sessions list */}
          <div className="space-y-2">
            {sessions.slice(0, 4).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#F0F2F5] dark:bg-[#202C33]"
              >
                <div className="flex items-center space-x-2.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      session.status === 'connected'
                        ? 'bg-[#00A884]'
                        : session.status === 'connecting'
                        ? 'bg-[#FFB340]'
                        : 'bg-[#8696A0]'
                    }`}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {session.name}
                  </span>
                </div>
                <span className={`text-xs font-medium capitalize ${
                  session.status === 'connected'
                    ? 'text-[#00A884]'
                    : session.status === 'connecting'
                    ? 'text-[#FFB340]'
                    : 'text-[#8696A0]'
                }`}>
                  {session.status}
                </span>
              </div>
            ))}
          </div>

          {sessions.length > 4 && (
            <p className="mt-3 text-center text-xs text-[#667781] dark:text-[#8696A0]">
              +{sessions.length - 4} more sessions
            </p>
          )}
        </>
      )}
    </div>
  );
}
