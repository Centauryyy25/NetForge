// WhatsApp message templates (Bahasa Indonesia). Pure functions so they can be
// unit-tested and reused by the notification worker.

const DEFAULT_COMPANY = "YBY NET";

export interface BillingMessageParams {
  customerName: string;
  invoiceNumber: string;
  amount: number;
  periodMonth: string;
  /** Nama perusahaan dari Settings; fallback ke "YBY NET" bila kosong. */
  companyName?: string;
  /** Hanya dipakai pada konfirmasi lunas. */
  paymentMethod?: string;
}

function brand(companyName?: string): string {
  return companyName?.trim() || DEFAULT_COMPANY;
}

function rupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

/** Pengingat tagihan untuk invoice yang masih menunggu pembayaran (pending). */
export function buildBillingMessage(p: BillingMessageParams): string {
  const company = brand(p.companyName);
  return (
    `Yth. ${p.customerName},\n\n` +
    `Ini adalah pengingat tagihan internet ${company} untuk periode ${p.periodMonth}.\n` +
    `No. Invoice: ${p.invoiceNumber}\n` +
    `Jumlah: ${rupiah(p.amount)}\n\n` +
    `Mohon segera selesaikan pembayaran untuk menghindari pemutusan jaringan. Abaikan jika sudah membayar.\n\n` +
    `— Admin ${company}`
  );
}

/** Pengingat tunggakan untuk invoice yang telah lewat jatuh tempo (overdue). */
export function buildOverdueMessage(p: BillingMessageParams): string {
  const company = brand(p.companyName);
  return (
    `Yth. ${p.customerName},\n\n` +
    `Tagihan internet ${company} Anda untuk periode ${p.periodMonth} telah melewati jatuh tempo.\n` +
    `No. Invoice: ${p.invoiceNumber}\n` +
    `Jumlah: ${rupiah(p.amount)}\n\n` +
    `Mohon segera selesaikan pembayaran untuk menghindari pemutusan layanan.\n\n` +
    `— Admin ${company}`
  );
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
};

/** Konfirmasi/terima kasih setelah pembayaran tercatat lunas. */
export function buildPaymentConfirmationMessage(p: BillingMessageParams): string {
  const company = brand(p.companyName);
  const method = p.paymentMethod ? METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod : null;
  return (
    `Yth. ${p.customerName},\n\n` +
    `Pembayaran internet ${company} untuk periode ${p.periodMonth} telah kami terima. Terima kasih.\n` +
    `No. Invoice: ${p.invoiceNumber}\n` +
    `Jumlah: ${rupiah(p.amount)}\n` +
    (method ? `Metode: ${method}\n` : "") +
    `\nSimpan pesan ini sebagai bukti pembayaran.\n\n` +
    `— Admin ${company}`
  );
}
