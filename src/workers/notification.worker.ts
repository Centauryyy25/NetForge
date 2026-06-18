import { Worker } from "bullmq";
import { redisConnection } from "../lib/queue/connection";
import { NOTIFICATION_QUEUE, JOB_NAMES } from "../lib/queue/jobs";
import { sendWhatsApp, sendWhatsAppDocument } from "../lib/whatsapp";
import { markOverduePayments } from "../lib/billing/overdue";
import { getBillingConfig } from "../lib/settings";
import {
  buildBillingMessage,
  buildOverdueMessage,
  buildPaymentConfirmationMessage,
} from "../lib/billing/messages";

export const notificationWorker = new Worker(
  NOTIFICATION_QUEUE,
  async (job) => {
    console.log(`[Notification Worker] Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case JOB_NAMES.WHATSAPP_BILLING: {
        const { customerPhone, customerName, invoiceNumber, amount, periodMonth } = job.data;
        const { companyName } = await getBillingConfig();

        const message = buildBillingMessage({
          customerName,
          invoiceNumber,
          amount,
          periodMonth,
          companyName,
        });

        const result = await sendWhatsApp(customerPhone, message);
        return result;
      }

      case JOB_NAMES.WHATSAPP_OVERDUE_REMINDER: {
        const { customerPhone, customerName, invoiceNumber, amount, periodMonth } = job.data;
        const { companyName } = await getBillingConfig();

        const message = buildOverdueMessage({
          customerName,
          invoiceNumber,
          amount,
          periodMonth,
          companyName,
        });

        const result = await sendWhatsApp(customerPhone, message);
        return result;
      }

      case JOB_NAMES.WHATSAPP_PAYMENT_CONFIRMATION: {
        const { customerPhone, customerName, invoiceNumber, amount, periodMonth, paymentMethod } = job.data;
        const { companyName } = await getBillingConfig();

        const message = buildPaymentConfirmationMessage({
          customerName,
          invoiceNumber,
          amount,
          periodMonth,
          companyName,
          paymentMethod,
        });

        const result = await sendWhatsApp(customerPhone, message);
        return result;
      }

      case JOB_NAMES.WHATSAPP_RECEIPT: {
        const { customerPhone, caption, filename, fileBase64 } = job.data;
        const file = Buffer.from(fileBase64, "base64");

        const result = await sendWhatsAppDocument(
          customerPhone,
          caption,
          file,
          filename
        );
        return result;
      }

      case JOB_NAMES.MARK_OVERDUE: {
        const count = await markOverduePayments();
        console.log(`[Mark Overdue] Updated ${count} payments to overdue`);
        return { updatedCount: count };
      }

      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);
