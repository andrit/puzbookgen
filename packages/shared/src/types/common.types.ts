/**
 * Shared utility types used across all packages
 */

/** Standard result type — avoids throwing for expected error cases */
export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E }

/** Pagination params for DB queries */
export interface PaginationParams {
  limit: number
  offset: number
}

/** Standard paginated response */
export interface PaginatedResult<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export const SCHEMA_VERSION = '1.0.0'
