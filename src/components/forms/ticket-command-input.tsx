"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { parseTicketCommand } from "@/lib/ticket-commands";

interface TicketCommandInputProps {
  ticketId: number;
}

export function TicketCommandInput({ ticketId }: TicketCommandInputProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseTicketCommand(input);
    if (!parsed) {
      toast.error("Perintah tidak dikenal. Gunakan: /eskalasi, /tutup, /tunda, /lanjut, /gangguan-massal");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/ticket/${ticketId}/command`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Perintah /${parsed.command} berhasil dijalankan`);
      setInput("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menjalankan perintah");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Terminal className="h-4 w-4" />
          Perintah Cepat
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="/eskalasi, /tutup, /tunda, /lanjut, /gangguan-massal"
            className="font-mono text-sm"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim"}
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          /tunda menunggu sparepart &middot; /lanjut sparepart tersedia &middot; /eskalasi jaringan putus &middot; /tutup selesai
        </p>
      </CardContent>
    </Card>
  );
}
