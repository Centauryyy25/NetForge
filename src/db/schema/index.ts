// ══════════════════════════════════════════
// Schema Index — Re-exports all tables, enums, and relations
// Used by: drizzle.config.ts, db/index.ts, API routes
// ══════════════════════════════════════════

// Tables
export { users } from "./users";
export { packages } from "./packages";
export { customers } from "./customers";
export { payments } from "./payments";
export { serviceRequests } from "./service-requests";
export { activityLogs } from "./activity-logs";
export { settings } from "./settings";
export { counters } from "./counters";

// Enums
export { userRoleEnum } from "./users";
export { customerStatusEnum } from "./customers";
export { paymentStatusEnum } from "./payments";
export { requestTypeEnum, requestStatusEnum } from "./service-requests";

// Relations
export {
  usersRelations,
  packagesRelations,
  customersRelations,
  paymentsRelations,
  serviceRequestsRelations,
  activityLogsRelations,
} from "./relations";
