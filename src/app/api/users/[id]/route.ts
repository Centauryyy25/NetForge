import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { updateUserSchema } from "@/validators/user";
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

function parseId(raw: string): number | null {
  const id = parseInt(raw);
  return isNaN(id) ? null : id;
}

export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) => {
  await requireRole(["admin"]);

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const [user] = await db
    .select(userColumns)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ data: user });
});

export const PATCH = withErrorHandler<{ id: string }>(async (req, { params }) => {
  const session = await requireRole(["admin"]);

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const body = await req.json();
  const result = updateUserSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation Error", details: result.error.format() },
      { status: 400 }
    );
  }

  const existing = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!existing) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  const isSelf = parseInt(session.user.id) === id;
  if (isSelf && result.data.role && result.data.role !== existing.role) {
    return NextResponse.json(
      { error: "Tidak dapat mengubah role akun sendiri" },
      { status: 400 }
    );
  }

  if (result.data.email && result.data.email !== existing.email) {
    const conflict = await db.query.users.findFirst({
      where: and(eq(users.email, result.data.email), ne(users.id, id)),
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Email sudah digunakan" },
        { status: 409 }
      );
    }
  }

  const updates: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (result.data.name !== undefined) updates.name = result.data.name;
  if (result.data.email !== undefined) updates.email = result.data.email;
  if (result.data.role !== undefined) updates.role = result.data.role;
  if (result.data.password) {
    updates.password = await bcrypt.hash(result.data.password, 10);
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning(userColumns);

  return NextResponse.json({ data: updated });
});

export const DELETE = withErrorHandler<{ id: string }>(async (_req, { params }) => {
  const session = await requireRole(["admin"]);

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  if (parseInt(session.user.id) === id) {
    return NextResponse.json(
      { error: "Tidak dapat menghapus akun sendiri" },
      { status: 400 }
    );
  }

  try {
    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning(userColumns);

    if (!deleted) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch {
    return NextResponse.json(
      { error: "User tidak dapat dihapus karena masih memiliki relasi data." },
      { status: 409 }
    );
  }
});
