/**
 * Shared constants for the SellSnap server.
 */

/**
 * Purchase status values in the database.
 */
export const PURCHASE_STATUS = {
  COMPLETED: "completed",
  PENDING: "pending",
  FAILED: "failed",
} as const;

export type PurchaseStatus = (typeof PURCHASE_STATUS)[keyof typeof PURCHASE_STATUS];

export const MAX_DOWNLOAD_ATTEMPTS = 3;
export const DOWNLOAD_EXPIRY_HOURS = 2;
