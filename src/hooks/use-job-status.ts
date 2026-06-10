"use client";

import { useState, useEffect, useCallback } from "react";

type JobState = "waiting" | "active" | "completed" | "failed" | "unknown";

interface JobStatus {
  id: string;
  state: JobState;
  progress: number;
  result?: unknown;
  error?: string;
}

export function useJobStatus(jobId: string | null, pollInterval = 2000) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;

    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch job status");

      const data: JobStatus = await res.json();
      setStatus(data);

      // Stop polling when job is complete or failed
      if (data.state === "completed" || data.state === "failed") {
        setIsPolling(false);
      }
    } catch {
      setIsPolling(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setStatus(null);
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    fetchStatus();

    const interval = setInterval(() => {
      if (isPolling) fetchStatus();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [jobId, pollInterval, fetchStatus, isPolling]);

  return {
    status,
    isPolling,
    isCompleted: status?.state === "completed",
    isFailed: status?.state === "failed",
    isActive: status?.state === "active" || status?.state === "waiting",
  };
}
