import { Agent, lexicons as atpLexicons } from '@atproto/api';
import { ids, lexicons as guildLexicons } from '$lib/lexicon/lexicons';
import * as GuildRecord from '$lib/lexicon/types/dev/jakestout/atguilds/guild';
import * as GuildMemberClaimRecord from '$lib/lexicon/types/dev/jakestout/atguilds/guildMemberClaim';
import { TID } from '@atproto/common';
import { XrpcClient } from '@atproto/xrpc';
import type { Database, ExistingGuildInvite, Guild, GuildMember } from '$lib/server/db';
import { type OutputSchema } from '@atproto/api/src/client/types/com/atproto/repo/getRecord';
import type { BidirectionalResolver } from '$lib/server/id-resolver';

async function create(agent: Agent, db: Database, guildName: string) {
	const leaderDid = agent.assertDid;
	const inputGuild = {
		name: guildName,
		leader: leaderDid,
		members: [leaderDid],
		createdAt: new Date().toISOString()
	};

	const guild = GuildRecord.validateRecord(inputGuild);
	if (!guild.success) {
		console.error(guild.error);
		return null;
	}
	const guildRkey = TID.nextStr();

	const inputGuildMemberClaim = {
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
	const guildUri = createGuildResult.uri as string;
	const guildCid = createGuildResult.cid as string;
	const guildMemberUri = createGuildMemberClaimResult.uri as string;

	const createdGuild = {
		...guildRecord,
		uri: guildUri,
		cid: guildCid
	};

	console.log(`Successfully created AT guild: ${createdGuild.name}`);
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
				indexedAt: inputGuild.createdAt
			})
			.execute();
	});

	console.log(`Successfully created local cache of guild`);

	return createdGuild;
}

async function GetClaimedGuildsFromPDS(
	guildUris: string[],
	resolver: BidirectionalResolver
) {
	const unvalidatedGuilds = [];
	for (const uri of guildUris) {
		const guildLeaderRepo = uri.split('/')[0];
		const guildRkey = uri.split('/').at(-1)!;

		console.log('fetching guild...');
		try {
			// this XRPC client can get data from various PDS endpoints.
			const endpoint = await resolver.resolvePDSEndpoint(guildLeaderRepo);
			const xrpc = new XrpcClient(endpoint, [...guildLexicons, ...atpLexicons]);
			const { data } = await xrpc.call('com.atproto.repo.getRecord', {
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

			console.log(`got guild: ${validatedGuild.name}`);

			return {
				cid: record.cid,
				uri: record.uri,
				guild: validatedGuild as GuildRecord.Record
			};
		})
		.filter((record) => !!record);
}

async function GetPdsGuildMemberClaims(agent: Agent) {
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

async function syncLocals(agent: Agent | null, db: Database, resolver: BidirectionalResolver) {
	if (!agent) return;
	const userDid = agent.assertDid;

	console.log(`begin syncLocals for ${userDid}`);
	const pdsGuildMemberClaimRecords = await GetPdsGuildMemberClaims(agent);
	const guildUris = pdsGuildMemberClaimRecords
		.map((claim) => claim?.guildMemberClaim.guildUri.replace('at://', ''))
		.filter((uri) => uri && uri.length > 0);

	const pdsGuildsUserClaims = await GetClaimedGuildsFromPDS(guildUris, resolver);

	const indexedAt = new Date().toISOString();

	// get existing db records
	const dbGuildMembers = await getUserGuildMembers(userDid, db);
	const pdsGuildURIs = pdsGuildsUserClaims.map((guild) => guild.uri);
	const dbGuilds = await getExistingGuilds(pdsGuildURIs, db);

	// add missing records to database
	const guildsToAdd = pdsGuildsUserClaims.filter((record) => {
		const existingLocal = dbGuilds.find((dbG) => {
			return dbG.uri == record.uri;
		});
		return !existingLocal;
	});

	const guildMembersToAdd = pdsGuildMemberClaimRecords
		.filter((record) => {
			const memberUri = record?.uri;
			const existingLocal = dbGuildMembers.find((dbM) => dbM.uri === memberUri);
			return !existingLocal;
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
		}
	});

	await db.transaction().execute(async (trx) => {
		if (guildMembersToAdd.length > 0) {
			const membersToInsert = guildMembersToAdd.map((record) => ({
				uri: record.uri,
				guildUri: record.guildMemberClaim.guildUri,
				memberDid: userDid,
				createdAt: record.guildMemberClaim.createdAt,
				indexedAt: indexedAt
			}));
			console.log({ membersToInsert });
			await trx.insertInto('guild_member').values(membersToInsert).execute();
		}
	});
}

function getValidatedGuild(record: OutputSchema): GuildRecord.Record | null {
	const isGuild = GuildRecord.isRecord(record.value);
	if (!isGuild) return null;
	const validation = GuildRecord.validateRecord(record.value);
	if (validation.success) {
		return validation.value as GuildRecord.Record;
	} else {
		const error = validation.error;
		console.warn('Invalid guild found', { error });
		return null;
	}
}

function getValidatedGuildMemberClaim(record: OutputSchema): GuildMemberClaimRecord.Record | null {
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

async function getExistingGuilds(pdsGuildURIs: string[], db: Database): Promise<Guild[]> {
	return await db.selectFrom('guild').where('uri', 'in', pdsGuildURIs).selectAll().execute();
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

async function getUserGuildMembers(userDid: string, db: Database): Promise<GuildMember[]> {
	return await db
		.selectFrom('guild_member')
		.where('memberDid', '=', userDid)
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

async function inviteHandle(
	handle: string,
	inviteeDid: string,
	guildUri: string,
	db: Database,
	agent: Agent
): Promise<ExistingGuildInvite> {
	const guildRkey = guildUri.split('/').at(-1)!;

	const existingGuild = await agent.com.atproto.repo.getRecord({
		rkey: guildRkey,
		repo: agent.assertDid,
		collection: ids.DevJakestoutAtguildsGuild
	});

	const validatedGuild = getValidatedGuild(existingGuild.data);
	if (!validatedGuild) {
		console.error({ validatedGuild });
		throw new Error('Invited to invalid guild');
	}

	validatedGuild?.members.push(inviteeDid);

	// update existing guild record members array
	const response = await agent.com.atproto.repo.putRecord({
		repo: agent.assertDid,
		collection: ids.DevJakestoutAtguildsGuild,
		record: validatedGuild,
		rkey: guildRkey
	});

	if (!response.success) {
		console.error({ response });
		throw new Error('failed to update guild member list with invitee');
	}

	return await db
		.insertInto('guild_invite')
		.values({
			guildUri,
			invitee: handle,
			createdAt: new Date().toISOString()
		})
		.returningAll()
		.executeTakeFirstOrThrow();
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

	const inputGuildMemberClaim = {
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

	const guildMemberUri = response.data.results[0].uri as string;

	await db
		.insertInto('guild_member')
		.values({
			uri: guildMemberUri,
			memberDid: agent.assertDid,
			guildUri: guild.uri,
			createdAt: new Date().toISOString(),
			indexedAt: new Date().toISOString()
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

const guildService = {
	create,
	getGuild,
	getGuildInvites,
	getGuildMembers,
	getUserGuilds,
	syncLocals,
	inviteHandle,
	getUserInvites,
	acceptInvite
};

export default guildService;
