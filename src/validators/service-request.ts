import { z } from "zod/v4";

export const createServiceRequestSchema = z.object({
  subject: z.string().min(5, "Judul minimal 5 karakter").max(255, "Judul maksimal 255 karakter"),
  type: z.enum([
    "new_installation",
    "upgrade_downgrade",
    "trouble_ticket",
    "relocation",
    "unsubscribe",
  ]),
  customerId: z.coerce.number().positive().optional(),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  phone: z
    .string()
    .min(10, "No. telepon minimal 10 digit")
    .regex(/^08\d+$/, "Format: 08xxxxxxxxxx"),
  description: z.string().min(10, "Deskripsi minimal 10 karakter"),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export type CreateServiceRequestInput = z.infer<
  typeof createServiceRequestSchema
>;

export const updateServiceRequestSchema = z.object({
  status: z.enum([
    "open",
    "in_progress",
    "pending",
    "approved",
    "rejected",
    "resolved",
    "closed",
  ]),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  adminNotes: z.string().optional().or(z.literal("")),
});

export type UpdateServiceRequestInput = z.infer<
  typeof updateServiceRequestSchema
>;

export const ticketCommandSchema = z.object({
  command: z.enum(["eskalasi", "tutup", "tunda", "lanjut", "gangguan-massal"]),
  argument: z.string().optional(),
});

export type TicketCommandInput = z.infer<typeof ticketCommandSchema>;
