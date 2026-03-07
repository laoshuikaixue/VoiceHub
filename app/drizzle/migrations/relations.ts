import { relations } from "drizzle-orm/relations";
import { user, userIdentity } from "./schema";

export const userIdentityRelations = relations(userIdentity, ({one}) => ({
	user: one(user, {
		fields: [userIdentity.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	userIdentities: many(userIdentity),
}));