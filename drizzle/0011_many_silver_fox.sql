CREATE TABLE `dreamTeamRoomPlayers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(50) NOT NULL,
	`isReady` int NOT NULL DEFAULT 0,
	`pickData` text,
	`teamOverall` int,
	`bracketSeed` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dreamTeamRoomPlayers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dreamTeamRooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(8) NOT NULL,
	`hostUserId` int NOT NULL,
	`status` enum('lobby','picking','tournament','finished') NOT NULL DEFAULT 'lobby',
	`formation` varchar(20),
	`maxPlayers` int NOT NULL DEFAULT 16,
	`tournamentData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dreamTeamRooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `dreamTeamRooms_code_unique` UNIQUE(`code`)
);
