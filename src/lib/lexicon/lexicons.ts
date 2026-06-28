/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type LexiconDoc,
  Lexicons,
  ValidationError,
  type ValidationResult,
} from '@atproto/lexicon'
import { type $Typed, is$typed, maybe$typed } from './util.js'

export const schemaDict = {
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
              description: 'Array of guild members',
              items: {
                type: 'ref',
                ref: 'lex:dev.jakestout.atguilds.guild#member',
              },
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      member: {
        type: 'object',
        description: 'A member of the guild and when they were added',
        required: ['did', 'addedAt'],
        properties: {
          did: {
            type: 'string',
            description: 'DID for the member',
            format: 'at-identifier',
          },
          addedAt: {
            type: 'string',
            description: 'When the member was added to the guild',
            format: 'datetime',
          },
        },
      },
    },
  },
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
} as const satisfies Record<string, LexiconDoc>
export const schemas = Object.values(schemaDict) satisfies LexiconDoc[]
export const lexicons: Lexicons = new Lexicons(schemas)

export function validate<T extends { $type: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType: true,
): ValidationResult<T>
export function validate<T extends { $type?: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: false,
): ValidationResult<T>
export function validate(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: boolean,
): ValidationResult {
  return (requiredType ? is$typed : maybe$typed)(v, id, hash)
    ? lexicons.validate(`${id}#${hash}`, v)
    : {
        success: false,
        error: new ValidationError(
          `Must be an object with "${hash === 'main' ? id : `${id}#${hash}`}" $type property`,
        ),
      }
}

export const ids = {
  DevJakestoutAtguildsGuild: 'dev.jakestout.atguilds.guild',
  DevJakestoutAtguildsGuildMemberClaim:
    'dev.jakestout.atguilds.guildMemberClaim',
} as const
