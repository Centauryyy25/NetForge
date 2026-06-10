CREATE TABLE "ticket_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"user_id" integer,
	"action" varchar(50) NOT NULL,
	"detail" text,
	"old_value" varchar(100),
	"new_value" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_logs" ADD CONSTRAINT "ticket_logs_ticket_id_service_requests_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_logs" ADD CONSTRAINT "ticket_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;