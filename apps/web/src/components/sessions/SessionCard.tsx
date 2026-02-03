import React from 'react';
import { Users, ScrollText } from 'lucide-react';
import type { WhatsappSession } from '@whatsapp-crm/shared';
import { SessionHealthBar } from './SessionHealthBar';

interface SessionCardProps {
  session: WhatsappSession;
  isConnecting?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
  onShowQR: () => void;
  onShowLogs: () => void;
}

export function SessionCard({
  session,
  isConnecting,
  onConnect,
  onDisconnect,
  onDelete,
  onShowQR,
  onShowLogs,
}: SessionCardProps) {
  // WhatsApp-inspired status colors
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'connected':
        return { color: 'bg-[#00A884]', text: 'Connected', textColor: 'text-[#00A884]', dot: 'bg-[#00A884]' };
      case 'connecting':
        return { color: 'bg-[#FFB340]', text: 'Connecting...', textColor: 'text-[#FFB340]', dot: 'bg-[#FFB340]' };
      case 'disconnected':
        return { color: 'bg-[#8696A0]', text: 'Disconnected', textColor: 'text-[#8696A0]', dot: 'bg-[#8696A0]' };
      case 'qr_pending':
        return { color: 'bg-[#53BDEB]', text: 'Scan QR Code', textColor: 'text-[#53BDEB]', dot: 'bg-[#53BDEB]' };
      default:
        return { color: 'bg-[#8696A0]', text: status, textColor: 'text-[#8696A0]', dot: 'bg-[#8696A0]' };
    }
  };

  const statusConfig = getStatusConfig(session.status);

  return (
    <div className="relative bg-card rounded-xl shadow-sm border border-border p-5 hover:shadow-md transition-all hover:border-[#00A884]/30 overflow-hidden">
      {/* Status indicator bar at top */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${statusConfig.color}`} />

      <div className="flex items-start justify-between relative">
        <div className="flex items-center space-x-4">
          {/* WhatsApp-style icon with status indicator */}
          <div className="relative">
            <div className="w-14 h-14 bg-[#00A884] rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            {/* Status dot */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 ${statusConfig.dot} rounded-full border-2 border-card`} />
          </div>

          <div>
            <h3 className="font-semibold text-[17px] text-foreground">{session.name}</h3>
            <p className="text-sm text-[#667781] dark:text-[#8696A0]">
              {session.phoneNumber || 'No phone number yet'}
            </p>
            <span className={`text-xs font-medium ${statusConfig.textColor}`}>
              {statusConfig.text}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Logs button */}
          <button
            onClick={onShowLogs}
            className="p-2 text-[#8696A0] hover:text-[#00A884] hover:bg-[#00A884]/10 rounded-full transition-colors"
            aria-label="View session logs"
            title="View logs"
          >
            <ScrollText className="w-5 h-5" />
          </button>

          {/* Delete button */}
          <button
            onClick={onDelete}
            className="p-2 text-[#8696A0] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors"
            aria-label="Delete session"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Contact count badge */}
      {session._count && session._count.assignedContacts > 0 && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{session._count.assignedContacts} contact{session._count.assignedContacts !== 1 ? 's' : ''} assigned</span>
        </div>
      )}

      {/* Session Health Bar */}
      <SessionHealthBar
        sessionId={session.id}
        isConnected={session.status === 'connected'}
      />

      {/* Actions */}
      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
        <div className="text-xs text-[#667781] dark:text-[#8696A0]">
          Created {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'Unknown'}
        </div>

        <div className="flex items-center space-x-2">
          {session.status === 'disconnected' && (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="px-4 py-2 text-sm bg-[#00A884] hover:bg-[#008069] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 font-medium"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </button>
          )}

          {(session.status === 'qr_pending' || session.status === 'connecting') && (
            <button
              onClick={onShowQR}
              className="px-4 py-2 text-sm bg-[#53BDEB] hover:bg-[#027EB5] text-white rounded-lg transition-colors font-medium"
            >
              Show QR
            </button>
          )}

          {session.status === 'connected' && (
            <button
              onClick={onDisconnect}
              className="px-4 py-2 text-sm bg-[#F0F2F5] dark:bg-[#202C33] text-[#667781] dark:text-[#8696A0] hover:bg-[#E4E6EB] dark:hover:bg-[#2A3942] rounded-lg transition-colors font-medium"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
