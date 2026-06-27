export type Session = { did: string };

export interface SyncSummary {
	guilds: {
		created: { uri: string; name: string }[];
		deleted: string[]; // guild uris
	};
	guildMemberClaims: {
		created: string[]; // member claim uris
		deleted: string[]; // member claim uris
	};
}
