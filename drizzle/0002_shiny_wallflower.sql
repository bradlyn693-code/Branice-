CREATE TABLE `playerAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `playerAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `playerAccounts_email_unique` UNIQUE(`email`)
);
