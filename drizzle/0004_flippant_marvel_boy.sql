CREATE TABLE `llm_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('gemini','openai','anthropic','ollama') NOT NULL DEFAULT 'gemini',
	`modelName` varchar(128) NOT NULL DEFAULT 'gemini-2.5-flash',
	`apiKey` text,
	`ollamaBaseUrl` varchar(512) DEFAULT 'http://localhost:11434',
	`temperature` float NOT NULL DEFAULT 0.1,
	`maxTokens` int NOT NULL DEFAULT 4096,
	`useBuiltIn` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `llm_settings_id` PRIMARY KEY(`id`)
);
