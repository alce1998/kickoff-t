CREATE TABLE `gameScores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`gameType` enum('formazioni','carriere','link','progressione') NOT NULL,
	`score` int NOT NULL,
	`timeSeconds` int,
	`competition` varchar(50),
	`difficulty` varchar(20),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gameScores_id` PRIMARY KEY(`id`)
);
