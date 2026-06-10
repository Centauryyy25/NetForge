ALTER TABLE "service_requests" ADD COLUMN "subject" varchar(255);--> statement-breakpoint
UPDATE "service_requests" SET "subject" = "ticket_number" || ' - ' || LEFT("description", 80) WHERE "subject" IS NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ALTER COLUMN "subject" SET NOT NULL;