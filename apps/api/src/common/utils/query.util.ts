type StringFilter = {
  contains?: string;
  mode?: 'default' | 'insensitive';
};

export class QueryUtil {
  /**
   * Build a case-insensitive search condition for multiple fields
   */
  static buildSearchCondition(
    search: string | undefined,
    fields: string[],
  ): StringFilter | undefined {
    if (!search || search.trim() === '') {
      return undefined;
    }

    const searchTerm = search.trim();

    return {
      contains: searchTerm,
      mode: 'insensitive',
    };
  }

  /**
   * Build OR conditions for searching across multiple fields
   */
  static buildMultiFieldSearch(
    search: string | undefined,
    fields: string[],
  ): object[] | undefined {
    if (!search || search.trim() === '') {
      return undefined;
    }

    const searchTerm = search.trim();

    return fields.map((field) => ({
      [field]: {
        contains: searchTerm,
        mode: 'insensitive' as const,
      },
    }));
  }

  /**
   * Build date range filter
   */
  static buildDateRangeFilter(
    startDate?: Date | string,
    endDate?: Date | string,
  ): { gte?: Date; lte?: Date } | undefined {
    if (!startDate && !endDate) {
      return undefined;
    }

    const filter: { gte?: Date; lte?: Date } = {};

    if (startDate) {
      filter.gte = new Date(startDate);
    }

    if (endDate) {
      filter.lte = new Date(endDate);
    }

    return filter;
  }

  /**
   * Build sorting configuration
   */
  static buildOrderBy(
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    defaultSort: { field: string; order: 'asc' | 'desc' } = {
      field: 'createdAt',
      order: 'desc',
    },
  ): { [key: string]: 'asc' | 'desc' } {
    const field = sortBy || defaultSort.field;
    const order = sortOrder || defaultSort.order;

    return { [field]: order };
  }

  /**
   * Build array filter for enum values
   */
  static buildEnumFilter<T>(
    value: T | T[] | undefined,
  ): T | { in: T[] } | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? { in: value } : undefined;
    }

    return value;
  }

  /**
   * Safe select with required fields
   */
  static buildSelect<T extends Record<string, boolean>>(
    fields: T,
    required: (keyof T)[] = [],
  ): T {
    const select = { ...fields };

    for (const field of required) {
      select[field] = true as any;
    }

    return select;
  }

  /**
   * Calculate offset for traditional pagination
   */
  static getOffset(page: number, limit: number): number {
    return Math.max(0, (page - 1) * limit);
  }

  /**
   * Parse comma-separated string to array
   */
  static parseArrayParam(param?: string): string[] | undefined {
    if (!param) {
      return undefined;
    }

    return param
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
}
