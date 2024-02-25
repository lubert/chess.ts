import { REGEXP_NAG } from '../regex'

/**
 * @public
 * https://en.wikipedia.org/wiki/Numeric_Annotation_Glyphs
 */
export enum Nag {
  NULL = 0,
  // Move Assessments
  GOOD_MOVE = 1, // !
  MISTAKE = 2, // ?
  BRILLIANT_MOVE = 3, // !!
  BLUNDER = 4, // ??
  SPECULATIVE_MOVE = 5, // !?
  DUBIOUS_MOVE = 6, // ?!
  FORCED_MOVE = 7, // □
  // Positional Assessments
  DRAWISH_POSITION = 10, // =
  UNCLEAR_POSITION = 13, // ∞
  WHITE_SLIGHT_ADVANTAGE = 14, // ⩲
  BLACK_SLIGHT_ADVANTAGE = 15, // ⩱
  WHITE_MODERATE_ADVANTAGE = 16, // ±
  BLACK_MODERATE_ADVANTAGE = 17, // ∓
  WHITE_DECISIVE_ADVANTAGE = 18, // +-
  BLACK_DECISIVE_ADVANTAGE = 19, // -+
  WHITE_ZUGZWANG = 22, // ⨀
  BLACK_ZUGZWANG = 23, // ⨀
  WHITE_MODERATE_TIME_ADVANTAGE = 32, // ⟳
  BLACK_MODERATE_TIME_ADVANTAGE = 33, // ⟳
  WHITE_INITIATIVE = 36, // ↑
  BLACK_INITIATIVE = 37, // ↑
  WHITE_ATTACK = 40, // →
  BLACK_ATTACK = 41, // →
  WHITE_MODERATE_COUNTERPLAY = 132, // ⇆
  BLACK_MODERATE_COUNTERPLAY = 133, // ⇆
  // Time Pressure Commentaries
  WHITE_SEVERE_TIME_PRESSURE = 138, // ⨁
  BLACK_SEVERE_TIME_PRESSURE = 139, // ⨁
}

/** @public */
export const NagMap: Partial<Record<Nag, string>> = {
  [Nag.GOOD_MOVE]: '!',
  [Nag.MISTAKE]: '?',
  [Nag.BRILLIANT_MOVE]: '!!',
  [Nag.BLUNDER]: '??',
  [Nag.SPECULATIVE_MOVE]: '!?',
  [Nag.DUBIOUS_MOVE]: '?!',
  [Nag.FORCED_MOVE]: '□',
  [Nag.DRAWISH_POSITION]: '=',
  [Nag.UNCLEAR_POSITION]: '∞',
  [Nag.WHITE_SLIGHT_ADVANTAGE]: '⩲',
  [Nag.BLACK_SLIGHT_ADVANTAGE]: '⩱',
  [Nag.WHITE_MODERATE_ADVANTAGE]: '±',
  [Nag.BLACK_MODERATE_ADVANTAGE]: '∓',
  [Nag.WHITE_DECISIVE_ADVANTAGE]: '+-',
  [Nag.BLACK_DECISIVE_ADVANTAGE]: '-+',
  [Nag.WHITE_ZUGZWANG]: '⨀',
  [Nag.BLACK_ZUGZWANG]: '⨀',
  [Nag.WHITE_MODERATE_TIME_ADVANTAGE]: '⟳',
  [Nag.BLACK_MODERATE_TIME_ADVANTAGE]: '⟳',
  [Nag.WHITE_INITIATIVE]: '↑',
  [Nag.BLACK_INITIATIVE]: '↑',
  [Nag.WHITE_ATTACK]: '→',
  [Nag.BLACK_ATTACK]: '→',
  [Nag.WHITE_MODERATE_COUNTERPLAY]: '⇆',
  [Nag.BLACK_MODERATE_COUNTERPLAY]: '⇆',
  [Nag.WHITE_SEVERE_TIME_PRESSURE]: '⨁',
  [Nag.BLACK_SEVERE_TIME_PRESSURE]: '⨁',
}

export function extractNags(move: string): number[] | undefined {
  const nagMatches = move.match(REGEXP_NAG)
  if (!nagMatches) return
  const nag = nagMatches[0]
  switch (nag) {
    case '!':
      return [Nag.GOOD_MOVE]
    case '?':
      return [Nag.MISTAKE]
    case '!!':
      return [Nag.BRILLIANT_MOVE]
    case '??':
      return [Nag.BLUNDER]
    case '!?':
      return [Nag.SPECULATIVE_MOVE]
    case '?!':
      return [Nag.DUBIOUS_MOVE]
    default:
      return
  }
}
