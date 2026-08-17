CREATE TABLE `course_days` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`day_number` integer NOT NULL,
	`date` integer,
	`time_label` text,
	`title` text NOT NULL,
	`bullets` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_days_course_day_unique` ON `course_days` (`course_id`,`day_number`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`description` text,
	`topics` text,
	`category` text NOT NULL,
	`format` text NOT NULL,
	`starts_on` integer NOT NULL,
	`ends_on` integer NOT NULL,
	`time_label` text,
	`location` text,
	`capacity` integer DEFAULT 0 NOT NULL,
	`instructor_id` text,
	`motif` integer,
	`palette` integer,
	`status` text DEFAULT 'geplant' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "courses_category_check" CHECK("courses"."category" in ('grundausbildung', 'atemschutz', 'technische-hilfeleistung', 'fuehrung-organisation', 'erste-hilfe')),
	CONSTRAINT "courses_format_check" CHECK("courses"."format" in ('standortausbildung', 'kreisausbildung')),
	CONSTRAINT "courses_status_check" CHECK("courses"."status" in ('geplant', 'abgesagt')),
	CONSTRAINT "courses_capacity_check" CHECK("courses"."capacity" >= 0),
	CONSTRAINT "courses_dates_check" CHECK("courses"."ends_on" >= "courses"."starts_on")
);
--> statement-breakpoint
CREATE INDEX `courses_starts_on_idx` ON `courses` (`starts_on`);--> statement-breakpoint
CREATE INDEX `courses_category_starts_on_idx` ON `courses` (`category`,`starts_on`);--> statement-breakpoint
CREATE INDEX `courses_ends_on_idx` ON `courses` (`ends_on`);--> statement-breakpoint
CREATE TABLE `instructors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`vita` text,
	`motif` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `revoked_sessions` (
	`sid` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `revoked_sessions_expires_at_idx` ON `revoked_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `signups` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'offen' NOT NULL,
	`cancel_token` text NOT NULL,
	`consent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "signups_status_check" CHECK("signups"."status" in ('offen', 'bestaetigt', 'abgelehnt', 'storniert'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signups_course_email_unique` ON `signups` (`course_id`,`email`) WHERE "signups"."status" <> 'storniert';--> statement-breakpoint
CREATE UNIQUE INDEX `signups_cancel_token_unique` ON `signups` (`cancel_token`);--> statement-breakpoint
CREATE INDEX `signups_course_status_idx` ON `signups` (`course_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`deactivated_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "users_role_check" CHECK("users"."role" in ('guest', 'admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);