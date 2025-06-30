/**
 * Pagination parameters for requests
 */
export interface PaginationDto {
  /** Number of items per page (default: 20, max: 100) */
  limit: number;

  /** Offset from the beginning */
  offset: number;
}

/**
 * Cursor-based pagination parameters
 */
export interface CursorPaginationDto {
  /** Number of items per page */
  limit: number;

  /** Cursor for the next page */
  cursor?: string;

  /** Direction of pagination */
  direction?: 'forward' | 'backward';
}

/**
 * Pagination metadata for responses
 */
export interface PaginationMetaDto {
  /** Current page number (1-based) */
  currentPage: number;

  /** Total number of pages */
  totalPages: number;

  /** Total number of items across all pages */
  totalItems: number;

  /** Number of items per page */
  itemsPerPage: number;

  /** Number of items in current page */
  itemsInCurrentPage: number;

  /** Whether there is a next page */
  hasNextPage: boolean;

  /** Whether there is a previous page */
  hasPreviousPage: boolean;

  /** URL or cursor for next page */
  nextPage?: string;

  /** URL or cursor for previous page */
  previousPage?: string;
}

/**
 * Sort parameters
 */
export interface SortDto {
  /** Field to sort by */
  field: string;

  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Combined pagination and sorting parameters
 */
export interface PagedAndSortedRequestDto {
  pagination: PaginationDto;
  sort?: SortDto[];
}

/**
 * Utility functions for pagination
 */
export class PaginationUtils {
  static readonly DEFAULT_LIMIT = 20;
  static readonly MAX_LIMIT = 100;

  /**
   * Validates and normalizes pagination parameters
   */
  static normalizePagination(params: Partial<PaginationDto>): PaginationDto {
    const limit = Math.min(
      Math.max(params.limit || this.DEFAULT_LIMIT, 1),
      this.MAX_LIMIT
    );

    const offset = Math.max(params.offset || 0, 0);

    return { limit, offset };
  }

  /**
   * Calculates pagination metadata
   */
  static calculateMeta(
    totalItems: number,
    pagination: PaginationDto,
    currentItemCount: number
  ): PaginationMetaDto {
    const { limit, offset } = pagination;
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalItems / limit);

    return {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage: limit,
      itemsInCurrentPage: currentItemCount,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      nextPage: currentPage < totalPages ? String(offset + limit) : undefined,
      previousPage:
        currentPage > 1 ? String(Math.max(0, offset - limit)) : undefined,
    };
  }

  /**
   * Creates a cursor from an offset
   */
  static createCursor(offset: number): string {
    return Buffer.from(String(offset)).toString('base64');
  }

  /**
   * Parses a cursor to get the offset
   */
  static parseCursor(cursor: string): number {
    try {
      return parseInt(Buffer.from(cursor, 'base64').toString(), 10) || 0;
    } catch {
      return 0;
    }
  }
}
