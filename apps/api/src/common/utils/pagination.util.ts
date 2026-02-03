export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class PaginationUtil {
  static readonly DEFAULT_PAGE = 1;
  static readonly DEFAULT_LIMIT = 20;
  static readonly MAX_LIMIT = 100;

  static normalize(params: PaginationParams): { skip: number; take: number; page: number; limit: number } {
    const page = Math.max(1, params.page || this.DEFAULT_PAGE);
    const limit = Math.min(
      this.MAX_LIMIT,
      Math.max(1, params.limit || this.DEFAULT_LIMIT),
    );
    const skip = (page - 1) * limit;

    return { skip, take: limit, page, limit };
  }

  static paginate<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  static getPrismaArgs(params: PaginationParams): { skip: number; take: number } {
    const { skip, take } = this.normalize(params);
    return { skip, take };
  }
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: 'forward' | 'backward';
}

export interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  previousCursor: string | null;
  hasMore: boolean;
}

export class CursorPaginationUtil {
  static readonly DEFAULT_LIMIT = 20;
  static readonly MAX_LIMIT = 100;

  static normalize(params: CursorPaginationParams): { cursor?: string; take: number } {
    const limit = Math.min(
      this.MAX_LIMIT,
      Math.max(1, params.limit || this.DEFAULT_LIMIT),
    );

    return {
      cursor: params.cursor,
      take: limit + 1, // Fetch one extra to check if there's more
    };
  }

  static paginate<T extends { id: string }>(
    data: T[],
    limit: number,
  ): CursorPaginatedResult<T> {
    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;

    const lastItem = items[items.length - 1];
    const firstItem = items[0];

    return {
      data: items,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      previousCursor: firstItem ? firstItem.id : null,
      hasMore,
    };
  }
}
