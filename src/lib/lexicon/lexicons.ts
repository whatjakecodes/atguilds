/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { LexiconDoc, Lexicons } from '@atproto/lexicon'

export const schemaDict = {
  DevJakestoutAtguildsTestGuild: {
    lexicon: 1,
    id: 'dev.jakestout.atguilds.testGuild',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        description: 'A guild hosted in ATGuilds',
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
              description: 'DID for each member in the guild',
              format: 'at-identifier',
            },
            members: {
              type: 'array',
              items: {
                type: 'string',
                description: 'DID for the leader of the guild',
                format: 'at-identifier',
              },
              description: 'Array of member DIDs',
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
  DevJakestoutAtguildsTestGuild: 'dev.jakestout.atguilds.testGuild',
}
