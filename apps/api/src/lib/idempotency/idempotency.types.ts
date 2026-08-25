export type IdempotencyStatus =
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface IdempotencyRecord {
  status: IdempotencyStatus;
  createdAt: string;
  response?: unknown;
}