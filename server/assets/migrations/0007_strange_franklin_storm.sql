-- FV-15: das bisherige, einzige geteilte Gast-Konto wird zu einer gewoehnlichen Rolle
-- "member" fuer persoenliche Mitgliedskonten. Bestehende "guest"-Zeilen muessen zuerst auf
-- "member" umgeschrieben werden, sonst scheitert der verschaerfte CHECK unten an Altdaten.
-- Der alte CHECK ("guest", "admin") liesse "member" aber selbst nicht zu (anders als bei
-- FV-13s Platzzahl-Anhebung war der alte Wert dort noch gueltig) – deshalb kurz die
-- CHECK-Pruefung aussetzen, nur fuer dieses eine UPDATE.
PRAGMA ignore_check_constraints=ON;--> statement-breakpoint
UPDATE `users` SET `role` = 'member' WHERE `role` = 'guest';--> statement-breakpoint
PRAGMA ignore_check_constraints=OFF;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`deactivated_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "users_role_check" CHECK("__new_users"."role" in ('member', 'admin'))
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "password_hash", "role", "display_name", "must_change_password", "deactivated_at", "created_at", "updated_at") SELECT "id", "email", "password_hash", "role", "display_name", "must_change_password", "deactivated_at", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);