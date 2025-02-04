import { redirect } from '@sveltejs/kit';

export const actions = {
	login: async ({ request, locals }) => {
		const data = await request.formData();
		const handle = data.get('handle') as string;
		const url = await locals.oauthClient.authorize(handle, {
			scope: 'atproto transition:generic'
		});

		throw redirect(303, url);
	},
	logout: async ({ locals, cookies }) => {
		if (locals.session) {
			await locals.oauthClient.revoke(locals.session.did);
		}

		cookies.delete('sid', {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});

		throw redirect(303, '/');
	}
};
