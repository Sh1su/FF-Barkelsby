CREATE TABLE `course_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`user_id` text NOT NULL,
	`completed_at` integer NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_completions_course_user_unique` ON `course_completions` (`course_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `course_completions_user_idx` ON `course_completions` (`user_id`);--> statement-breakpoint
CREATE TABLE `course_prerequisites` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`required_course_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`required_course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "course_prerequisites_not_self_check" CHECK("course_prerequisites"."course_id" <> "course_prerequisites"."required_course_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_prerequisites_pair_unique` ON `course_prerequisites` (`course_id`,`required_course_id`);--> statement-breakpoint
CREATE INDEX `course_prerequisites_course_idx` ON `course_prerequisites` (`course_id`);--> statement-breakpoint
CREATE INDEX `course_prerequisites_required_idx` ON `course_prerequisites` (`required_course_id`);