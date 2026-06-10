"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { CUSTOMER_STATUS_LABELS, type CustomerStatus } from "@/lib/constants";

const STATUS_COLORS: Record<string, string> = {
  active: "#6631DB",
  inactive: "var(--muted-foreground)",
  suspended: "#F59E0B",
  terminated: "var(--destructive)",
};

interface CustomerStatusChartProps {
  data: { name: string; value: number }[];
}

export function CustomerStatusChart({ data }: CustomerStatusChartProps) {
  const chartData = data
    .filter((d) => d.value > 0)
    .map((d) => ({
      name: CUSTOMER_STATUS_LABELS[d.name as CustomerStatus] ?? d.name,
      value: d.value,
      color: STATUS_COLORS[d.name] ?? "var(--muted-foreground)",
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        Belum ada data pelanggan.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={4}
          dataKey="value"
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--popover)",
            color: "var(--popover-foreground)",
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
