ALTER TABLE `otel_spans` MODIFY COLUMN `startTimeMs` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `otel_spans` MODIFY COLUMN `endTimeMs` bigint;