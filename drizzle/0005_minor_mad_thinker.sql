CREATE TABLE `matchmakingQueue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`timeLimit` int NOT NULL,
	`status` enum('searching','matched','cancelled') NOT NULL DEFAULT 'searching',
	`matchedChallengeId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `matchmakingQueue_id` PRIMARY KEY(`id`)
);
