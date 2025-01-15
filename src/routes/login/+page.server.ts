import { redirect } from '@sveltejs/kit';

export const actions = {
	default: async ({request, locals}) => {
		console.log("hi from server");

		const data = await request.formData();
		const handle = data.get('handle') as string;

		console.log({handle});
		const url = await locals.client.authorize(handle, {
			scope: 'atproto transition:generic',
		})

		throw redirect(303, url);
	}
}

