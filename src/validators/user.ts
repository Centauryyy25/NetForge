import { z } from "zod/v4";

export const USER_ROLES = ["admin", "operator", "technician"] as const;

export const createUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  role: z.enum(USER_ROLES),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

const optionalPassword = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(8, "Password minimal 8 karakter").optional()
);

export const updateUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").optional(),
  email: z.email("Email tidak valid").optional(),
  password: optionalPassword,
  role: z.enum(USER_ROLES).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
