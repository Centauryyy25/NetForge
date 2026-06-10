ALTER TYPE "public"."request_status" ADD VALUE 'pending' BEFORE 'approved';--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "sla_paused_at" timestamp;