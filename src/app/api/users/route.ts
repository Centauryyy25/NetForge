import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { createUserSchema } from "@/validators/user";
import { requireRole } from "@/lib/auth-guard";
import { withErrorHandler } from "@/lib/api-handler";

const userColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export const GET = withErrorHandler(async () => {
  await requireRole(["admin"]);

  const data = await db
    .select(userColumns)
    .from(users)
    .orderBy(users.createdAt);

  return NextResponse.json({ data });
});

export const POST = withErrorHandler(async (req) => {
  await requireRole(["admin"]);

  const body = await req.json();
  const result = createUserSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation Error", details: result.error.format() },
      { status: 400 }
    );
  }

  const { name, email, password, role } = result.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return NextResponse.json(
      { error: "Email sudah digunakan" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [created] = await db
    .insert(users)
    .values({ name, email, password: passwordHash, role })
    .returning(userColumns);

  return NextResponse.json({ data: created }, { status: 201 });
});
