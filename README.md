# atguilds

Portable guilds built on ATProtocol! Create a guild and invite your friends.

> [!NOTE]
> This project is currently in an exploration phase as I learn about ATProtocol.
> Feel free to reuse the [lexicon schemas](./lexicons) however you see fit.
> Once mature, this project and its lexicons should be hosted outside the `dev.jakestout.atguilds` domain/namespace.
> 
> Goals:
> * develop a weekly leaderboard system to rank guild member activities
> * develop SDKs for unity/unreal/godot to authenticate users and enable guild access in-game
> 
> Please reach out if you're interested in collaborating on this!

## Design

Guilds are created in the guild leader's PDS, and represented by [guild.atguilds.jakestout.dev](./lexicons/guild.json) records.

Guild membership is represented by "claim" records ([guildMemberClaim.atguilds.jakestout.dev](./lexicons/guildMemberClaim.json)) on each member's PDS.

### Bi-directional validity
Memberships should only be considered "valid" if both are true:
1. A guild record's `members` array contains the decentralized ID (DID) of an ATProto account
2. That ATProto account contains a guildMemberClaim record with the `guildUri` set to the ATUri of that guild.

Bi-directionality is important because guild membership must be confirmed by two people, typically via an invitation from the guild leader.

## Developing

Install dependencies with `pnpm install`.

Start a development server:

```bash
# start postgres
docker-compose up -d

# run app
pnpm run dev
```

### Lexicon Code Gen

To (re)generate TypeScript [code](src/lib/lexicon) for guild lexicons

`./node_modules/.bin/lex gen-server ./src/lib/lexicon ./lexicons/*`


## Building

To create a production version of your app:

```bash
pnpm run build
```

You can preview the production build with `pnpm run preview`.


## About

Winner of "Best Bluesky Fun Project" @ Jan 2025 [LFC.DEV](https://lfc.dev/) - [Bluesky/ATProto Hackathon](https://lu.ma/olts6pug) 
