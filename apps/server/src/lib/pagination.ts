/**
 * Shared pagination utilities for cursor-based pagination
 */

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function paginate<T extends { id: string }>(items: T[], take: number): PaginatedResult<T> {
  const hasMore = items.length > take;
  const paginatedItems = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? (paginatedItems.at(-1)?.id ?? null) : null;

  return { items: paginatedItems, nextCursor, hasMore };
}

export function parseLimit(limit?: number, maxLimit = 50): number {
  return Math.min(Math.max(1, limit || 10), maxLimit);
}
