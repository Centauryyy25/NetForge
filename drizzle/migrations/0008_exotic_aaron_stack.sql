CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "priority" "ticket_priority" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "sla_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "escalated_at" timestamp;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "mass_outage_tag" varchar(100);