CREATE TABLE `cartolinesPoints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`points` int NOT NULL DEFAULT 0,
	`totalEarned` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cartolinesPoints_id` PRIMARY KEY(`id`),
	CONSTRAINT `cartolinesPoints_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `cartolinesProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stadiumId` varchar(100) NOT NULL,
	`solved` int NOT NULL DEFAULT 0,
	`hintsUsed` text,
	`solvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cartolinesProgress_id` PRIMARY KEY(`id`)
);
