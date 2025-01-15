import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	const clientMetadata = locals.client.clientMetadata;
	return new Response(JSON.stringify(clientMetadata), {
		headers: {
			'content-type': 'application/json'
		}
	});
};
