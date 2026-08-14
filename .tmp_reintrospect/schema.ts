import { pgTable, serial, text, bigint, timestamp, boolean, integer, index, unique, foreignKey, uuid, varchar, inet, uniqueIndex, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const blacklistType = pgEnum("BlacklistType", ['SONG', 'KEYWORD'])
export const cardCodeStatus = pgEnum("card_code_status", ['AVAILABLE', 'LOCKED', 'REDEEMED', 'INVALID'])
export const collaboratorStatus = pgEnum("collaborator_status", ['PENDING', 'ACCEPTED', 'REJECTED'])
export const replayRequestStatus = pgEnum("replay_request_status", ['PENDING', 'FULFILLED', 'REJECTED'])
export const userStatus = pgEnum("user_status", ['active', 'withdrawn', 'graduate'])


export const drizzleMigrations = pgTable("__drizzle_migrations__", {
	id: serial().primaryKey().notNull(),
	hash: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }),
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
}, (table) => [
	index("vote_user_song_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.songId.asc().nullsLast().op("int4_ops")),
	unique("vote_song_user_unique").on(table.userId, table.songId),
]);

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

export const apiKeys = pgTable("api_keys", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	keyHash: varchar("key_hash", { length: 255 }).notNull(),
	keyPrefix: varchar("key_prefix", { length: 10 }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	createdByUserId: integer("created_by_user_id").notNull(),
	usageCount: integer("usage_count").default(0).notNull(),
}, (table) => [
	index("idx_api_keys_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_api_keys_created_by").using("btree", table.createdByUserId.asc().nullsLast().op("int4_ops")),
	index("idx_api_keys_key_hash").using("btree", table.keyHash.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [user.id],
			name: "api_keys_created_by_user_id_User_id_fk"
		}),
	unique("api_keys_key_hash_unique").on(table.keyHash),
]);

export const apiKeyPermissions = pgTable("api_key_permissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	apiKeyId: uuid("api_key_id").notNull(),
	permission: varchar({ length: 100 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_api_key_permissions_api_key_id").using("btree", table.apiKeyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.apiKeyId],
			foreignColumns: [apiKeys.id],
			name: "api_key_permissions_api_key_id_api_keys_id_fk"
		}).onDelete("cascade"),
	unique("api_key_permissions_api_key_id_permission_unique").on(table.permission, table.apiKeyId),
]);

export const apiLogs = pgTable("api_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	apiKeyId: uuid("api_key_id"),
	endpoint: varchar({ length: 500 }).notNull(),
	method: varchar({ length: 10 }).notNull(),
	ipAddress: inet("ip_address").notNull(),
	userAgent: text("user_agent"),
	statusCode: integer("status_code").notNull(),
	responseTimeMs: integer("response_time_ms").notNull(),
	requestBody: text("request_body"),
	responseBody: text("response_body"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	errorMessage: text("error_message"),
}, (table) => [
	index("idx_api_logs_api_key_id").using("btree", table.apiKeyId.asc().nullsLast().op("uuid_ops")),
	index("idx_api_logs_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_api_logs_endpoint").using("btree", table.endpoint.asc().nullsLast().op("text_ops")),
	index("idx_api_logs_status_code").using("btree", table.statusCode.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.apiKeyId],
			foreignColumns: [apiKeys.id],
			name: "api_logs_api_key_id_api_keys_id_fk"
		}).onDelete("set null"),
]);

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
	emailSongRequestEnabled: boolean().default(true).notNull(),
	emailSongVotedEnabled: boolean().default(true).notNull(),
	emailSongPlayedEnabled: boolean().default(true).notNull(),
	emailSystemNoticeEnabled: boolean().default(true).notNull(),
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

export const collaborationLogs = pgTable("collaboration_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	collaboratorId: uuid("collaborator_id").notNull(),
	action: varchar({ length: 50 }).notNull(),
	operatorId: integer("operator_id").notNull(),
	ipAddress: text("ip_address"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const requestTime = pgTable("RequestTime", {
	id: serial().primaryKey().notNull(),
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

export const songCollaborators = pgTable("song_collaborators", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	songId: integer("song_id").notNull(),
	userId: integer("user_id").notNull(),
	status: collaboratorStatus().default('PENDING').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("song_collaborators_song_status_idx").using("btree", table.songId.asc().nullsLast().op("int4_ops"), table.status.asc().nullsLast().op("int4_ops")),
	index("song_collaborators_user_status_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.status.asc().nullsLast().op("int4_ops")),
]);

export const userIdentity = pgTable("UserIdentity", {
	id: serial().primaryKey().notNull(),
	userId: integer().notNull(),
	provider: text().notNull(),
	providerUserId: text().notNull(),
	providerUsername: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "UserIdentity_userId_User_id_fk"
		}).onDelete("cascade"),
	unique("UserIdentity_provider_providerUserId_unique").on(table.providerUserId, table.provider),
]);

export const cardCode = pgTable("CardCode", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	code: text().notNull(),
	status: cardCodeStatus().default('AVAILABLE').notNull(),
	lockedBy: integer(),
	lockedAt: timestamp({ mode: 'string' }),
	redeemedBy: integer(),
	redeemedAt: timestamp({ mode: 'string' }),
	note: text(),
}, (table) => [
	uniqueIndex("CardCode_code_unique").using("btree", table.code.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.lockedBy],
			foreignColumns: [user.id],
			name: "CardCode_lockedBy_User_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.redeemedBy],
			foreignColumns: [user.id],
			name: "CardCode_redeemedBy_User_id_fk"
		}).onDelete("set null"),
]);

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
	submissionNote: text(),
	submissionNotePublic: boolean().default(false).notNull(),
	cardCodeId: integer(),
}, (table) => [
	index("song_card_code_id_idx").using("btree", table.cardCodeId.asc().nullsLast().op("int4_ops")),
	index("song_requester_id_idx").using("btree", table.requesterId.asc().nullsLast().op("int4_ops")),
	index("song_semester_created_at_idx").using("btree", table.semester.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.cardCodeId],
			foreignColumns: [cardCode.id],
			name: "Song_cardCodeId_CardCode_id_fk"
		}).onDelete("set null"),
]);

export const cardCodeRedeemLog = pgTable("CardCodeRedeemLog", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	cardCodeId: integer(),
	codeSnapshot: text().notNull(),
	redeemedBy: integer().notNull(),
	redeemedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	source: text().default('UNKNOWN').notNull(),
	songId: integer(),
}, (table) => [
	index("CardCodeRedeemLog_cardCodeId_idx").using("btree", table.cardCodeId.asc().nullsLast().op("int4_ops")),
	index("CardCodeRedeemLog_redeemedAt_idx").using("btree", table.redeemedAt.asc().nullsLast().op("timestamp_ops")),
	index("CardCodeRedeemLog_redeemedBy_idx").using("btree", table.redeemedBy.asc().nullsLast().op("int4_ops")),
	index("card_code_redeem_log_card_code_id_idx").using("btree", table.cardCodeId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.redeemedBy],
			foreignColumns: [user.id],
			name: "CardCodeRedeemLog_redeemedBy_User_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.songId],
			foreignColumns: [song.id],
			name: "CardCodeRedeemLog_songId_Song_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.cardCodeId],
			foreignColumns: [cardCode.id],
			name: "CardCodeRedeemLog_cardCodeId_CardCode_id_fk"
		}).onDelete("set null"),
]);

export const songReplayRequests = pgTable("song_replay_requests", {
	id: serial().primaryKey().notNull(),
	songId: integer("song_id").notNull(),
	userId: integer("user_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	status: replayRequestStatus().default('PENDING').notNull(),
	preferredPlayTimeId: integer("preferred_play_time_id"),
	submissionNote: text("submission_note"),
	submissionNotePublic: boolean("submission_note_public").default(false).notNull(),
}, (table) => [
	uniqueIndex("song_replay_requests_pending_song_user_unique").using("btree", table.songId.asc().nullsLast().op("int4_ops"), table.userId.asc().nullsLast().op("int4_ops")).where(sql`(status = 'PENDING'::replay_request_status)`),
	index("song_replay_requests_user_status_song_idx").using("btree", table.userId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("int4_ops"), table.songId.asc().nullsLast().op("int4_ops")),
]);

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
	replayRequestId: integer("replay_request_id"),
}, (table) => [
	index("idx_schedule_draft_date").using("btree", table.isDraft.asc().nullsLast().op("timestamp_ops"), table.playDate.asc().nullsLast().op("bool_ops")),
	index("idx_schedule_is_draft").using("btree", table.isDraft.asc().nullsLast().op("bool_ops")),
	index("idx_schedule_published_at").using("btree", table.publishedAt.asc().nullsLast().op("timestamp_ops")),
	index("schedule_published_date_idx").using("btree", table.isDraft.asc().nullsLast().op("bool_ops"), table.playDate.asc().nullsLast().op("bool_ops")),
	index("schedule_published_song_idx").using("btree", table.isDraft.asc().nullsLast().op("timestamp_ops"), table.songId.asc().nullsLast().op("timestamp_ops"), table.playDate.asc().nullsLast().op("timestamp_ops")),
]);

export const passwordAuditLog = pgTable("PasswordAuditLog", {
	id: serial().primaryKey().notNull(),
	userId: integer().notNull(),
	actorId: integer(),
	action: text().notNull(),
	success: boolean().notNull(),
	ipAddress: text(),
	userAgent: text(),
	failureReason: text(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("PasswordAuditLog_user_created_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.createdAt.asc().nullsLast().op("int4_ops")),
]);

export const passwordRateLimit = pgTable("PasswordRateLimit", {
	key: text().primaryKey().notNull(),
	count: integer().notNull(),
	resetAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("PasswordRateLimit_reset_idx").using("btree", table.resetAt.asc().nullsLast().op("timestamptz_ops")),
]);

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
	forcePasswordChange: boolean().default(false).notNull(),
	meowNickname: text(),
	meowBoundAt: timestamp({ mode: 'string' }),
	status: userStatus().default('active').notNull(),
	statusChangedAt: timestamp({ mode: 'string' }).defaultNow(),
	statusChangedBy: integer(),
	email: text(),
	emailVerified: boolean().default(false).notNull(),
	emailVerifiedAt: timestamp({ mode: 'string' }),
	tokenVersion: integer().default(0).notNull(),
}, (table) => [
	index("idx_user_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.statusChangedBy],
			foreignColumns: [table.id],
			name: "User_statusChangedBy_User_id_fk"
		}).onDelete("set null"),
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
	batchId: text(),
	source: text().default('SYSTEM').notNull(),
	senderId: integer(),
	senderName: text(),
	senderUsername: text(),
	title: text(),
	important: boolean().default(false).notNull(),
	userDeleted: boolean().default(false).notNull(),
}, (table) => [
	index("notification_batch_id_idx").using("btree", table.batchId.asc().nullsLast().op("text_ops")),
	index("notification_user_important_read_created_idx").using("btree", table.userId.asc().nullsLast().op("timestamp_ops"), table.userDeleted.asc().nullsLast().op("timestamp_ops"), table.important.asc().nullsLast().op("timestamp_ops"), table.read.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("int4_ops")),
]);

export const backupHistory = pgTable("BackupHistory", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	filename: text().notNull(),
	totalRecords: integer().default(0).notNull(),
	backupSize: integer().default(0).notNull(),
	methods: text().notNull(),
	success: boolean().default(false).notNull(),
	triggeredBy: text(),
}, (table) => [
	index("backup_history_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
]);

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
	smtpSecure: boolean().default(false).notNull(),
	smtpUsername: text(),
	smtpPassword: text(),
	smtpFromEmail: text(),
	smtpFromName: text(),
	enableRequestTimeLimitation: boolean().default(false).notNull(),
	forceBlockAllRequests: boolean().default(false).notNull(),
	enableReplayRequests: boolean().default(false).notNull(),
	monthlySubmissionLimit: integer(),
	gonganNumber: text(),
	enableCollaborativeSubmission: boolean().default(true).notNull(),
	enableSubmissionRemarks: boolean().default(false).notNull(),
	customOauthEnabled: boolean().default(false).notNull(),
	customOauthDisplayName: text(),
	customOauthAuthorizeUrl: text(),
	customOauthTokenUrl: text(),
	customOauthUserInfoUrl: text(),
	customOauthScope: text(),
	customOauthClientId: text(),
	customOauthClientSecret: text(),
	customOauthUserIdField: text(),
	customOauthUsernameField: text(),
	customOauthNameField: text(),
	customOauthEmailField: text(),
	customOauthAvatarField: text(),
	oauthRedirectUri: text(),
	oauthStateSecret: text(),
	oauthProviders: text().default('[]'),
	githubOauthEnabled: boolean().default(false).notNull(),
	githubClientId: text(),
	githubClientSecret: text(),
	casdoorOauthEnabled: boolean().default(false).notNull(),
	casdoorServerUrl: text(),
	casdoorClientId: text(),
	casdoorClientSecret: text(),
	casdoorOrganizationName: text(),
	googleOauthEnabled: boolean().default(false).notNull(),
	googleClientId: text(),
	googleClientSecret: text(),
	showBeianIcon: boolean().default(false).notNull(),
	allowOauthRegistration: boolean().default(false).notNull(),
	captchaEnabled: boolean().default(false).notNull(),
	captchaMaxFailures: integer().default(3).notNull(),
	captchaProvider: text().default('graphic').notNull(),
	turnstileSiteKey: text(),
	turnstileSecretKey: text(),
	instanceId: text("instance_id"),
	telemetryEnabled: boolean().default(true).notNull(),
	enableCardCodeRequests: boolean().default(false).notNull(),
	requireCardCodeForRequests: boolean().default(false).notNull(),
	enableCardCodeLimitBypass: boolean().default(false).notNull(),
	aggregateOauthEnabled: boolean().default(false).notNull(),
	aggregateOauthAppId: text(),
	aggregateOauthAppKey: text(),
	aggregateOauthLoginType: text().default('qq'),
	aggregateOauthEndpoint: text().default('https://a.idcfx.net/connect.php'),
	forcePasswordChangeOnFirstLogin: boolean().default(false).notNull(),
	autoBackupEnabled: boolean().default(false).notNull(),
	autoBackupConfig: text(),
	enabledPlatforms: text().default('["netease","tencent","bilibili","migu"]'),
	platformOrder: text().default('["netease","tencent","bilibili","migu"]'),
});
