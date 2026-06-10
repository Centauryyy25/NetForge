import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SessionProvider } from "@/components/providers/session-provider";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/constants";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = {
    name: session.user.name ?? "User",
    email: session.user.email ?? "",
    role: (session.user.role ?? "operator") as Role,
    initials: (session.user.name ?? "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
  };

  return (
    <SessionProvider>
      <SidebarProvider>
        <AppSidebar userRole={user.role} userName={user.name} userEmail={user.email} userInitials={user.initials} />
        <SidebarInset className="bg-transparent">
          <Topbar userName={user.name} userEmail={user.email} userInitials={user.initials} />
          <main className="relative flex-1 p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
