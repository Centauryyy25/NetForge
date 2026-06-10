import { z } from "zod/v4";

export const createPackageSchema = z.object({
  name: z.string().min(2, "Nama paket minimal 2 karakter"),
  speed: z.coerce.number().positive("Kecepatan harus > 0"),
  price: z.coerce.number().nonnegative("Harga tidak boleh negatif"),
  queueTarget: z
    .string()
    .regex(/^\d+[KMG]\/\d+[KMG]$/, "Format: upload/download (contoh: 20M/20M)")
    .optional()
    .or(z.literal("")),
  isActive: z.coerce.boolean().default(true),
});

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
