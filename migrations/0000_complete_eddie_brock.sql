CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `ai_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`provider` text NOT NULL,
	`label` text NOT NULL,
	`api_key` text NOT NULL,
	`base_url` text,
	`default_model` text NOT NULL,
	`available_models` text,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_logs_org_created_idx` ON `audit_logs` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `campaign_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`campaign_score` integer DEFAULT 0 NOT NULL,
	`campaign_score_breakdown` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`pipeline_stage` text DEFAULT 'new' NOT NULL,
	`scheduled_at` integer,
	`contacted_at` integer,
	`auto_replies_sent` integer DEFAULT 0 NOT NULL,
	`needs_human_review` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_leads_unique_idx` ON `campaign_leads` (`campaign_id`,`lead_id`);--> statement-breakpoint
CREATE INDEX `campaign_leads_campaign_id_idx` ON `campaign_leads` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `campaign_leads_lead_id_idx` ON `campaign_leads` (`lead_id`);--> statement-breakpoint
CREATE INDEX `campaign_leads_status_idx` ON `campaign_leads` (`campaign_id`,`status`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`objective` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`filters` text,
	`schedule_start` text DEFAULT '09:00',
	`schedule_end` text DEFAULT '18:00',
	`schedule_days` text,
	`min_interval` integer DEFAULT 180 NOT NULL,
	`max_interval` integer DEFAULT 300 NOT NULL,
	`daily_limit` integer DEFAULT 40 NOT NULL,
	`daily_sent` integer DEFAULT 0 NOT NULL,
	`first_message_variants` text,
	`ai_enabled` integer DEFAULT true NOT NULL,
	`ai_provider_id` text,
	`ai_model` text,
	`ai_system_prompt` text,
	`ai_max_auto_replies` integer DEFAULT 3 NOT NULL,
	`ai_temperature` real DEFAULT 0.7 NOT NULL,
	`whatsapp_instance_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ai_provider_id`) REFERENCES `ai_providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`whatsapp_instance_id`) REFERENCES `whatsapp_instances`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `extraction_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`config` text,
	`apify_run_id` text,
	`total_found` integer DEFAULT 0 NOT NULL,
	`total_new` integer DEFAULT 0 NOT NULL,
	`total_duplicate` integer DEFAULT 0 NOT NULL,
	`total_enriched` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`inviter_id` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`phone_secondary` text,
	`email` text,
	`website` text,
	`address` text,
	`city` text,
	`state` text,
	`neighborhood` text,
	`zip_code` text,
	`latitude` real,
	`longitude` real,
	`category` text,
	`subcategory` text,
	`source_type` text,
	`source_id` text,
	`has_website` integer,
	`website_status` text,
	`has_ssl` integer,
	`has_instagram` integer,
	`instagram_url` text,
	`has_google_business` integer DEFAULT true,
	`google_rating` real,
	`google_review_count` integer,
	`business_hours` text,
	`domain_registrar` text,
	`domain_created_at` text,
	`whois_email` text,
	`whois_responsible` text,
	`enriched_at` integer,
	`enrichment_version` integer DEFAULT 0 NOT NULL,
	`ai_classification` text,
	`ai_classification_confidence` real,
	`ai_summary` text,
	`ai_suggested_approach` text,
	`ai_qualified_at` integer,
	`score` integer DEFAULT 0 NOT NULL,
	`score_breakdown` text,
	`score_explanation` text,
	`scored_at` integer,
	`scoring_version` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`lost_reason` text,
	`do_not_contact` integer DEFAULT false NOT NULL,
	`contact_attempts` integer DEFAULT 0 NOT NULL,
	`last_contacted_at` integer,
	`last_replied_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `leads_organization_id_idx` ON `leads` (`organization_id`);--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `leads_score_idx` ON `leads` (`organization_id`,`score`);--> statement-breakpoint
CREATE INDEX `leads_phone_idx` ON `leads` (`phone`);--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE TABLE `message_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`shortcut` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`category` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_templates_org_shortcut_idx` ON `message_templates` (`organization_id`,`shortcut`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`campaign_lead_id` text,
	`whatsapp_instance_id` text,
	`direction` text NOT NULL,
	`content` text NOT NULL,
	`media_type` text,
	`media_url` text,
	`source` text,
	`ai_generated` integer DEFAULT false NOT NULL,
	`ai_model` text,
	`evolution_message_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`sent_at` integer,
	`delivered_at` integer,
	`read_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_lead_id`) REFERENCES `campaign_leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`whatsapp_instance_id`) REFERENCES `whatsapp_instances`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_lead_id_created_at_idx` ON `messages` (`lead_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_campaign_lead_id_idx` ON `messages` (`campaign_lead_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_organization_id_idx` ON `messages` (`organization_id`);--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`created_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_uidx` ON `organization` (`slug`);--> statement-breakpoint
CREATE TABLE `scoring_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`objective` text NOT NULL,
	`field` text NOT NULL,
	`operator` text NOT NULL,
	`value` text NOT NULL,
	`points` integer NOT NULL,
	`label` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`active_organization_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `warmup_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_instance_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`current_day` integer DEFAULT 1 NOT NULL,
	`current_daily_limit` integer DEFAULT 10 NOT NULL,
	`warmup_completed` integer DEFAULT false NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`schedule` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`whatsapp_instance_id`) REFERENCES `whatsapp_instances`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `whatsapp_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`instance_name` text NOT NULL,
	`instance_id` text,
	`phone` text,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`qr_code` text,
	`webhook_url` text,
	`daily_message_limit` integer DEFAULT 80 NOT NULL,
	`daily_messages_sent` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
