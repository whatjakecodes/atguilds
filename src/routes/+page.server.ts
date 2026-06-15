import guildService, { BROWSE_PAGE_SIZE } from '$lib/server/guildService';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ locals, url }) => {
	const pageParam = parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
	const offset = (page - 1) * BROWSE_PAGE_SIZE;

	const { guilds, total } = await guildService.getAllGuilds(locals.db, {
		limit: BROWSE_PAGE_SIZE,
		offset
	});

	const leaderHandleMap = await locals.resolver.resolveDidsToHandles(
		guilds.map((g) => g.leaderDid)
	);

	return {
		guilds,
		leaderHandleMap,
		page,
		total,
		pageSize: BROWSE_PAGE_SIZE
	};
};
