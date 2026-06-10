import type { Metadata } from "next";
import { BandwidthMonitor } from "@/components/bandwidth/bandwidth-monitor";

export const metadata: Metadata = {
  title: "Bandwidth",
};

export default function BandwidthPage() {
  return <BandwidthMonitor />;
}
