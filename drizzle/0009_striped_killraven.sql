ALTER TABLE `users` ADD `username` varchar(10);--> statement-breakpoint
ALTER TABLE `users` ADD `pendingUsername` varchar(10);--> statement-breakpoint
ALTER TABLE `users` ADD `usernameChangeToken` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `usernameChangeTokenExpiry` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);