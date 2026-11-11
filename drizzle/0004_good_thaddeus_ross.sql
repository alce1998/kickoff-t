ALTER TABLE `asyncChallenges` ADD `gameMode` enum('standard','rapid') DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `asyncChallenges` ADD `attemptsInCurrentTurn` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `asyncChallenges` ADD `challengerTimeRemaining` int DEFAULT 600;--> statement-breakpoint
ALTER TABLE `asyncChallenges` ADD `opponentTimeRemaining` int DEFAULT 600;--> statement-breakpoint
ALTER TABLE `asyncChallenges` ADD `lastMoveAt` timestamp;