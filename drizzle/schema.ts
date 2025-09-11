import { sql } from 'drizzle-orm'
import { pgTable, serial, text, timestamp, boolean, integer, pgEnum, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { getBeijingTimestamp } from '../utils/timeUtils'

// 枚举定义
export const blacklistTypeEnum = pgEnum('BlacklistType', ['SONG', 'KEYWORD']);

// 用户表
export const users = pgTable('User', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('createdAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  updatedAt: timestamp('updatedAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  username: text('username').notNull(),
  name: text('name'),
  grade: text('grade'),
  class: text('class'),
  role: text('role').default('USER').notNull(),
  password: text('password').notNull(),
  lastLogin: timestamp('lastLogin'),
  lastLoginIp: text('lastLoginIp'),
  passwordChangedAt: timestamp('passwordChangedAt'),
  forcePasswordChange: boolean('forcePasswordChange').default(true).notNull(),
  meowNickname: text('meowNickname'),
  meowBoundAt: timestamp('meowBoundAt'),
  email: text('email'),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  emailVerifiedAt: timestamp('emailVerifiedAt'),
});

// 播出时段表
export const playTimes = pgTable('PlayTime', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('createdAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  updatedAt: timestamp('updatedAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  name: text('name').notNull(),
  startTime: text('startTime'),
  endTime: text('endTime'),
  enabled: boolean('enabled').default(true).notNull(),
  description: text('description'),
});

// 歌曲表
export const songs = pgTable('Song', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('createdAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  updatedAt: timestamp('updatedAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  requesterId: integer('requesterId').notNull(),
  played: boolean('played').default(false).notNull(),
  playedAt: timestamp('playedAt').default(sql`${getBeijingTimestamp()}`),
  semester: text('semester'),
  preferredPlayTimeId: integer('preferredPlayTimeId'),
  cover: text('cover'),
  musicPlatform: text('musicPlatform'),
  musicId: text('musicId'),
});

// 投票表
export const votes = pgTable('Vote', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('createdAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  songId: integer('songId').notNull(),
  userId: integer('userId').notNull(),
});

// 排期表
export const schedules = pgTable('Schedule', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('createdAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  updatedAt: timestamp('updatedAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  songId: integer('songId').notNull(),
  playDate: timestamp('playDate').notNull(),
  played: boolean('played').default(false).notNull(),
  sequence: integer('sequence').default(1).notNull(),
  playTimeId: integer('playTimeId'),
});

// 通知表
export const notifications = pgTable('Notification', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('createdAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  updatedAt: timestamp('updatedAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  type: text('type').notNull(),
  message: text('message').notNull(),
  read: boolean('read').default(false).notNull(),
  userId: integer('userId').notNull(),
  songId: integer('songId'),
});

// 通知设置表
export const notificationSettings = pgTable('NotificationSettings', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('createdAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  updatedAt: timestamp('updatedAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  userId: integer('userId').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  songRequestEnabled: boolean('songRequestEnabled').default(true).notNull(),
  songVotedEnabled: boolean('songVotedEnabled').default(true).notNull(),
  songPlayedEnabled: boolean('songPlayedEnabled').default(true).notNull(),
  refreshInterval: integer('refreshInterval').default(60).notNull(),
  songVotedThreshold: integer('songVotedThreshold').default(1).notNull(),
  // 邮件通知设置
  emailEnabled: boolean('emailEnabled').default(false).notNull(),
  emailSongRequestEnabled: boolean('emailSongRequestEnabled').default(true).notNull(),
  emailSongVotedEnabled: boolean('emailSongVotedEnabled').default(true).notNull(),
  emailSongPlayedEnabled: boolean('emailSongPlayedEnabled').default(true).notNull(),
  emailSystemNoticeEnabled: boolean('emailSystemNoticeEnabled').default(true).notNull(),
});

// 学期表
export const semesters = pgTable('Semester', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('createdAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  updatedAt: timestamp('updatedAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  name: text('name').notNull(),
  isActive: boolean('isActive').default(false).notNull(),
});

// 系统设置表
export const systemSettings = pgTable('SystemSettings', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('createdAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  updatedAt: timestamp('updatedAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  enablePlayTimeSelection: boolean('enablePlayTimeSelection').default(false).notNull(),
  siteTitle: text('siteTitle'),
  siteLogoUrl: text('siteLogoUrl'),
  schoolLogoHomeUrl: text('schoolLogoHomeUrl'),
  schoolLogoPrintUrl: text('schoolLogoPrintUrl'),
  siteDescription: text('siteDescription'),
  submissionGuidelines: text('submissionGuidelines'),
  icpNumber: text('icpNumber'),
  enableSubmissionLimit: boolean('enableSubmissionLimit').default(false).notNull(),
  dailySubmissionLimit: integer('dailySubmissionLimit'),
  weeklySubmissionLimit: integer('weeklySubmissionLimit'),
  showBlacklistKeywords: boolean('showBlacklistKeywords').default(false).notNull(),
  hideStudentInfo: boolean('hideStudentInfo').default(true).notNull(),
  // SMTP 邮件配置
  smtpEnabled: boolean('smtpEnabled').default(false).notNull(),
  smtpHost: text('smtpHost'),
  smtpPort: integer('smtpPort').default(587),
  smtpSecure: boolean('smtpSecure').default(false).notNull(),
  smtpUsername: text('smtpUsername'),
  smtpPassword: text('smtpPassword'),
  smtpFromEmail: text('smtpFromEmail'),
  smtpFromName: text('smtpFromName'),
});

// 歌曲黑名单表
export const songBlacklists = pgTable('SongBlacklist', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('createdAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  updatedAt: timestamp('updatedAt').default(sql`${getBeijingTimestamp()}`).notNull(),
  type: blacklistTypeEnum('type').notNull(),
  value: text('value').notNull(),
  reason: text('reason'),
  isActive: boolean('isActive').default(true).notNull(),
  createdBy: integer('createdBy'),
});

// API Keys表
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 10 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`${getBeijingTimestamp()}`).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`${getBeijingTimestamp()}`).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdByUserId: integer('created_by_user_id').notNull(),
  usageCount: integer('usage_count').default(0).notNull(),

});

// API Key权限表
export const apiKeyPermissions = pgTable('api_key_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  apiKeyId: uuid('api_key_id').notNull(),
  permission: varchar('permission', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`${getBeijingTimestamp()}`).notNull(),
});

// API访问日志表
export const apiLogs = pgTable('api_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  apiKeyId: uuid('api_key_id'),
  endpoint: varchar('endpoint', { length: 500 }).notNull(),
  method: varchar('method', { length: 10 }).notNull(),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),
  statusCode: integer('status_code').notNull(),
  responseTimeMs: integer('response_time_ms').notNull(),
  requestBody: text('request_body'),
  responseBody: text('response_body'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`${getBeijingTimestamp()}`).notNull(),
  errorMessage: text('error_message'),
});

// 关系定义
export const usersRelations = relations(users, ({ many, one }) => ({
  songs: many(songs),
  votes: many(votes),
  notifications: many(notifications),
  notificationSettings: one(notificationSettings, {
    fields: [users.id],
    references: [notificationSettings.userId],
  }),
  apiKeys: many(apiKeys),
}));

export const songsRelations = relations(songs, ({ one, many }) => ({
  requester: one(users, {
    fields: [songs.requesterId],
    references: [users.id],
  }),
  preferredPlayTime: one(playTimes, {
    fields: [songs.preferredPlayTimeId],
    references: [playTimes.id],
  }),
  votes: many(votes),
  schedules: many(schedules),
  notifications: many(notifications),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  song: one(songs, {
    fields: [votes.songId],
    references: [songs.id],
  }),
  user: one(users, {
    fields: [votes.userId],
    references: [users.id],
  }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  song: one(songs, {
    fields: [schedules.songId],
    references: [songs.id],
  }),
  playTime: one(playTimes, {
    fields: [schedules.playTimeId],
    references: [playTimes.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  song: one(songs, {
    fields: [notifications.songId],
    references: [songs.id],
  }),
}));

export const notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
  user: one(users, {
    fields: [notificationSettings.userId],
    references: [users.id],
  }),
}));

export const playTimesRelations = relations(playTimes, ({ many }) => ({
  songs: many(songs),
  schedules: many(schedules),
}));

// API框架关系定义
export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [apiKeys.createdByUserId],
    references: [users.id],
  }),
  permissions: many(apiKeyPermissions),
  logs: many(apiLogs),
}));

export const apiKeyPermissionsRelations = relations(apiKeyPermissions, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [apiKeyPermissions.apiKeyId],
    references: [apiKeys.id],
  }),
}));

export const apiLogsRelations = relations(apiLogs, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [apiLogs.apiKeyId],
    references: [apiKeys.id],
  }),
}));

// 导出所有表的类型
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Song = typeof songs.$inferSelect;
export type NewSong = typeof songs.$inferInsert;
export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type NewNotificationSettings = typeof notificationSettings.$inferInsert;
export type PlayTime = typeof playTimes.$inferSelect;
export type NewPlayTime = typeof playTimes.$inferInsert;
export type Semester = typeof semesters.$inferSelect;
export type NewSemester = typeof semesters.$inferInsert;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type NewSystemSettings = typeof systemSettings.$inferInsert;
export type SongBlacklist = typeof songBlacklists.$inferSelect;
export type NewSongBlacklist = typeof songBlacklists.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyPermission = typeof apiKeyPermissions.$inferSelect;
export type NewApiKeyPermission = typeof apiKeyPermissions.$inferInsert;
export type ApiLog = typeof apiLogs.$inferSelect;
export type NewApiLog = typeof apiLogs.$inferInsert;