import type { ComAtprotoRepoApplyWrites, ComAtprotoRepoGetRecord } from '@atproto/api';
import { Agent, AtpAgent, AtUri } from '@atproto/api';
import { ids } from '$lib/lexicon/lexicons';
import * as GuildRecord from '$lib/lexicon/types/dev/jakestout/atguilds/guild';
import * as GuildMemberClaimRecord from '$lib/lexicon/types/dev/jakestout/atguilds/guildMemberClaim';
import { TID } from '@atproto/common';
import type { Database, ExistingGuildInvite, Guild, GuildMember } from '$lib/server/db';
import type { BidirectionalResolver } from '$lib/server/id-resolver';
import type { SyncSummary } from '$lib/types';

function emptySyncSummary(): SyncSummary {
	return {
		guilds: { created: [], deleted: [] },
		guildMemberClaims: { created: [], deleted: [] }
	};
}

async function create(agent: Agent, db: Database, guildName: string) {
	const leaderDid = agent.assertDid;
	const createdAt = new Date().toISOString();
	const inputGuild: GuildRecord.Record = {
		$type: ids.DevJakestoutAtguildsGuild,
		name: guildName,
		leader: leaderDid,
		members: [{ did: leaderDid, addedAt: createdAt }],
		createdAt
	};

	const guild = GuildRecord.validateRecord(inputGuild);
	if (!guild.success) {
		console.error(guild.error);
		return null;
	}
	const guildRkey = TID.nextStr();

	const inputGuildMemberClaim: GuildMemberClaimRecord.Record = {
		$type: ids.DevJakestoutAtguildsGuildMemberClaim,
		guildUri: getGuildUri(leaderDid, guildRkey),
		createdAt: new Date().toISOString()
	};

	const guildMemberClaim = GuildMemberClaimRecord.validateRecord(inputGuildMemberClaim);
	if (!guildMemberClaim.success) {
		console.error(guildMemberClaim.error);
		return null;
	}

	const guildRecord = guild.value as GuildRecord.Record;
	const guildMemberClaimRecord = guildMemberClaim.value as GuildMemberClaimRecord.Record;

	const response = await agent.com.atproto.repo.applyWrites({
		repo: leaderDid,
		writes: [
			{
				$type: 'com.atproto.repo.applyWrites#create',
				collection: ids.DevJakestoutAtguildsGuild,
				rkey: guildRkey,
				value: guildRecord
			},
			{
				$type: 'com.atproto.repo.applyWrites#create',
				collection: ids.DevJakestoutAtguildsGuildMemberClaim,
				rkey: TID.nextStr(),
				value: guildMemberClaimRecord
			}
		]
	});

	console.log(`Got applyWrites#create response`, { response });

	if (!response.success || !response.data.results || response.data.results.length !== 2) {
		console.error(`Failed to create guild: ${response}`);
		return null;
	}

	const createGuildResult = response.data.results[0];
	const createGuildMemberClaimResult = response.data.results[1];
	if (
		!isCreateWriteResult(createGuildResult) ||
		!isCreateWriteResult(createGuildMemberClaimResult)
	) {
		console.error('applyWrites did not return expected create results');
		return null;
	}
	const guildUri = createGuildResult.uri;
	const guildCid = createGuildResult.cid;
	const guildMemberUri = createGuildMemberClaimResult.uri;

	console.log(`Successfully created AT guild: ${inputGuild.name}`);
	await db.transaction().execute(async (trx) => {
		await trx
			.insertInto('guild')
			.values({
				uri: guildUri,
				cid: guildCid,
				name: inputGuild.name,
				creatorDid: leaderDid,
				leaderDid: leaderDid,
				createdAt: inputGuild.createdAt,
				indexedAt: inputGuild.createdAt
			})
			.execute();

		await trx
			.insertInto('guild_member')
			.values({
				uri: guildMemberUri,
				memberDid: leaderDid,
				guildUri: guildUri,
				createdAt: inputGuild.createdAt,
				indexedAt: inputGuild.createdAt,
				addedAt: createdAt
			})
			.execute();
	});

	console.log(`Successfully created local cache of guild`);

	return createGuildResult;
}

async function GetClaimedGuildsFromPDS(guildUris: AtUri[], resolver: BidirectionalResolver) {
	const unvalidatedGuilds = [];
	for (const uri of guildUris) {
		const guildLeaderRepo = uri.hostname;
		const guildRkey = uri.rkey;

		console.log('fetching guild...');
		try {
			// this agent can get data from various PDS endpoints.
			const endpoint = await resolver.resolvePDSEndpoint(guildLeaderRepo);
			const agent = new AtpAgent({ service: endpoint });
			const { data } = await agent.com.atproto.repo.getRecord({
				repo: guildLeaderRepo,
				collection: ids.DevJakestoutAtguildsGuild,
				rkey: guildRkey
			});
			unvalidatedGuilds.push(data);
		} catch (err) {
			console.error(`failed to fetch guild via: ${uri}`);
			console.error({ err });
		}
	}

	return unvalidatedGuilds
		.map((record) => {
			const validatedGuild = getValidatedGuild(record);

			if (!validatedGuild) {
				return null;
			}

			console.log(`got PDS guild: ${validatedGuild.name}`);

			return {
				cid: record.cid,
				uri: record.uri,
				guild: validatedGuild as GuildRecord.Record
			};
		})
		.filter((record) => !!record);
}

async function getGuildsByLeaderFromPDS(agent: Agent) {
	const response = await agent.com.atproto.repo.listRecords({
		repo: agent.assertDid,
		collection: ids.DevJakestoutAtguildsGuild
	});

	if (!response.success) {
		throw Error('failed to fetch guilds user is leader of');
	}

	const results = [];
	for (const record of response.data.records) {
		// One-time upgrade: rewrite legacy records (bare-DID members) on the leader's own PDS
		// into the current { did, addedAt } shape. Best-effort — a failed write must not break sync.
		if (isLegacyGuildMembers(record.value)) {
			try {
				const upgraded = coerceLegacyGuild(record.value as Record<string, unknown>);
				await agent.com.atproto.repo.putRecord({
					repo: agent.assertDid,
					collection: ids.DevJakestoutAtguildsGuild,
					rkey: new AtUri(record.uri).rkey,
					record: upgraded
				});
				record.value = upgraded;
				console.log(`upgraded legacy guild record ${record.uri}`);
			} catch (err) {
				console.error(`failed to upgrade legacy guild record ${record.uri}`, { err });
			}
		}

		const validatedGuild = getValidatedGuild(record);
		if (!validatedGuild) continue;

		console.log(`got PDS guild by leader: ${validatedGuild.name}`);
		results.push({
			cid: record.cid,
			uri: record.uri,
			guild: validatedGuild as GuildRecord.Record
		});
	}
	return results;
}

async function GetOtherMemberClaimsFromPDS(
	guildMembers: string[],
	userGuildUris: AtUri[],
	resolver: BidirectionalResolver
) {
	const unvalidated = [];
	for (const memberDID of guildMembers) {
		const endpoint = await resolver.resolvePDSEndpoint(memberDID);
		const agent = new AtpAgent({ service: endpoint });
		const response = await agent.com.atproto.repo.listRecords({
			repo: memberDID,
			collection: ids.DevJakestoutAtguildsGuildMemberClaim
		});

		if (response.success) {
			unvalidated.push(...response.data.records);
		} else {
			console.error(`Failed to member claim records for ${memberDID}`);
		}
	}

	const unique = unvalidated.filter((obj, index, arr) => {
		const firstMatchIndex = arr.findIndex((item) => item.uri === obj.uri);
		return firstMatchIndex === index;
	});
	return unique
		.map((record) => {
			const validated = getValidatedGuildMemberClaim(record);
			if (!validated) {
				return null;
			}
			console.log(`got PDS member claim: ${new AtUri(record.uri).hostname}`);
			return {
				cid: record.cid,
				uri: new AtUri(record.uri),
				guildMemberClaim: validated
			};
		})
		.filter((record) => !!record)
		.filter((record) => {
			// ensure this membership is for one of the user's guilds
			// only syncing guilds for the session user
			const guildUri = new AtUri(record.guildMemberClaim.guildUri);
			const index = userGuildUris.findIndex(
				(uri) => uri.hostname === guildUri.hostname && uri.pathname === guildUri.pathname
			);
			return index >= 0;
		});
}

async function GetMemberClaimsFromPDS(agent: Agent) {
	const { data } = await agent.com.atproto.repo.listRecords({
		repo: agent.assertDid,
		collection: ids.DevJakestoutAtguildsGuildMemberClaim
	});

	return data.records
		.map((record) => {
			const v = getValidatedGuildMemberClaim(record);

			if (!v) {
				return null;
			}

			return {
				cid: record.cid,
				uri: record.uri,
				guildMemberClaim: v
			};
		})
		.filter((record) => !!record);
}

async function syncLocals(
	agent: Agent | null,
	db: Database,
	resolver: BidirectionalResolver
): Promise<SyncSummary> {
	const summary = emptySyncSummary();
	if (!agent) return summary;
	const userDid = agent.assertDid;
	const indexedAt = new Date().toISOString();

	console.log(`begin syncLocals for ${userDid}`);
	// fetch guilds user claims to be a member of
	const pdsGuildMemberClaimRecords = await GetMemberClaimsFromPDS(agent);
	const guildUris = pdsGuildMemberClaimRecords.map(
		(claim) => new AtUri(claim?.guildMemberClaim.guildUri)
	);

	// fetch actual guild objects from leader PDSes
	const pdsGuilds = await GetClaimedGuildsFromPDS(guildUris, resolver);
	const guildMemberDIDs = pdsGuilds.flatMap((record) => record.guild.members.map((m) => m.did));

	// fetch other guild members from PDSes
	const pdsOtherMembers = await GetOtherMemberClaimsFromPDS(guildMemberDIDs, guildUris, resolver);

	// get existing db records
	const dbMembers = await getExistingGuildMembers(guildUris, db);
	const dbGuilds = await getExistingGuilds(guildUris, db);

	// add missing records to database
	const guildsToAdd = pdsGuilds.filter((record) => {
		const existingLocal = dbGuilds.find((dbG) => {
			return dbG.uri == record.uri;
		});
		return !existingLocal;
	});

	const guildMembersToAdd = pdsOtherMembers
		.filter((record) => {
			const memberDid = record.uri.hostname;
			const isInGuild = pdsGuilds.find(
				(guildRecord) =>
					guildRecord.uri === record.guildMemberClaim.guildUri &&
					guildRecord.guild.members.some((m) => m.did === memberDid)
			);
			const existingLocal = dbMembers.find((dbM) => dbM.uri === record.uri.toString());
			return !existingLocal && isInGuild;
		})
		.filter((r) => !!r);

	await db.transaction().execute(async (trx) => {
		if (guildsToAdd.length > 0) {
			const guildsToInsert = guildsToAdd.map((record) => ({
				uri: record.uri,
				cid: record.cid!,
				name: record.guild.name,
				createdAt: record.guild.createdAt,
				creatorDid: record.guild.leader,
				leaderDid: record.guild.leader,
				indexedAt: indexedAt
			}));
			console.log({ guildsToInsert });
			await trx.insertInto('guild').values(guildsToInsert).execute();
			summary.guilds.created = guildsToInsert.map((g) => ({ uri: g.uri, name: g.name }));
		}
	});

	await db.transaction().execute(async (trx) => {
		if (guildMembersToAdd.length > 0) {
			const membersToInsert = guildMembersToAdd.map((record) => {
				const memberDid = record.uri.hostname;
				const guildRec = pdsGuilds.find((g) => g.uri === record.guildMemberClaim.guildUri);
				const addedAt = guildRec?.guild.members.find((m) => m.did === memberDid)?.addedAt ?? null;
				return {
					uri: record.uri.toString(),
					guildUri: record.guildMemberClaim.guildUri,
					memberDid,
					createdAt: record.guildMemberClaim.createdAt,
					indexedAt: indexedAt,
					addedAt
				};
			});
			console.log({ membersToInsert });
			await trx.insertInto('guild_member').values(membersToInsert).execute();
			summary.guildMemberClaims.created = membersToInsert.map((m) => m.uri);
		}
	});

	// prune stale members: a guild_member is valid only if its claim still exists on the
	// member's PDS AND the member is still in the guild record's `members` array
	// (bi-directional validity). pdsOtherMembers holds the claims that currently exist for
	// the user's guilds, so any cached member missing from that set is stale.
	// NOTE: GetOtherMemberClaimsFromPDS / GetClaimedGuildsFromPDS swallow per-PDS fetch
	// errors, so a transient failure could momentarily treat a valid member as stale. We
	// scope pruning to guilds we successfully fetched (fetchedGuildUris) to limit the blast
	// radius if a leader's PDS is unreachable.
	const fetchedGuildUris = new Set<string>(pdsGuilds.map((record) => record.uri));
	const validMemberClaimUris = new Set<string>(
		pdsOtherMembers
			.filter((record) => {
				const memberDid = record.uri.hostname;
				return pdsGuilds.some(
					(guildRecord) =>
						guildRecord.uri === record.guildMemberClaim.guildUri &&
						guildRecord.guild.members.some((m) => m.did === memberDid)
				);
			})
			.map((record) => record.uri.toString())
	);

	const staleMemberUris = dbMembers
		.filter((dbM) => fetchedGuildUris.has(dbM.guildUri) && !validMemberClaimUris.has(dbM.uri))
		.map((dbM) => dbM.uri);

	if (staleMemberUris.length > 0) {
		const staleDeleteResult = await db
			.deleteFrom('guild_member')
			.where('uri', 'in', staleMemberUris)
			.execute();
		console.log(`deleted ${staleDeleteResult.length} stale guild members during sync`);
	}
	summary.guildMemberClaims.deleted = staleMemberUris;

	// delete cached guilds user is leader of, that are not in their PDS anymore. When the
	// user leads no guilds on their PDS, every cached guild they lead is stale (and an empty
	// `not in ()` is invalid SQL), so drop them all. Select the stale uris first so we can
	// report exactly which guilds were removed in the summary.
	const pdsGuildsUserLeads = await getGuildsByLeaderFromPDS(agent);
	const guildsILeadURIs = pdsGuildsUserLeads.map((g) => g?.uri).filter((uri) => !!uri);
	let staleLeaderGuildQuery = db.selectFrom('guild').select('uri').where('leaderDid', '=', userDid);
	if (guildsILeadURIs.length > 0) {
		staleLeaderGuildQuery = staleLeaderGuildQuery.where('uri', 'not in', guildsILeadURIs);
	}
	const deletedGuildUris = (await staleLeaderGuildQuery.execute()).map((g) => g.uri);
	if (deletedGuildUris.length > 0) {
		await db.deleteFrom('guild').where('uri', 'in', deletedGuildUris).execute();
	}
	summary.guilds.deleted = deletedGuildUris;

	console.log(`deleted ${deletedGuildUris.length} guilds during sync`);

	return summary;
}

// A pre-`addedAt` guild record stores `members` as an array of bare DID strings. Detect that
// shape so we can upgrade it to the current `{ did, addedAt }` form.
function isLegacyGuildMembers(value: unknown): value is { members: string[]; createdAt: string } {
	if (typeof value !== 'object' || value === null) return false;
	const members = (value as { members?: unknown }).members;
	return (
		Array.isArray(members) && members.length > 0 && members.every((m) => typeof m === 'string')
	);
}

// Upgrade a legacy guild record's `members` (bare DIDs) to `{ did, addedAt }`, defaulting each
// member's addedAt to the guild's createdAt (best available date for previously-undated members).
function coerceLegacyGuild(value: Record<string, unknown>): Record<string, unknown> {
	const members = (value.members as string[]).map((did) => ({
		did,
		addedAt: value.createdAt as string
	}));
	return { ...value, members };
}

function getValidatedGuild(
	record: ComAtprotoRepoGetRecord.OutputSchema
): GuildRecord.Record | null {
	const value = isLegacyGuildMembers(record.value)
		? coerceLegacyGuild(record.value as Record<string, unknown>)
		: record.value;
	const isGuild = GuildRecord.isRecord(value);
	if (!isGuild) return null;
	const validation = GuildRecord.validateRecord(value);
	if (validation.success) {
		return validation.value as GuildRecord.Record;
	} else {
		const error = validation.error;
		console.warn('Invalid guild found', { error });
		return null;
	}
}

function getValidatedGuildMemberClaim(
	record: ComAtprotoRepoGetRecord.OutputSchema
): GuildMemberClaimRecord.Record | null {
	const isGuildMemberClaim = GuildMemberClaimRecord.isRecord(record.value);
	if (!isGuildMemberClaim) return null;
	const validation = GuildMemberClaimRecord.validateRecord(record.value);
	if (validation.success) {
		return validation.value as GuildMemberClaimRecord.Record;
	} else {
		const error = validation.error;
		console.warn('Invalid guild member claim found', { error });
		return null;
	}
}

async function getExistingGuilds(pdsGuildURIs: AtUri[], db: Database): Promise<Guild[]> {
	if (pdsGuildURIs.length === 0) return [];
	const uriStrings = pdsGuildURIs.map((uri) => uri.toString());
	return await db.selectFrom('guild').where('uri', 'in', uriStrings).selectAll().execute();
}

export const BROWSE_PAGE_SIZE = 10;

export type GuildWithMemberCount = Guild & { memberCount: number };

/** A page of all guilds (newest-agnostic, ordered by name) with member counts. */
async function getAllGuilds(
	db: Database,
	{ limit, offset }: { limit: number; offset: number }
): Promise<{ guilds: GuildWithMemberCount[]; total: number }> {
	const rows = await db
		.selectFrom('guild')
		.leftJoin('guild_member', 'guild_member.guildUri', 'guild.uri')
		.select((eb) => [
			'guild.uri as uri',
			'guild.cid as cid',
			'guild.creatorDid as creatorDid',
			'guild.name as name',
			'guild.leaderDid as leaderDid',
			'guild.createdAt as createdAt',
			'guild.indexedAt as indexedAt',
			eb.fn.count('guild_member.uri').as('memberCount')
		])
		.groupBy([
			'guild.uri',
			'guild.cid',
			'guild.creatorDid',
			'guild.name',
			'guild.leaderDid',
			'guild.createdAt',
			'guild.indexedAt'
		])
		.orderBy('guild.name')
		.limit(limit)
		.offset(offset)
		.execute();

	const totalRow = await db
		.selectFrom('guild')
		.select((eb) => eb.fn.countAll().as('total'))
		.executeTakeFirst();

	const guilds = rows.map((row) => ({ ...row, memberCount: Number(row.memberCount) }));
	return { guilds, total: Number(totalRow?.total ?? 0) };
}

async function getUserGuilds(userDid: string, db: Database): Promise<Guild[]> {
	return await db
		.selectFrom('guild_member')
		.innerJoin('guild', 'guild.uri', 'guild_member.guildUri')
		.where((eb) =>
			eb.or([eb('guild_member.memberDid', '=', userDid), eb('guild.leaderDid', '=', userDid)])
		)
		.distinct()
		.selectAll('guild')
		.execute();
}

async function getExistingGuildMembers(guildURIs: AtUri[], db: Database): Promise<GuildMember[]> {
	if (guildURIs.length === 0) return [];
	return await db
		.selectFrom('guild_member')
		.where(
			'guildUri',
			'in',
			guildURIs.map((uri) => uri.toString())
		)
		.selectAll('guild_member')
		.execute();
}

async function getGuild(atIdentity: string, rkey: string, db: Database): Promise<Guild> {
	const guildUri = `at://${atIdentity}/${ids.DevJakestoutAtguildsGuild}/${rkey}`;
	return await db
		.selectFrom('guild')
		.where('guild.uri', '=', guildUri)
		.selectAll('guild')
		.executeTakeFirstOrThrow();
}

async function getGuildMembers(
	atIdentity: string,
	rkey: string,
	db: Database
): Promise<GuildMember[]> {
	const guildUri = `at://${atIdentity}/${ids.DevJakestoutAtguildsGuild}/${rkey}`;
	return await db
		.selectFrom('guild_member')
		.where('guildUri', '=', guildUri)
		.selectAll('guild_member')
		.execute();
}

async function getGuildInvites(guildUri: string, db: Database): Promise<ExistingGuildInvite[]> {
	return await db
		.selectFrom('guild_invite')
		.where('guildUri', '=', guildUri)
		.where('acceptedAt', 'is', null)
		.selectAll()
		.execute();
}

async function getPdsGuild(guildAtUri: AtUri, agent: Agent): Promise<GuildRecord.Record> {
	const guildRkey = guildAtUri.rkey;
	const leaderDid = guildAtUri.hostname;

	const existingGuild = await agent.com.atproto.repo.getRecord({
		repo: leaderDid,
		collection: ids.DevJakestoutAtguildsGuild,
		rkey: guildRkey
	});

	const validatedGuild = getValidatedGuild(existingGuild.data);
	if (!validatedGuild) {
		console.error({ validatedGuild });
		throw new Error('Invited to invalid guild');
	}
	return validatedGuild;
}

async function inviteMember(
	inviteeHandle: string,
	inviteeDid: string,
	guildUri: string,
	db: Database,
	agent: Agent,
	resolver: BidirectionalResolver
): Promise<void> {
	const guildAtUri = new AtUri(guildUri);
	const validatedGuild = await getPdsGuild(guildAtUri, agent);

	const addedAt = new Date().toISOString();
	validatedGuild.members.push({ did: inviteeDid, addedAt });

	// update existing guild record members array
	const response = await agent.com.atproto.repo.putRecord({
		repo: guildAtUri.hostname,
		collection: ids.DevJakestoutAtguildsGuild,
		rkey: guildAtUri.rkey,
		record: validatedGuild
	});

	if (!response.success) {
		console.error({ response });
		throw new Error('failed to update guild member list with invitee');
	}

	const memberPdsEndpoint = await resolver.resolvePDSEndpoint(inviteeDid);
	const memberAgent = new AtpAgent({ service: memberPdsEndpoint });
	const memberClaims = await memberAgent.com.atproto.repo.listRecords({
		repo: inviteeDid,
		collection: ids.DevJakestoutAtguildsGuildMemberClaim
	});

	if (memberClaims.success) {
		const existingClaim = memberClaims.data.records.find((record) => {
			const claim = getValidatedGuildMemberClaim(record);
			return claim !== null && claim.guildUri === guildUri;
		});

		if (existingClaim) {
			// no need to invite; member has MemberClaim to the guild already
			const validatedClaim = getValidatedGuildMemberClaim(existingClaim)!;
			await db
				.insertInto('guild_member')
				.values({
					uri: existingClaim.uri,
					memberDid: inviteeDid,
					guildUri: validatedClaim.guildUri,
					createdAt: validatedClaim.createdAt,
					indexedAt: new Date().toISOString(),
					addedAt
				})
				.execute();

			return;
		}
	}

	await db
		.insertInto('guild_invite')
		.values({
			guildUri,
			invitee: inviteeHandle,
			createdAt: new Date().toISOString()
		})
		.execute();
}

function getGuildUri(leaderDid: string, guildRkey: string) {
	return `at://${leaderDid}/${ids.DevJakestoutAtguildsGuild}/${guildRkey}`;
}

type InviteWithGuild = {
	inviteId: number;
	invitee: string;
	uri: string;
	creatorDid: string;
	guildName: string;
};

async function getUserInvites(handle: string, db: Database): Promise<InviteWithGuild[]> {
	const invites = await db
		.selectFrom('guild_invite')
		.selectAll()
		.where('invitee', '=', handle)
		.where('acceptedAt', 'is', null)
		.execute();

	// Get unique guild URIs from invites
	const guildUris = [...new Set(invites.map((invite) => invite.guildUri))];

	if (guildUris.length == 0) {
		return [];
	}

	console.log({ guildUris });

	// Get all guilds for those invites
	const guilds = await db.selectFrom('guild').selectAll().where('uri', 'in', guildUris).execute();

	return invites.map((invite) => {
		const guild = guilds.find((g) => g.uri === invite.guildUri)!;
		return {
			inviteId: invite.id!,
			invitee: invite.invitee,
			// Guild fields
			uri: guild.uri,
			creatorDid: guild.creatorDid,
			guildName: guild.name
		};
	});
}

async function acceptInvite(inviteId: number, handle: string, db: Database, agent: Agent) {
	console.log({ inviteId, handle });
	const invite = await db
		.selectFrom('guild_invite')
		.selectAll()
		.where('id', '=', inviteId)
		.where('acceptedAt', 'is', null)
		.executeTakeFirst();

	if (!invite) {
		console.log('invite not found');
		return null;
	}

	const guild = await db
		.selectFrom('guild')
		.select(['uri'])
		.where('uri', '=', invite.guildUri)
		.selectAll()
		.executeTakeFirstOrThrow();

	// const guildRkey = guild.uri.split('/').at(-1)!;
	console.log('joining guild:');
	console.log({ guild });

	const inputGuildMemberClaim: GuildMemberClaimRecord.Record = {
		$type: ids.DevJakestoutAtguildsGuildMemberClaim,
		guildUri: guild.uri,
		createdAt: new Date().toISOString()
	};

	const guildMemberClaim = GuildMemberClaimRecord.validateRecord(inputGuildMemberClaim);
	if (!guildMemberClaim.success) {
		console.error(guildMemberClaim.error);
		return null;
	}

	const guildMemberClaimRecord = guildMemberClaim.value as GuildMemberClaimRecord.Record;

	console.log('writing to atproto');
	console.log({ guildMemberClaimRecord, did: agent.assertDid });

	const response = await agent.com.atproto.repo.applyWrites({
		repo: agent.assertDid,
		writes: [
			{
				$type: 'com.atproto.repo.applyWrites#create',
				collection: ids.DevJakestoutAtguildsGuildMemberClaim,
				rkey: TID.nextStr(),
				value: guildMemberClaimRecord
			}
		]
	});

	if (!response.success) {
		const errData = response.data;
		const errHeaders = response.headers;
		console.error({ errData });
		console.error({ errHeaders });
	}

	if (!response.success || !response.data.results || response.data.results.length === 0) {
		console.error(`Failed to accept invite to guild:`);
		console.error({ response });
		return null;
	}

	const acceptResult = response.data.results[0];
	if (!isCreateWriteResult(acceptResult)) {
		console.error('applyWrites did not return expected create result for guild member claim');
		return null;
	}
	const guildMemberUri = acceptResult.uri;

	await db
		.insertInto('guild_member')
		.values({
			uri: guildMemberUri,
			memberDid: agent.assertDid,
			guildUri: guild.uri,
			createdAt: inputGuildMemberClaim.createdAt,
			indexedAt: new Date().toISOString(),
			// sync backfills the real added date from the leader's guild record shortly after.
			addedAt: null
		})
		.execute();

	const acceptedInvite = await db
		.updateTable('guild_invite')
		.set({
			acceptedAt: new Date().toISOString()
		})
		.where('id', '=', inviteId)
		.where('invitee', '=', handle)
		.returningAll()
		.executeTakeFirstOrThrow();

	console.log({ acceptedInvite });

	console.log({ guild });

	return guild;
}

async function removeMember(
	memberDid: string,
	leaderDid: string,
	guildRkey: string,
	db: Database,
	agent: Agent
) {
	const guildAtUri = new AtUri(`${leaderDid}/${ids.DevJakestoutAtguildsGuild}/${guildRkey}`);
	const guild = await getPdsGuild(guildAtUri, agent);

	// remove member
	guild.members = guild.members.filter((member) => member.did !== memberDid);

	// update existing guild record members array
	const response = await agent.com.atproto.repo.putRecord({
		repo: guildAtUri.hostname,
		collection: ids.DevJakestoutAtguildsGuild,
		rkey: guildAtUri.rkey,
		record: guild
	});

	if (!response.success) {
		console.error({ response });
		throw new Error('failed to remove member from guild on PDS');
	}

	// delete any pending invites
	await db
		.deleteFrom('guild_invite')
		.where((eb) =>
			eb.and([eb('invitee', '=', memberDid), eb('guildUri', '=', guildAtUri.toString())])
		)
		.execute();

	// update cache
	return await db
		.deleteFrom('guild_member')
		.where((eb) =>
			eb.and([eb('memberDid', '=', memberDid), eb('guildUri', '=', guildAtUri.toString())])
		)
		.execute();
}

async function deleteGuild(leaderDid: string, rkey: string, db: Database, agent: Agent) {
	const guild = await getGuild(leaderDid, rkey, db);
	if (!guild) {
		throw new Error('Guild does not exist');
	}

	if (guild.leaderDid !== agent.assertDid) {
		throw new Error('Only leader can delete guild');
	}

	const atUri = new AtUri(guild.uri);

	const guildLeader = await db
		.selectFrom('guild_member')
		.where((eb) => eb.and([eb('guildUri', '=', guild.uri), eb('memberDid', '=', agent.assertDid)]))
		.select('uri')
		.executeTakeFirstOrThrow();

	const leaderClaimRkey = new AtUri(guildLeader.uri).rkey;

	const response = await agent.com.atproto.repo.applyWrites({
		repo: agent.assertDid,
		writes: [
			{
				$type: 'com.atproto.repo.applyWrites#delete',
				collection: ids.DevJakestoutAtguildsGuild,
				rkey: atUri.rkey
			},
			{
				$type: 'com.atproto.repo.applyWrites#delete',
				collection: ids.DevJakestoutAtguildsGuildMemberClaim,
				rkey: leaderClaimRkey
			}
		]
	});

	if (!response.success) {
		console.error({ response });
		throw new Error('failed to delete guild on PDS');
	}

	const userDid = agent.assertDid;
	const result = await db
		.deleteFrom('guild')
		.where((eb) => eb.and([eb('leaderDid', '=', userDid), eb('uri', '=', guild.uri)]))
		.executeTakeFirst();

	if (result.numDeletedRows < 1) {
		throw new Error('failed to delete guild on db cache');
	}
}

type ApplyWriteResult = NonNullable<ComAtprotoRepoApplyWrites.OutputSchema['results']>[number];
function isCreateWriteResult(
	result: ApplyWriteResult
): result is ComAtprotoRepoApplyWrites.CreateResult & { $type: string } {
	return 'uri' in result;
}

const guildService = {
	create,
	getGuild,
	getGuildInvites,
	getGuildMembers,
	getUserGuilds,
	getAllGuilds,
	syncLocals,
	inviteHandle: inviteMember,
	getUserInvites,
	acceptInvite,
	removeMember,
	deleteGuild
};

export default guildService;
