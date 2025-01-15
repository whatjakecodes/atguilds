import SqliteDb from 'better-sqlite3'
import { Kysely, Migrator, SqliteDialect, type MigrationProvider, type Migration } from 'kysely';

// Types

export type DatabaseSchema = {
	auth_session: AuthSession;
	auth_state: AuthState;
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

// APIs

export const createDb = (location: string): Database => {
	console.log(`createDB with location: ${location}`);
	return new Kysely<DatabaseSchema>({
		dialect: new SqliteDialect({
			database: new SqliteDb(location)
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
