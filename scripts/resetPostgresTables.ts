import { createDb } from '../src/lib/server/db';
import 'dotenv/config'

const db = createDb(process.env.DATABASE_URL);

async function clearTables() {
	try {
		await db.deleteFrom('guild_invite').execute();
		await db.deleteFrom('guild_member').execute();
		await db.deleteFrom('guild').execute();

		console.log('All tables cleared successfully');
	} catch (error) {
		console.error('Error clearing tables:', error);
		process.exit(1);
	} finally {
		await db.destroy();
	}
}

clearTables();
