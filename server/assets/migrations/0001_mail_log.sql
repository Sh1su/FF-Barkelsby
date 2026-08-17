CREATE TABLE `mail_log` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text,
	`signup_id` text,
	`recipient` text NOT NULL,
	`template` text NOT NULL,
	`subject` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "mail_log_status_check" CHECK("mail_log"."status" in ('versendet', 'nicht_versendet', 'fehlgeschlagen'))
);
--> statement-breakpoint
CREATE INDEX `mail_log_course_idx` ON `mail_log` (`course_id`);--> statement-breakpoint
CREATE INDEX `mail_log_created_at_idx` ON `mail_log` (`created_at`);