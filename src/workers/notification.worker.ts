import { Worker } from "bullmq";
import { redisConnection } from "../lib/queue/connection";
import { NOTIFICATION_QUEUE, JOB_NAMES } from "../lib/queue/jobs";
import { sendWhatsApp } from "../lib/whatsapp";
import { markOverduePayments } from "../lib/billing/overdue";

export const notificationWorker = new Worker(
  NOTIFICATION_QUEUE,
  async (job) => {
    console.log(`[Notification Worker] Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case JOB_NAMES.WHATSAPP_BILLING: {
        const { customerPhone, customerName, invoiceNumber, amount, periodMonth } = job.data;

        const message = `Yth. ${customerName},\n\n` +
          `Ini adalah pengingat tagihan internet YBY NET untuk periode ${periodMonth}.\n` +
          `No. Invoice: ${invoiceNumber}\n` +
          `Jumlah: Rp ${amount.toLocaleString("id-ID")}\n\n` +
          `Mohon segera selesaikan pembayaran untuk menghindari pemutusan jaringan. Abaikan jika sudah membayar.\n\n` +
          `— Admin YBY NET`;

        const result = await sendWhatsApp(customerPhone, message);
        return result;
      }

      case JOB_NAMES.WHATSAPP_OVERDUE_REMINDER: {
        const { customerPhone, customerName, invoiceNumber, amount, periodMonth } = job.data;

        const message = `Yth. ${customerName},\n\n` +
          `Tagihan internet YBY NET Anda untuk periode ${periodMonth} telah melewati jatuh tempo.\n` +
          `No. Invoice: ${invoiceNumber}\n` +
          `Jumlah: Rp ${amount.toLocaleString("id-ID")}\n\n` +
          `Mohon segera selesaikan pembayaran untuk menghindari pemutusan layanan.\n\n` +
          `— Admin YBY NET`;

        const result = await sendWhatsApp(customerPhone, message);
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
