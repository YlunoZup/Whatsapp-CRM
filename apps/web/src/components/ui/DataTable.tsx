import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (item: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: string[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  actions?: (item: T) => React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor = (item) => item.id || String(data.indexOf(item)),
  isLoading,
  emptyMessage = 'No data available',
  onRowClick,
  searchable,
  searchPlaceholder = 'Search...',
  searchKeys = [],
  pagination,
  actions,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const filteredData = useMemo(() => {
    if (!search || searchKeys.length === 0) return data;

    const searchLower = search.toLowerCase();
    return data.filter((item) =>
      searchKeys.some((key) => {
        const value = item[key];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchLower);
      })
    );
  }, [data, search, searchKeys]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortDirection]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 1;

  return (
    <div className="w-full">
      {/* Search */}
      {searchable && (
        <div className="p-4 border-b border-border/50">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full pl-12 pr-4 py-3 bg-secondary/50 border border-border rounded-xl',
                'text-foreground placeholder:text-muted-foreground/60',
                'transition-all duration-200 ease-out',
                'focus:outline-none focus:bg-background focus:border-primary/50 focus:ring-4 focus:ring-primary/10'
              )}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border/50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider',
                    column.sortable && 'cursor-pointer hover:text-foreground transition-colors select-none',
                    column.className
                  )}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {column.sortable && (
                      <span className={cn(
                        'flex flex-col',
                        sortKey === column.key ? 'text-primary' : 'text-muted-foreground/30'
                      )}>
                        <ChevronUp className={cn(
                          'w-3 h-3 -mb-1',
                          sortKey === column.key && sortDirection === 'asc' && 'text-primary'
                        )} />
                        <ChevronDown className={cn(
                          'w-3 h-3 -mt-1',
                          sortKey === column.key && sortDirection === 'desc' && 'text-primary'
                        )} />
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {actions && (
                <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {isLoading ? (
              [...Array(5)].map((_, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-5">
                      <div className="h-5 bg-muted/50 rounded-lg animate-pulse w-3/4" />
                    </td>
                  ))}
                  {actions && (
                    <td className="px-6 py-5">
                      <div className="h-5 bg-muted/50 rounded-lg animate-pulse w-1/2 ml-auto" />
                    </td>
                  )}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-6 py-16 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 text-muted-foreground/50" />
                    <p>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((item, index) => (
                <tr
                  key={keyExtractor(item)}
                  className={cn(
                    'transition-colors duration-150',
                    onRowClick && 'cursor-pointer hover:bg-accent/50',
                    index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('px-6 py-4', column.className)}
                    >
                      {column.render ? column.render(item) : item[column.key]}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-6 py-4 text-right">
                      {actions(item)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            Showing{' '}
            <span className="font-medium text-foreground">
              {(pagination.page - 1) * pagination.limit + 1}
            </span>
            {' '}to{' '}
            <span className="font-medium text-foreground">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>
            {' '}of{' '}
            <span className="font-medium text-foreground">{pagination.total}</span>
            {' '}results
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className={cn(
                'p-2 rounded-xl transition-all duration-200',
                'text-muted-foreground hover:text-foreground hover:bg-accent',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {[...Array(totalPages)].map((_, i) => {
              const page = i + 1;
              if (
                page === 1 ||
                page === totalPages ||
                Math.abs(page - pagination.page) <= 1
              ) {
                return (
                  <button
                    key={page}
                    onClick={() => pagination.onPageChange(page)}
                    className={cn(
                      'min-w-[40px] h-10 px-3 text-sm font-medium rounded-xl transition-all duration-200',
                      page === pagination.page
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    {page}
                  </button>
                );
              }
              if (Math.abs(page - pagination.page) === 2) {
                return (
                  <span key={page} className="px-2 text-muted-foreground">
                    ...
                  </span>
                );
              }
              return null;
            })}

            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page === totalPages}
              className={cn(
                'p-2 rounded-xl transition-all duration-200',
                'text-muted-foreground hover:text-foreground hover:bg-accent',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent'
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
