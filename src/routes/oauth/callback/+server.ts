// src/routes/oauth/callback/+server.ts
import { redirect, type RequestHandler } from '@sveltejs/kit';
// import { COOKIE_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const params = url.searchParams;
	try {
		const { session } = await locals.client.callback(params);

		// todo: encrypt this or secure it otherwise
		cookies.set('sid', session.did, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});
	} catch (err) {
		console.error({ err }, 'oauth callback failed');
		throw redirect(303, '/?error');
	}

	throw redirect(303, '/');
};
