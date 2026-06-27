import type { RequestHandler } from '@sveltejs/kit';
import syncService, { DEFAULT_SYNC_MIN_INTERVAL_MS } from '$lib/server/syncService';
import { getAgent } from '$lib/server/agent';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ locals, cookies }) => {
	const agent = await getAgent(cookies, locals.session, locals.oauthClient);
	if (!agent) {
		return new Response(JSON.stringify({ success: false }), {
			headers: {
				'content-type': 'application/json'
			}
		});
	}

	const parsed = Number(env.SYNC_MIN_INTERVAL_MS);
	const intervalMs = Number.isNaN(parsed) ? DEFAULT_SYNC_MIN_INTERVAL_MS : parsed;

	const result = await syncService.runSync(agent, locals.db, locals.resolver, {
		intervalMs,
		now: new Date()
	});

	if (result.rateLimited) {
		return new Response(
			JSON.stringify({
				success: false,
				error: 'rate_limited',
				retryAfterSeconds: result.retryAfterSeconds
			}),
			{
				status: 429,
				headers: {
					'content-type': 'application/json',
					'retry-after': String(result.retryAfterSeconds)
				}
			}
		);
	}

	return new Response(JSON.stringify({ success: true, summary: result.summary }), {
		headers: {
			'content-type': 'application/json'
		}
	});
};
