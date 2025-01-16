import { Agent } from '@atproto/api';
import { ids } from '$lib/lexicon/lexicons';
import * as GuildRecord from '$lib/lexicon/types/dev/jakestout/atguilds/testGuild';
import { TID } from '@atproto/common';
import type { Database, Guild } from '$lib/server/db';

async function create(agent: Agent, db: Database, guildName: string) {
	const input = {
		name: guildName,
		leader: agent.assertDid,
		members: [agent.assertDid],
		createdAt: new Date().toISOString()
	};

	const guild = GuildRecord.validateRecord(input);
	if (!guild.success) {
		console.error(guild.error);
		return null;
	}

	const record = guild.value as GuildRecord.Record;

	const response = await agent.com.atproto.repo.applyWrites({
		repo: agent.assertDid,
		writes: [
			{
				$type: 'com.atproto.repo.applyWrites#create',
				collection: ids.DevJakestoutAtguildsTestGuild,
				rkey: TID.nextStr(),
				value: record
			}
		]
	});

	console.log(`Got applyWrites#create response`, { response });

	if (!response.success || !response.data.results || response.data.results.length === 0) {
		console.error(`Failed to create guild: ${response}`);
		return null;
	}

	const result = response.data.results[0];
	const guildUri = result.uri as string;
	const guildCid = result.cid as string;

	const createdGuild = {
		...record,
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
				name: input.name,
				creatorDid: input.leader,
				leaderDid: input.leader,
				createdAt: input.createdAt,
				indexedAt: input.createdAt
			})
			.execute();

		await trx
			.insertInto('guild_member')
			.values(
				input.members.map((memberDid) => ({
					uri: `at://did:placeholder/guildMemberOf-${input.name}-${Date.now()}`,
					memberDid: memberDid,
					guildUri: guildUri,
					guildCid: guildCid,
					createdAt: input.createdAt,
					indexedAt: input.createdAt
				}))
			)
			.execute();
	});

	console.log(`Successfully created local cache of guild`);

	return createdGuild;
}

interface ATGuildRecord {
	uri: string;
	cid: string;
	guild: Guild;
}

async function GetPdsGuilds(agent: Agent): Promise<ATGuildRecord[]> {
	const { data } = await agent.com.atproto.repo.listRecords({
		repo: agent.assertDid,
		collection: ids.DevJakestoutAtguildsTestGuild
	});

	return data.records
		.map((record) => {
			const isGuild = GuildRecord.isRecord(record.value);
			if (!isGuild) return null;

			const validation = GuildRecord.validateRecord(record.value);
			if (validation.success) {
				return {
					cid: record.cid,
					uri: record.uri,
					guild: record.value as Guild
				};
			} else {
				const error = validation.error;
				console.warn('Invalid guild found', { error });
				return null;
			}
		})
		.filter((record) => !!record);
}

async function syncLocals(agent: null | Agent, db: Database) {
	if (!agent || !agent.did) return;
	const userDid = agent.did;
	const pdsGuildRecords = await GetPdsGuilds(agent);
	const indexedAt = new Date().toISOString();

	// get existing db records
	const dbGuilds = await getUserGuilds(agent.did, db);

	// add missing records to database
	const toAdd = pdsGuildRecords.filter((record) => {
		const existingLocal = dbGuilds.find((dbG) => dbG.cid == record.cid);
		return !existingLocal;
	});

	await db.transaction().execute(async (trx) => {
		if (toAdd.length > 0) {
			await trx
				.insertInto('guild')
				.values(
					toAdd.map((record) => ({
						uri: record.uri,
						cid: record.cid,
						name: record.guild.name,
						createdAt: record.guild.createdAt,
						creatorDid: userDid,
						leaderDid: userDid,
						indexedAt: indexedAt
					}))
				)
				.execute();

			// Add guild member entry for the creator
			await trx
				.insertInto('guild_member')
				.values(
					toAdd.map((record) => ({
						uri: `at://did:placeholder/guildMemberOf-${record.guild.name}-${Date.now()}`,
						guildUri: record.uri,
						guildCid: record.cid,
						memberDid: userDid,
						createdAt: record.guild.createdAt,
						indexedAt: indexedAt
					}))
				)
				.execute();
		}
	});
}

async function getUserGuilds(userDid: string, db: Database): Promise<Guild[]> {
	return await db
		.selectFrom('guild_member')
		.innerJoin('guild', 'guild.uri', 'guild_member.guildUri')
		.where('guild_member.memberDid', '=', userDid)
		.selectAll('guild')
		.execute();
}

const guildService = {
	create,
	getUserGuilds,
	syncLocals
};

export default guildService;
