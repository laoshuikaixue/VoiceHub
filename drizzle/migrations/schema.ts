import { pgTable, serial, text, bigint, timestamp, integer, boolean, varchar, index, foreignKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const blacklistType = pgEnum("BlacklistType", ['SONG', 'KEYWORD'])
export const userStatus = pgEnum("user_status", ['active', 'withdrawn'])


export const drizzleMigrations = pgTable("__drizzle_migrations__", {
	id: serial().primaryKey().notNull(),
	hash: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }),
});

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
});

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

export const vote = pgTable("Vote", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	songId: integer().notNull(),
	userId: integer().notNull(),
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
	smtpEnabled: boolean().default(false).notNull(),
	smtpHost: text(),
	smtpPort: integer().default(587),
	smtpSecure: boolean().default(false),
	smtpUsername: text(),
	smtpPassword: text(),
	smtpFromEmail: text(),
	smtpFromName: text().default('校园广播站'),
	enableRequestTimeLimitation: boolean().default(false).notNull(),
	forceBlockAllRequests: boolean().default(false).notNull(),
});

export const emailTemplate = pgTable("EmailTemplate", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	key: varchar({ length: 100 }).notNull(),
	name: varchar({ length: 200 }).notNull(),
	subject: varchar({ length: 300 }).notNull(),
	html: text().notNull(),
	updatedByUserId: integer(),
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
	isDraft: boolean().default(false).notNull(),
	publishedAt: timestamp({ mode: 'string' }),
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
	email: text(),
	emailVerified: boolean().default(false),
	status: userStatus().default('active').notNull(),
	statusChangedAt: timestamp({ mode: 'string' }).defaultNow(),
	statusChangedBy: integer(),
}, (table) => [
	index("idx_user_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.statusChangedBy],
			foreignColumns: [table.id],
			name: "User_statusChangedBy_User_id_fk"
		}).onDelete("set null"),
]);

export const requestTime = pgTable("RequestTime", {
	id: integer().default(sql`nextval('"PlayTime_id_seq"'::regclass)`).primaryKey().notNull(),
	createdAt: timestamp({ precision: 6, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ precision: 6, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	startTime: timestamp({ mode: 'string' }).notNull(),
	endTime: timestamp({ mode: 'string' }).notNull(),
	enabled: boolean().default(true).notNull(),
	description: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	expected: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	accepted: bigint({ mode: "number" }).default(0).notNull(),
	past: boolean().default(false).notNull(),
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
	playUrl: text(),
	hitRequestId: integer(),
});

export const userStatusLogs = pgTable("user_status_logs", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	oldStatus: userStatus("old_status"),
	newStatus: userStatus("new_status").notNull(),
	reason: text(),
	operatorId: integer("operator_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_status_logs_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamp_ops")),
	index("idx_user_status_logs_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "user_status_logs_user_id_User_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.operatorId],
			foreignColumns: [user.id],
			name: "user_status_logs_operator_id_User_id_fk"
		}).onDelete("set null"),
]);
