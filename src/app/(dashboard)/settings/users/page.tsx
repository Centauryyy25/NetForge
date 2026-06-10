import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { UserTable, type UserRow } from "@/components/tables/user-table";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { requireRole } from "@/lib/auth-guard";
import type { Role } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Manajemen User",
};

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await requireRole(["admin"]);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);

  const data: UserRow[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as Role,
    createdAt: u.createdAt,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen User"
        description="Kelola akun admin, operator, dan teknisi"
        actions={
          <Button render={<Link href="/settings/users/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah User
          </Button>
        }
      />
      <UserTable data={data} currentUserId={parseInt(session.user.id)} />
    </div>
  );
}
