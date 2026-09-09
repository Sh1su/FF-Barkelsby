PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_courses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`description` text,
	`topics` text,
	`starts_on` integer NOT NULL,
	`ends_on` integer NOT NULL,
	`motif` integer,
	`palette` integer,
	`status` text DEFAULT 'geplant' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "courses_status_check" CHECK("__new_courses"."status" in ('geplant', 'abgesagt')),
	CONSTRAINT "courses_dates_check" CHECK("__new_courses"."ends_on" >= "__new_courses"."starts_on")
);
--> statement-breakpoint
INSERT INTO `__new_courses`("id", "title", "summary", "description", "topics", "starts_on", "ends_on", "motif", "palette", "status", "created_at", "updated_at") SELECT "id", "title", "summary", "description", "topics", "starts_on", "ends_on", "motif", "palette", "status", "created_at", "updated_at" FROM `courses`;--> statement-breakpoint
DROP TABLE `courses`;--> statement-breakpoint
ALTER TABLE `__new_courses` RENAME TO `courses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `courses_starts_on_idx` ON `courses` (`starts_on`);--> statement-breakpoint
CREATE INDEX `courses_ends_on_idx` ON `courses` (`ends_on`);