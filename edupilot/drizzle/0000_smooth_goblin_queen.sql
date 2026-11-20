CREATE TABLE `accounts` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_provider_unique` ON `accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE TABLE `aid_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`aid_request_id` text NOT NULL,
	`file_name` text NOT NULL,
	`stored_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`ocr_text` text,
	`uploaded_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aid_request_id`) REFERENCES `aid_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `aid_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`family_id` text,
	`child_id` text,
	`reference` text NOT NULL,
	`applicant_name` text NOT NULL,
	`quotient_familial` integer NOT NULL,
	`amount_asked` real NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'DEPOSITED' NOT NULL,
	`score` integer,
	`suggested_amount` real,
	`final_amount` real,
	`score_explanation` text,
	`ocr_payload` text,
	`source` text DEFAULT 'portail-familles' NOT NULL,
	`deposited_at` integer DEFAULT (unixepoch()) NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `aid_org_status_idx` ON `aid_requests` (`organization_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `aid_ref_unique` ON `aid_requests` (`reference`);--> statement-breakpoint
CREATE TABLE `aid_validations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`aid_request_id` text NOT NULL,
	`validator_id` text NOT NULL,
	`decision` text NOT NULL,
	`ai_amount` real NOT NULL,
	`human_amount` real NOT NULL,
	`reason` text,
	`decided_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aid_request_id`) REFERENCES `aid_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`validator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`severity` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `alerts_org_idx` ON `alerts` (`organization_id`,`is_read`);--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`school_id` text NOT NULL,
	`date` text NOT NULL,
	`expected` integer NOT NULL,
	`covers` integer NOT NULL,
	`source` text DEFAULT 'seed' NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_org_school_date` ON `attendance` (`organization_id`,`school_id`,`date`);--> statement-breakpoint
CREATE INDEX `attendance_date_idx` ON `attendance` (`date`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor_id` text,
	`actor_name` text DEFAULT 'système' NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`ai_suggestion` text,
	`human_decision` text,
	`detail` text DEFAULT '' NOT NULL,
	`ip` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_org_date_idx` ON `audit_logs` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `children` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`family_id` text,
	`school_id` text NOT NULL,
	`external_id` text,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`birth_date` text NOT NULL,
	`class_name` text NOT NULL,
	`allergen_note` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `children_org_idx` ON `children` (`organization_id`);--> statement-breakpoint
CREATE INDEX `children_school_idx` ON `children` (`school_id`);--> statement-breakpoint
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`external_id` text,
	`source` text DEFAULT 'mock' NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`quotient_familial` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `families_org_idx` ON `families` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `families_external_unique` ON `families` (`organization_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `haccp_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`school_id` text NOT NULL,
	`date` text NOT NULL,
	`check_type` text NOT NULL,
	`temperature` real,
	`product_label` text,
	`dlc` text,
	`conform` integer NOT NULL,
	`note` text,
	`checked_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`checked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `haccp_org_date_idx` ON `haccp_checks` (`organization_id`,`date`);--> statement-breakpoint
CREATE TABLE `haccp_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`check_id` text,
	`stored_path` text NOT NULL,
	`file_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`check_id`) REFERENCES `haccp_checks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `integration_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`source` text NOT NULL,
	`entity_type` text NOT NULL,
	`direction` text DEFAULT 'INBOUND' NOT NULL,
	`status` text DEFAULT 'RECEIVED' NOT NULL,
	`payload` text NOT NULL,
	`normalized` text,
	`received_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `integration_org_idx` ON `integration_events` (`organization_id`,`source`);--> statement-breakpoint
CREATE TABLE `menus` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`date` text NOT NULL,
	`label` text NOT NULL,
	`products` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `menus_org_date` ON `menus` (`organization_id`,`date`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`city` text NOT NULL,
	`siret` text,
	`source_system` text NOT NULL,
	`budget` real DEFAULT 0 NOT NULL,
	`alert_threshold_waste` real DEFAULT 0.12 NOT NULL,
	`alert_threshold_occupancy` real DEFAULT 0.75 NOT NULL,
	`aid_bareme` text DEFAULT '{"base":120,"partQ1":65,"partQ2":45,"partQ3":25,"max":380}' NOT NULL,
	`calendar` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `planning_shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`school_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`date` text NOT NULL,
	`start_hour` text NOT NULL,
	`end_hour` text NOT NULL,
	`expected_covers` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shifts_org_date_idx` ON `planning_shifts` (`organization_id`,`date`);--> statement-breakpoint
CREATE TABLE `prediction_validations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`prediction_id` text NOT NULL,
	`validator_id` text NOT NULL,
	`ai_covers` integer NOT NULL,
	`human_covers` integer NOT NULL,
	`ai_meals` integer NOT NULL,
	`human_meals` integer NOT NULL,
	`delta_covers` integer NOT NULL,
	`reason` text,
	`decided_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prediction_id`) REFERENCES `predictions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`validator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `predval_org_idx` ON `prediction_validations` (`organization_id`);--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`school_id` text NOT NULL,
	`date` text NOT NULL,
	`generated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`horizon_days` integer DEFAULT 7 NOT NULL,
	`predicted_covers` integer NOT NULL,
	`lower_bound` integer NOT NULL,
	`upper_bound` integer NOT NULL,
	`confidence` real NOT NULL,
	`recommended_meals` integer NOT NULL,
	`expected_waste_kg` real NOT NULL,
	`features` text DEFAULT '[]' NOT NULL,
	`model_version` text DEFAULT 'edupilot-ts-v1' NOT NULL,
	`status` text DEFAULT 'SUGGESTED' NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `predictions_org_school_date` ON `predictions` (`organization_id`,`school_id`,`date`);--> statement-breakpoint
CREATE INDEX `predictions_status_idx` ON `predictions` (`status`);--> statement-breakpoint
CREATE TABLE `schools` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`district` text,
	`capacity` integer DEFAULT 120 NOT NULL,
	`director_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `schools_org_idx` ON `schools` (`organization_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`session_token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`position` text NOT NULL,
	`school_id` text,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `time_clocks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`clock_in` integer DEFAULT (unixepoch()) NOT NULL,
	`clock_out` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `planning_shifts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer,
	`image` text,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`organization_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_org_idx` ON `users` (`organization_id`);--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verification_tokens_unique` ON `verification_tokens` (`identifier`,`token`);--> statement-breakpoint
CREATE TABLE `waste_records` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`school_id` text NOT NULL,
	`date` text NOT NULL,
	`covers` integer NOT NULL,
	`prepared_meals` integer NOT NULL,
	`waste_kg` real NOT NULL,
	`waste_cost` real NOT NULL,
	`menu_label` text,
	`note` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `waste_org_date_idx` ON `waste_records` (`organization_id`,`date`);