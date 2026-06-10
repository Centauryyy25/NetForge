import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "NetForge — SI YBY NET",
    template: "%s — NetForge",
  },
  description: "Sistem Informasi Manajemen Pelanggan & Jaringan YBY NET",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className="font-sans"
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background antialiased overflow-x-hidden">
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
