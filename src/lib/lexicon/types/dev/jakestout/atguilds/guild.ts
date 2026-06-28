/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons.js'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'dev.jakestout.atguilds.guild'

export interface Main {
  $type: 'dev.jakestout.atguilds.guild'
  /** The name of the guild */
  name: string
  /** DID for the leader of the guild */
  leader: string
  /** Array of guild members */
  members: Member[]
  createdAt: string
  [k: string]: unknown
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain, true)
}

export {
  type Main as Record,
  isMain as isRecord,
  validateMain as validateRecord,
}

/** A member of the guild and when they were added */
export interface Member {
  $type?: 'dev.jakestout.atguilds.guild#member'
  /** DID for the member */
  did: string
  /** When the member was added to the guild */
  addedAt: string
}

const hashMember = 'member'

export function isMember<V>(v: V) {
  return is$typed(v, id, hashMember)
}

export function validateMember<V>(v: V) {
  return validate<Member & V>(v, id, hashMember)
}
