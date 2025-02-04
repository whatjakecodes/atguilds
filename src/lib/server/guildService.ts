import { Agent, AtpAgent, AtUri } from '@atproto/api';
import { ids } from '$lib/lexicon/lexicons';
import * as GuildRecord from '$lib/lexicon/types/dev/jakestout/atguilds/guild';
import * as GuildMemberClaimRecord from '$lib/lexicon/types/dev/jakestout/atguilds/guildMemberClaim';
import { TID } from '@atproto/common';
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

async function syncLocals(agent: Agent | null, db: Database, resolver: BidirectionalResolver) {
	if (!agent) return;
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
	const guildMemberDIDs = pdsGuilds.flatMap((record) => record.guild.members);

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
					guildRecord.guild.members.includes(memberDid)
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
		}
	});

	await db.transaction().execute(async (trx) => {
		if (guildMembersToAdd.length > 0) {
			const membersToInsert = guildMembersToAdd.map((record) => ({
				uri: record.uri.toString(),
				guildUri: record.guildMemberClaim.guildUri,
				memberDid: record.uri.hostname,
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

async function getExistingGuilds(pdsGuildURIs: AtUri[], db: Database): Promise<Guild[]> {
	const uriStrings = pdsGuildURIs.map((uri) => uri.toString());
	return await db.selectFrom('guild').where('uri', 'in', uriStrings).selectAll().execute();
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

	validatedGuild.members.push(inviteeDid);

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
			const guildUri = getValidatedGuildMemberClaim(existingClaim)!.guildUri;
			await db
				.insertInto('guild_member')
				.values({
					uri: existingClaim.uri,
					memberDid: inviteeDid,
					guildUri,
					createdAt: new Date().toISOString(),
					indexedAt: new Date().toISOString()
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
	guild.members = guild.members.filter((member) => member !== memberDid);

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

const guildService = {
	create,
	getGuild,
	getGuildInvites,
	getGuildMembers,
	getUserGuilds,
	syncLocals,
	inviteHandle: inviteMember,
	getUserInvites,
	acceptInvite,
	removeMember,
	deleteGuild
};

export default guildService;
