import {
	type GeneratedAlways,
	Kysely,
	type Migration,
	type MigrationProvider,
	Migrator
} from 'kysely';

import { NeonDialect } from 'kysely-neon';
import { neonConfig } from '@neondatabase/serverless';

// Types
export type DatabaseSchema = {
	auth_session: AuthSession;
	auth_state: AuthState;
	guild: Guild;
	guild_member: GuildMember;
	guild_invite: NewGuildInvite;
};

export type AuthSession = {
	key: string;
	session: AuthSessionJson;
};

export type AuthState = {
	key: string;
	state: AuthStateJson;
};

type AuthStateJson = string;

type AuthSessionJson = string;

export type Guild = {
	uri: string;
	cid: string;
	creatorDid: string;
	name: string;
	leaderDid: string;
	createdAt: string;
	indexedAt: string;
};

type GuildInviteBase = {
	guildUri: string;
	invitee: string;
	createdAt: string;
	acceptedAt?: string;
};

export type NewGuildInvite = GuildInviteBase & {
	id: GeneratedAlways<number>;
};

export type ExistingGuildInvite = GuildInviteBase & {
	id: number;
};

export type GuildMember = {
	uri: string;
	memberDid: string;
	guildUri: string;
	createdAt: string;
	indexedAt: string;
};

// Migrations
const migrations: Record<string, Migration> = {};

const migrationProvider: MigrationProvider = {
	async getMigrations() {
		return migrations;
	}
};

migrations['001'] = {
	async up(db: Kysely<unknown>) {
		await db.schema
			.createTable('auth_session')
			.addColumn('key', 'varchar', (col) => col.primaryKey())
			.addColumn('session', 'varchar', (col) => col.notNull())
			.execute();
		await db.schema
			.createTable('auth_state')
			.addColumn('key', 'varchar', (col) => col.primaryKey())
			.addColumn('state', 'varchar', (col) => col.notNull())
			.execute();
	},
	async down(db: Kysely<unknown>) {
		await db.schema.dropTable('auth_state').execute();
		await db.schema.dropTable('auth_session').execute();
	}
};

migrations['002'] = {
	async up(db: Kysely<unknown>): Promise<void> {
		// Create Guild table
		await db.schema
			.createTable('guild')
			.addColumn('uri', 'varchar', (col) => col.primaryKey().notNull())
			.addColumn('cid', 'varchar', (col) => col.notNull())
			.addColumn('creatorDid', 'varchar', (col) => col.notNull())
			.addColumn('name', 'varchar', (col) => col.notNull())
			.addColumn('leaderDid', 'varchar', (col) => col.notNull())
			.addColumn('createdAt', 'varchar', (col) => col.notNull())
			.addColumn('indexedAt', 'varchar', (col) => col.notNull())
			.execute();

		// Create indexes for Guild table
		await db.schema.createIndex('guild_creator_did_idx').on('guild').column('creatorDid').execute();
		await db.schema.createIndex('guild_leader_did_idx').on('guild').column('leaderDid').execute();

		// Create GuildMember table
		await db.schema
			.createTable('guild_member')
			.addColumn('uri', 'varchar', (col) => col.primaryKey().notNull())
			.addColumn('memberDid', 'varchar', (col) => col.notNull())
			.addColumn('guildUri', 'varchar', (col) =>
				col.notNull().references('guild.uri').onDelete('cascade')
			)
			.addColumn('createdAt', 'varchar', (col) => col.notNull())
			.addColumn('indexedAt', 'varchar', (col) => col.notNull())
			.execute();

		// Create indexes for GuildMember table
		await db.schema
			.createIndex('guild_member_member_did_idx')
			.on('guild_member')
			.column('memberDid')
			.execute();

		await db.schema
			.createIndex('guild_member_guild_uri_idx')
			.on('guild_member')
			.column('guildUri')
			.execute();
	},

	async down(db: Kysely<unknown>): Promise<void> {
		await db.schema.dropTable('guild_member').execute();
		await db.schema.dropTable('guild').execute();
	}
};

migrations['003'] = {
	async up(db: Kysely<unknown>) {
		await db.schema
			.createTable('guild_invite')
			.addColumn('id', 'serial', (col) => col.primaryKey())
			.addColumn('guildUri', 'varchar', (col) => col.notNull())
			.addColumn('invitee', 'varchar', (col) => col.notNull())
			.addColumn('createdAt', 'varchar', (col) => col.notNull())
			.addColumn('acceptedAt', 'varchar')
			.execute();
	},
	async down(db: Kysely<unknown>) {
		await db.schema.dropTable('guild_invite').execute();
	}
};

if (!process.env.VERCEL_ENV) {
	// from https://gal.hagever.com/posts/running-vercel-postgres-locally
	console.log('VERCEL_ENV not found. Setting up local websocket proxy.');
	// Set the WebSocket proxy to work with the local instance
	neonConfig.wsProxy = (host) => `${host}:5433/v1`;
	// Disable all authentication and encryption
	neonConfig.useSecureWebSocket = false;
	neonConfig.pipelineTLS = false;
	neonConfig.pipelineConnect = false;
}

// APIs
export const createDb = (location: string): Database => {
	console.log(`createDB with location: ${location}`);
	return new Kysely<DatabaseSchema>({
		dialect: new NeonDialect({
			connectionString: location
		})
	});
};

export const migrateToLatest = async (db: Database) => {
	console.log(`db.migrateToLatest start`);
	const migrator = new Migrator({ db, provider: migrationProvider });
	const { error } = await migrator.migrateToLatest();
	if (error) throw error;
	console.log(`db.migrateToLatest complete`);
};

export type Database = Kysely<DatabaseSchema>;
