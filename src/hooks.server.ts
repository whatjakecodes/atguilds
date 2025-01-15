import { createClient } from '$lib/server/oauthClient.server';
import { createDb, migrateToLatest } from '$lib/server/db';
import { DB_PATH } from '$env/static/private';

const db = createDb(DB_PATH);
await migrateToLatest(db);
const client = await createClient(db);

export async function handle({ event, resolve }) {
	const sessionId = event.cookies.get('sid') || null;
	console.log(`found sessionID: ${sessionId} (${event.request.method} ${event.url})`);
	event.locals.session = sessionId ? { did: sessionId } : undefined;
	event.locals.client = client;
	return await resolve(event);
}
