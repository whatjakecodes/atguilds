import { createClient } from '$lib/server/oauthClient.server';
import { createDb, migrateToLatest } from '$lib/server/db';
import { DB_PATH } from '$env/static/private';
import { building } from '$app/environment';
import { createBidirectionalResolver, createIdResolver } from '$lib/server/id-resolver';

const db = createDb(DB_PATH);
await migrateToLatest(db);

export async function handle({ event, resolve }) {
	if (!building) {
		// skip oauth client setup during build-time pre-rendering
		const client = await createClient(db!);
		const sessionId = event.cookies.get('sid') || null;
		event.locals.session = sessionId ? { did: sessionId } : undefined;
		event.locals.client = client;
		event.locals.db = db;

		const baseIdResolver = createIdResolver()
		event.locals.resolver = createBidirectionalResolver(baseIdResolver);
	}

	return await resolve(event);
}
