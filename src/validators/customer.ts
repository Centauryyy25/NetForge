import { z } from "zod/v4";

export const createCustomerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  address: z.string().min(5, "Alamat minimal 5 karakter"),
  phone: z
    .string()
    .min(10, "No. telepon minimal 10 digit")
    .max(15, "No. telepon maksimal 15 digit")
    .regex(/^08\d+$/, "Format: 08xxxxxxxxxx"),
  email: z.email("Email tidak valid").optional().or(z.literal("")),
  nik: z
    .string()
    .length(16, "NIK harus 16 digit")
    .regex(/^\d+$/, "NIK harus angka")
    .optional()
    .or(z.literal("")),
  packageId: z.coerce.number().positive("Pilih paket layanan"),
  pppoeUsername: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .regex(/^[a-zA-Z0-9_-]+$/, "Hanya huruf, angka, - dan _")
    .optional()
    .or(z.literal("")),
  onuSn: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  status: z.enum(["active", "inactive", "suspended", "terminated"]).optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
