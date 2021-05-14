/**
 * https://en.wikipedia.org/wiki/Numeric_Annotation_Glyphs
 */
export enum Nag {
  NULL = 0,
  // Move Assessments
  GOOD_MOVE = 1,                       // !
  MISTAKE = 2,                         // ?
  BRILLIANT_MOVE = 3,                  // !!
  BLUNDER = 4,                         // ??
  SPECULATIVE_MOVE = 5,                // !?
  DUBIOUS_MOVE = 6,                    // ?!
  FORCED_MOVE = 7,                     // □
  // Positional Assessments
  DRAWISH_POSITION = 10,               // =
  UNCLEAR_POSITION = 13,               // ∞
  WHITE_SLIGHT_ADVANTAGE = 14,         // ⩲
  BLACK_SLIGHT_ADVANTAGE = 15,         // ⩱
  WHITE_MODERATE_ADVANTAGE = 16,       // ±
  BLACK_MODERATE_ADVANTAGE = 17,       // ∓
  WHITE_DECISIVE_ADVANTAGE = 18,       // +-
  BLACK_DECISIVE_ADVANTAGE = 19,       // -+
  WHITE_ZUGZWANG = 22,                 // ⨀
  BLACK_ZUGZWANG = 23,                 // ⨀
  WHITE_MODERATE_TIME_ADVANTAGE = 32,  // ⟳
  BLACK_MODERATE_TIME_ADVANTAGE = 33,  // ⟳
  WHITE_INITIATIVE = 36,               // ↑
  BLACK_INITIATIVE = 37,               // ↑
  WHITE_ATTACK = 40,                   // →
  BLACK_ATTACK = 41,                   // →
  WHITE_MODERATE_COUNTERPLAY = 132,    // ⇆
  BLACK_MODERATE_COUNTERPLAY = 133,    // ⇆
  // Time Pressure Commentaries
  WHITE_SEVERE_TIME_PRESSURE = 138,    // ⨁
  BLACK_SEVERE_TIME_PRESSURE = 139,    // ⨁
}
