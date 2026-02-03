import React, { useState } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useSessionHealth, type SessionHealthMetrics } from '../../hooks/use-sessions';

interface SessionHealthBarProps {
  sessionId: string;
  isConnected: boolean;
}

const HEALTH_STATUS_CONFIG: Record<
  SessionHealthMetrics['healthStatus'],
  { color: string; bgColor: string; label: string; icon: typeof CheckCircle }
> = {
  excellent: {
    color: 'text-green-500',
    bgColor: 'bg-green-500',
    label: 'Excellent',
    icon: CheckCircle,
  },
  good: {
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
    label: 'Good',
    icon: TrendingUp,
  },
  fair: {
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500',
    label: 'Fair',
    icon: Activity,
  },
  warning: {
    color: 'text-orange-500',
    bgColor: 'bg-orange-500',
    label: 'Warning',
    icon: AlertTriangle,
  },
  critical: {
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    label: 'Critical',
    icon: TrendingDown,
  },
};

export function SessionHealthBar({ sessionId, isConnected }: SessionHealthBarProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: health, isLoading, error } = useSessionHealth(sessionId, isConnected);

  if (!isConnected) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">Loading health...</span>
        </div>
      </div>
    );
  }

  if (error || !health) {
    return null;
  }

  const statusConfig = HEALTH_STATUS_CONFIG[health.healthStatus];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="mt-3 pt-3 border-t border-border">
      {/* Health Bar Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left hover:bg-accent/50 rounded-lg p-1.5 -m-1.5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
          <span className="text-xs font-medium text-foreground">
            Session Health
          </span>
          <span className={`text-xs font-semibold ${statusConfig.color}`}>
            {health.healthScore}%
          </span>
          <span className="text-[10px] text-muted-foreground">
            ({statusConfig.label})
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Health Progress Bar */}
      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${statusConfig.bgColor} transition-all duration-500`}
          style={{ width: `${health.healthScore}%` }}
        />
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Factor Breakdown */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Health Factors
            </div>
            {Object.entries(health.factors).map(([key, factor]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="text-foreground font-medium">
                      {factor.score}/{factor.max}
                    </span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden mt-0.5">
                    <div
                      className={`h-full transition-all duration-300 ${
                        factor.score / factor.max >= 0.7
                          ? 'bg-green-500'
                          : factor.score / factor.max >= 0.4
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${(factor.score / factor.max) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Today's Stats */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-accent/50 rounded p-1.5">
              <div className="text-muted-foreground">Messages Today</div>
              <div className="font-semibold text-foreground">
                {health.messagesToday} / {health.limits.maxMessagesPerDay}
              </div>
            </div>
            <div className="bg-accent/50 rounded p-1.5">
              <div className="text-muted-foreground">New Contacts</div>
              <div className="font-semibold text-foreground">
                {health.newContactsToday} / {health.limits.maxNewContactsPerDay}
              </div>
            </div>
            <div className="bg-accent/50 rounded p-1.5">
              <div className="text-muted-foreground">Reply Rate</div>
              <div className="font-semibold text-foreground">
                {health.replyRate}%
              </div>
            </div>
            <div className="bg-accent/50 rounded p-1.5">
              <div className="text-muted-foreground">Account Age</div>
              <div className="font-semibold text-foreground">
                {health.accountAgeDays} days
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {health.recommendations.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Recommendations
              </div>
              {health.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 text-[10px] text-muted-foreground"
                >
                  <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
