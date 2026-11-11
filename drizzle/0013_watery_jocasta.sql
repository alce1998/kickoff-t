CREATE TABLE `userStats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`rankedMatchesPlayed` int NOT NULL DEFAULT 0,
	`loginStreak` int NOT NULL DEFAULT 0,
	`lastLoginDate` int NOT NULL DEFAULT 0,
	`gamesPlayedSet` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userStats_id` PRIMARY KEY(`id`),
	CONSTRAINT `userStats_userId_unique` UNIQUE(`userId`)
);
