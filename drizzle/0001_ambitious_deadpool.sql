CREATE TABLE `leaderboard` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameType` enum('link','progressione') NOT NULL,
	`playerName` varchar(100) NOT NULL,
	`timeSeconds` int NOT NULL,
	`competition` varchar(50) NOT NULL,
	`difficulty` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leaderboard_id` PRIMARY KEY(`id`)
);
