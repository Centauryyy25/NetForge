import {
  ArrowUp,
  CheckCircle2,
  Clock,
  MessageSquare,
  Pause,
  Play,
  Plus,
  AlertTriangle,
  Settings,
} from "lucide-react";

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: typeof Plus; color: string }
> = {
  created: { label: "Tiket Dibuat", icon: Plus, color: "text-blue-500" },
  eskalasi: { label: "Eskalasi", icon: ArrowUp, color: "text-red-500" },
  tutup: { label: "Tiket Ditutup", icon: CheckCircle2, color: "text-green-500" },
  tunda: { label: "Tiket Ditunda", icon: Pause, color: "text-orange-500" },
  lanjut: { label: "Tiket Dilanjutkan", icon: Play, color: "text-blue-500" },
  "gangguan-massal": { label: "Gangguan Massal", icon: AlertTriangle, color: "text-yellow-500" },
  status_change: { label: "Ubah Status", icon: Settings, color: "text-purple-500" },
  priority_change: { label: "Ubah Prioritas", icon: ArrowUp, color: "text-orange-500" },
  note_update: { label: "Catatan Diperbarui", icon: MessageSquare, color: "text-gray-500" },
};

const DEFAULT_CONFIG = { label: "Aksi", icon: Clock, color: "text-gray-500" };

interface LogEntry {
  id: number;
  action: string;
  detail: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  user: { id: number; name: string } | null;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(date));
}

export function TicketTimeline({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Belum ada riwayat aktivitas.
      </p>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-4 top-3 bottom-3 w-px bg-border" />

      {logs.map((log) => {
        const config = ACTION_CONFIG[log.action] ?? DEFAULT_CONFIG;
        const Icon = config.icon;

        return (
          <div key={log.id} className="relative flex gap-4 pb-4 last:pb-0">
            {/* Icon */}
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border">
              <Icon className={`h-4 w-4 ${config.color}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium">{config.label}</span>
                {log.user && (
                  <span className="text-xs text-muted-foreground">
                    oleh {log.user.name}
                  </span>
                )}
              </div>

              {log.detail && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {log.detail}
                </p>
              )}

              {(log.oldValue || log.newValue) && (
                <div className="flex items-center gap-1.5 mt-1 text-xs">
                  {log.oldValue && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {log.oldValue}
                    </span>
                  )}
                  {log.oldValue && log.newValue && <span className="text-muted-foreground">&rarr;</span>}
                  {log.newValue && (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {log.newValue}
                    </span>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-1">
                {formatDateTime(log.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
