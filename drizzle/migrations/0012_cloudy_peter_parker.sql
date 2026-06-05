ALTER TABLE "payments" ADD COLUMN "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "generated_by" varchar(20) DEFAULT 'manual';