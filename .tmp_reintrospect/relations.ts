import { relations } from "drizzle-orm/relations";
import { user, userStatusLogs, apiKeys, apiKeyPermissions, apiLogs, userIdentity, cardCode, song, cardCodeRedeemLog } from "./schema";

export const userStatusLogsRelations = relations(userStatusLogs, ({one}) => ({
	user_userId: one(user, {
		fields: [userStatusLogs.userId],
		references: [user.id],
		relationName: "userStatusLogs_userId_user_id"
	}),
	user_operatorId: one(user, {
		fields: [userStatusLogs.operatorId],
		references: [user.id],
		relationName: "userStatusLogs_operatorId_user_id"
	}),
}));

export const userRelations = relations(user, ({one, many}) => ({
	userStatusLogs_userId: many(userStatusLogs, {
		relationName: "userStatusLogs_userId_user_id"
	}),
	userStatusLogs_operatorId: many(userStatusLogs, {
		relationName: "userStatusLogs_operatorId_user_id"
	}),
	apiKeys: many(apiKeys),
	userIdentities: many(userIdentity),
	cardCodes_lockedBy: many(cardCode, {
		relationName: "cardCode_lockedBy_user_id"
	}),
	cardCodes_redeemedBy: many(cardCode, {
		relationName: "cardCode_redeemedBy_user_id"
	}),
	cardCodeRedeemLogs: many(cardCodeRedeemLog),
	user: one(user, {
		fields: [user.statusChangedBy],
		references: [user.id],
		relationName: "user_statusChangedBy_user_id"
	}),
	users: many(user, {
		relationName: "user_statusChangedBy_user_id"
	}),
}));

export const apiKeysRelations = relations(apiKeys, ({one, many}) => ({
	user: one(user, {
		fields: [apiKeys.createdByUserId],
		references: [user.id]
	}),
	apiKeyPermissions: many(apiKeyPermissions),
	apiLogs: many(apiLogs),
}));

export const apiKeyPermissionsRelations = relations(apiKeyPermissions, ({one}) => ({
	apiKey: one(apiKeys, {
		fields: [apiKeyPermissions.apiKeyId],
		references: [apiKeys.id]
	}),
}));

export const apiLogsRelations = relations(apiLogs, ({one}) => ({
	apiKey: one(apiKeys, {
		fields: [apiLogs.apiKeyId],
		references: [apiKeys.id]
	}),
}));

export const userIdentityRelations = relations(userIdentity, ({one}) => ({
	user: one(user, {
		fields: [userIdentity.userId],
		references: [user.id]
	}),
}));

export const cardCodeRelations = relations(cardCode, ({one, many}) => ({
	user_lockedBy: one(user, {
		fields: [cardCode.lockedBy],
		references: [user.id],
		relationName: "cardCode_lockedBy_user_id"
	}),
	user_redeemedBy: one(user, {
		fields: [cardCode.redeemedBy],
		references: [user.id],
		relationName: "cardCode_redeemedBy_user_id"
	}),
	songs: many(song),
	cardCodeRedeemLogs: many(cardCodeRedeemLog),
}));

export const songRelations = relations(song, ({one, many}) => ({
	cardCode: one(cardCode, {
		fields: [song.cardCodeId],
		references: [cardCode.id]
	}),
	cardCodeRedeemLogs: many(cardCodeRedeemLog),
}));

export const cardCodeRedeemLogRelations = relations(cardCodeRedeemLog, ({one}) => ({
	user: one(user, {
		fields: [cardCodeRedeemLog.redeemedBy],
		references: [user.id]
	}),
	song: one(song, {
		fields: [cardCodeRedeemLog.songId],
		references: [song.id]
	}),
	cardCode: one(cardCode, {
		fields: [cardCodeRedeemLog.cardCodeId],
		references: [cardCode.id]
	}),
}));