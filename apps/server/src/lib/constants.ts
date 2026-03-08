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
