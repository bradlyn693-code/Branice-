CREATE TABLE `gameRooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(6) NOT NULL,
	`boardSize` int NOT NULL,
	`hostToken` varchar(64) NOT NULL,
	`opponentToken` varchar(64),
	`gameState` text NOT NULL,
	`status` enum('waiting','active','complete') NOT NULL DEFAULT 'waiting',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gameRooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `gameRooms_code_unique` UNIQUE(`code`)
);
