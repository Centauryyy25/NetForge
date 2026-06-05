import { z } from "zod/v4";

export const createPaymentSchema = z.object({
  customerId: z.coerce.number().positive("Pilih pelanggan"),
  amount: z.coerce.number().positive("Jumlah bayar harus > 0"),
  paymentDate: z.string().min(1, "Tanggal bayar wajib diisi"),
  paymentMethod: z.enum(["cash", "transfer", "qris"]),
  periodMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM"),
  notes: z.string().optional().or(z.literal("")),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const updatePaymentSchema = z.object({
  status: z.enum(["paid", "pending", "overdue", "cancelled"]).optional(),
  paymentMethod: z.enum(["cash", "transfer", "qris"]).optional(),
  paymentDate: z.string().optional(),
  notes: z.string().optional().or(z.literal("")),
});

export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
