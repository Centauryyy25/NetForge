// Job Types and Constants

// Queue Names
export const MIKROTIK_QUEUE = "mikrotik-queue";
export const NOTIFICATION_QUEUE = "notification-queue";

// Job Names
export const JOB_NAMES = {
  // MikroTik Jobs
  CREATE_PPPOE: "create-pppoe",
  SUSPEND_PPPOE: "suspend-pppoe",
  ACTIVATE_PPPOE: "activate-pppoe",
  DELETE_PPPOE: "delete-pppoe",
  SET_QUEUE: "set-queue",
  DELETE_QUEUE: "delete-queue",
  
  // Notification Jobs
  WHATSAPP_BILLING: "whatsapp-billing",
  WHATSAPP_OVERDUE_REMINDER: "whatsapp-overdue-reminder",
  WHATSAPP_PAYMENT_CONFIRMATION: "whatsapp-payment-confirmation",
  WHATSAPP_RECEIPT: "whatsapp-receipt",
  MARK_OVERDUE: "mark-overdue",
} as const;

// Types
export interface BaseJobData {
  requestId?: string;
  triggeredBy?: number; 
}

export interface CreatePPPoEJob extends BaseJobData {
  customerId: number;
  username: string;
  password: string;
  profile: string;
}

export interface SuspendPPPoEJob extends BaseJobData {
  username: string;
}

export interface ActivatePPPoEJob extends BaseJobData {
  username: string;
}

export interface DeletePPPoEJob extends BaseJobData {
  username: string;
}

export interface SetQueueJob extends BaseJobData {
  name: string;
  target: string;
  maxLimit: string;
}

export interface DeleteQueueJob extends BaseJobData {
  name: string;
}

export interface WhatsAppBillingJob extends BaseJobData {
  customerPhone: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  periodMonth: string;
}

export interface WhatsAppOverdueReminderJob extends BaseJobData {
  customerPhone: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  periodMonth: string;
  dueDay: number;
}

export interface WhatsAppPaymentConfirmationJob extends BaseJobData {
  customerPhone: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  periodMonth: string;
  paymentMethod?: string;
}

export interface WhatsAppReceiptJob extends BaseJobData {
  customerPhone: string;
  caption: string;
  filename: string;
  /** Receipt PDF encoded as base64 (passed through Redis). */
  fileBase64: string;
}

export type MarkOverdueJob = BaseJobData;
