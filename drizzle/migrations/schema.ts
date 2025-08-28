import { pgTable, unique, serial, timestamp, integer, boolean, text, bigint, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const blacklistType = pgEnum("BlacklistType", ['SONG', 'KEYWORD'])


export const notificationSettings = pgTable("NotificationSettings", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	userId: integer().notNull(),
	enabled: boolean().default(true).notNull(),
	songRequestEnabled: boolean().default(true).notNull(),
	songVotedEnabled: boolean().default(true).notNull(),
	songPlayedEnabled: boolean().default(true).notNull(),
	refreshInterval: integer().default(60).notNull(),
	songVotedThreshold: integer().default(1).notNull(),
}, (table) => [
	unique("NotificationSettings_userId_unique").on(table.userId),
]);

export const notification = pgTable("Notification", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	type: text().notNull(),
	message: text().notNull(),
	read: boolean().default(false).notNull(),
	userId: integer().notNull(),
	songId: integer(),
});

export const playTime = pgTable("PlayTime", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	startTime: text(),
	endTime: text(),
	enabled: boolean().default(true).notNull(),
	description: text(),
});

export const schedule = pgTable("Schedule", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	songId: integer().notNull(),
	playDate: timestamp({ mode: 'string' }).notNull(),
	played: boolean().default(false).notNull(),
	sequence: integer().default(1).notNull(),
	playTimeId: integer(),
});

export const semester = pgTable("Semester", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	isActive: boolean().default(false).notNull(),
});

export const songBlacklist = pgTable("SongBlacklist", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	type: blacklistType().notNull(),
	value: text().notNull(),
	reason: text(),
	isActive: boolean().default(true).notNull(),
	createdBy: integer(),
});

export const song = pgTable("Song", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	artist: text().notNull(),
	requesterId: integer().notNull(),
	played: boolean().default(false).notNull(),
	playedAt: timestamp({ mode: 'string' }),
	semester: text(),
	preferredPlayTimeId: integer(),
	cover: text(),
	musicPlatform: text(),
	musicId: text(),
});

export const systemSettings = pgTable("SystemSettings", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	enablePlayTimeSelection: boolean().default(false).notNull(),
	siteTitle: text(),
	siteLogoUrl: text(),
	schoolLogoHomeUrl: text(),
	schoolLogoPrintUrl: text(),
	siteDescription: text(),
	submissionGuidelines: text(),
	icpNumber: text(),
	enableSubmissionLimit: boolean().default(false).notNull(),
	dailySubmissionLimit: integer(),
	weeklySubmissionLimit: integer(),
	showBlacklistKeywords: boolean().default(false).notNull(),
	hideStudentInfo: boolean().default(true).notNull(),
});

export const user = pgTable("User", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	username: text().notNull(),
	name: text(),
	grade: text(),
	class: text(),
	role: text().default('USER').notNull(),
	password: text().notNull(),
	lastLogin: timestamp({ mode: 'string' }),
	lastLoginIp: text(),
	passwordChangedAt: timestamp({ mode: 'string' }),
	forcePasswordChange: boolean().default(true).notNull(),
	meowNickname: text(),
	meowBoundAt: timestamp({ mode: 'string' }),
}, (table) => [
	unique("User_username_unique").on(table.username),
]);

export const vote = pgTable("Vote", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	songId: integer().notNull(),
	userId: integer().notNull(),
});

export const drizzleMigrations = pgTable("__drizzle_migrations__", {
	id: serial().primaryKey().notNull(),
	hash: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }),
});
