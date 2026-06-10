import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { UserForm } from "@/components/forms/user-form";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { requireRole } from "@/lib/auth-guard";
import type { Role } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Edit User",
};

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["admin"]);
  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) notFound();

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) notFound();

  const isSelf = parseInt(session.user.id) === user.id;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit User</h1>
        <p className="text-muted-foreground">Perbarui data {user.name}</p>
      </div>
      <UserForm
        userId={user.id}
        defaultValues={{
          name: user.name,
          email: user.email,
          role: user.role as Role,
        }}
        lockRole={isSelf}
      />
    </div>
  );
}
