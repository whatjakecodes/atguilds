/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { LexiconDoc, Lexicons } from '@atproto/lexicon'

export const schemaDict = {
  DevJakestoutAtguildsGuildMemberClaim: {
    lexicon: 1,
    id: 'dev.jakestout.atguilds.guildMemberClaim',
    defs: {
      main: {
        type: 'record',
        description:
          'A claim to guild membership. Guild must also include member in members array to fulfill the claim.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['guildUri', 'createdAt'],
          properties: {
            guildUri: {
              type: 'string',
              format: 'at-uri',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  DevJakestoutAtguildsGuild: {
    lexicon: 1,
    id: 'dev.jakestout.atguilds.guild',
    defs: {
      main: {
        type: 'record',
        description: 'A guild hosted in ATGuilds',
        key: 'tid',
        record: {
          type: 'object',
          required: ['name', 'leader', 'members', 'createdAt'],
          properties: {
            name: {
              type: 'string',
              description: 'The name of the guild',
              minLength: 1,
              maxLength: 32,
            },
            leader: {
              type: 'string',
              description: 'DID for the leader of the guild',
              format: 'at-identifier',
            },
            members: {
              type: 'array',
              description: 'Array of member DIDs',
              items: {
                type: 'string',
                description: 'DID for each member in the guild',
                format: 'at-identifier',
              },
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
} as const satisfies Record<string, LexiconDoc>

export const schemas = Object.values(schemaDict)
export const lexicons: Lexicons = new Lexicons(schemas)
export const ids = {
  DevJakestoutAtguildsGuildMemberClaim:
    'dev.jakestout.atguilds.guildMemberClaim',
  DevJakestoutAtguildsGuild: 'dev.jakestout.atguilds.guild',
}
