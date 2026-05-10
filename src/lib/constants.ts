export const APP_NAME = "SI YBY NET";
export const APP_DESCRIPTION = "Sistem Informasi YBY NET — Manajemen Pelanggan & Jaringan";

export const ROLES = {
  ADMIN: "admin",
  OPERATOR: "operator",
  TECHNICIAN: "technician",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const CUSTOMER_STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  TERMINATED: "terminated",
  PROVISIONING_FAILED: "provisioning_failed",
} as const;

export type CustomerStatus =
  (typeof CUSTOMER_STATUSES)[keyof typeof CUSTOMER_STATUSES];

export const PAYMENT_STATUSES = {
  PAID: "paid",
  PENDING: "pending",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

export const REQUEST_TYPES = {
  NEW_INSTALLATION: "new_installation",
  UPGRADE_DOWNGRADE: "upgrade_downgrade",
  TROUBLE_TICKET: "trouble_ticket",
  RELOCATION: "relocation",
  UNSUBSCRIBE: "unsubscribe",
} as const;

export type RequestType =
  (typeof REQUEST_TYPES)[keyof typeof REQUEST_TYPES];

export const REQUEST_STATUSES = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  APPROVED: "approved",
  REJECTED: "rejected",
  RESOLVED: "resolved",
  CLOSED: "closed",
} as const;

export type RequestStatus =
  (typeof REQUEST_STATUSES)[keyof typeof REQUEST_STATUSES];

export const PAYMENT_METHODS = [
  "cash",
  "transfer",
  "qris",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "Aktif",
  inactive: "Nonaktif",
  suspended: "Ditangguhkan",
  terminated: "Diputus",
  provisioning_failed: "Gagal Provisioning",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Lunas",
  pending: "Menunggu",
  overdue: "Tunggakan",
  cancelled: "Dibatalkan",
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  new_installation: "Pemasangan Baru",
  upgrade_downgrade: "Upgrade/Downgrade",
  trouble_ticket: "Gangguan",
  relocation: "Pindah Alamat",
  unsubscribe: "Berhenti Berlangganan",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  open: "Dibuka",
  in_progress: "Diproses",
  approved: "Disetujui",
  rejected: "Ditolak",
  resolved: "Selesai",
  closed: "Ditutup",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  operator: "Operator",
  technician: "Teknisi",
};
