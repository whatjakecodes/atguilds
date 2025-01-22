import { createClient } from '$lib/server/oauthClient.server';
import { createDb, migrateToLatest } from '$lib/server/db';
import { DATABASE_URL } from '$env/static/private';
import { building } from '$app/environment';
import { createBidirectionalResolver, createIdResolver } from '$lib/server/id-resolver';

if (!DATABASE_URL) {
	throw new Error('DATABASE_URL is not set.');
}

const db = createDb(DATABASE_URL);
await migrateToLatest(db);

export async function handle({ event, resolve }) {
	if (!building) {
		// skip oauth client setup during build-time pre-rendering
		const client = await createClient(db!);
		const sessionId = event.cookies.get('sid') || null;
		event.locals.session = sessionId ? { did: sessionId } : undefined;
		event.locals.oauthClient = client;
		event.locals.db = db;

		const baseIdResolver = createIdResolver();
		event.locals.resolver = createBidirectionalResolver(baseIdResolver);
	}

	return await resolve(event);
}
