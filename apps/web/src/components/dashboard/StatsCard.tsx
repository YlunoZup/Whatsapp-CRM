import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  icon: React.ReactNode;
  color?: 'primary' | 'muted';
  className?: string;
}

export function StatsCard({ title, value, change, icon, color = 'primary', className }: StatsCardProps) {
  const colorConfig = {
    primary: {
      icon: 'bg-primary/10 text-primary',
    },
    muted: {
      icon: 'bg-muted text-muted-foreground',
    },
  };

  const config = colorConfig[color];

  return (
    <div
      className={cn(
        'group relative bg-card rounded-2xl border border-border/50 p-6',
        'transition-all duration-300 ease-out',
        'hover:border-border hover:shadow-lg',
        className
      )}
    >
      <div className="relative flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground tracking-wide">
            {title}
          </p>
          <p className="text-3xl font-bold text-foreground tracking-tight">
            {value}
          </p>
          {change && (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-sm font-medium',
                  change.type === 'increase' ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {change.type === 'increase' ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {Math.abs(change.value)}%
              </span>
              <span className="text-sm text-muted-foreground">vs last week</span>
            </div>
          )}
        </div>

        <div className={cn(
          'p-3 rounded-xl transition-transform duration-300 group-hover:scale-105',
          config.icon
        )}>
          {icon}
        </div>
      </div>
    </div>
  );
}
