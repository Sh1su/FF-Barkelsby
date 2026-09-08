CREATE TABLE `branding_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`logo_data` text,
	`logo_mime` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mail_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`host` text DEFAULT '' NOT NULL,
	`port` integer DEFAULT 587 NOT NULL,
	`user` text DEFAULT '' NOT NULL,
	`password_encrypted` text,
	`from_address` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
