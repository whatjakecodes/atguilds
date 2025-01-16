/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

export interface Record {
  /** The name of the guild */
  name: string
  /** DID for each member in the guild */
  leader: string
  /** Array of member DIDs */
  members: string[]
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'dev.jakestout.atguilds.testGuild#main' ||
      v.$type === 'dev.jakestout.atguilds.testGuild')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('dev.jakestout.atguilds.testGuild#main', v)
}
