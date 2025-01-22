import { redirect } from '@sveltejs/kit';

export const actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const handle = data.get('handle') as string;
		const url = await locals.oauthClient.authorize(handle, {
			scope: 'atproto transition:generic'
		});

		throw redirect(303, url);
	}
};
