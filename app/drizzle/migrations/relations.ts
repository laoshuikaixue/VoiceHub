import { relations } from "drizzle-orm/relations";
import { user, userIdentity, backupSchedules, backupHistory } from "./schema";

export const userIdentityRelations = relations(userIdentity, ({one}) => ({
	user: one(user, {
		fields: [userIdentity.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	userIdentities: many(userIdentity),
}));

export const backupHistoryRelations = relations(backupHistory, ({one}) => ({
	backupSchedule: one(backupSchedules, {
		fields: [backupHistory.scheduleId],
		references: [backupSchedules.id]
	}),
}));

export const backupSchedulesRelations = relations(backupSchedules, ({many}) => ({
	backupHistories: many(backupHistory),
}));