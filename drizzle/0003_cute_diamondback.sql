CREATE TABLE `asyncChallenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`challengerId` int NOT NULL,
	`opponentId` int NOT NULL,
	`status` enum('pending','active','completed','rejected') NOT NULL DEFAULT 'pending',
	`competition` varchar(50) NOT NULL,
	`period` varchar(50) NOT NULL,
	`matchData` text NOT NULL,
	`currentTurn` enum('challenger','opponent') NOT NULL DEFAULT 'opponent',
	`challengerLives` int NOT NULL DEFAULT 5,
	`opponentLives` int NOT NULL DEFAULT 5,
	`challengerHints` int NOT NULL DEFAULT 5,
	`opponentHints` int NOT NULL DEFAULT 5,
	`challengerScore` int NOT NULL DEFAULT 0,
	`opponentScore` int NOT NULL DEFAULT 0,
	`winnerId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asyncChallenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `challengeTurns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`challengeId` int NOT NULL,
	`userId` int NOT NULL,
	`playerName` varchar(100) NOT NULL,
	`isCorrect` int NOT NULL,
	`hintsUsed` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `challengeTurns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `friendRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderId` int NOT NULL,
	`receiverId` int NOT NULL,
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `friendRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId1` int NOT NULL,
	`userId2` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `friendships_id` PRIMARY KEY(`id`)
);
