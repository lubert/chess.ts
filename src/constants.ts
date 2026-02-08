import { Color, FlagKey, PieceSymbol, Square } from './interfaces/types'

/** @public */
export const WHITE: Color = 'w'
/** @public */
export const BLACK: Color = 'b'
/** @public */
export const PAWN: PieceSymbol = 'p'
/** @public */
export const KNIGHT: PieceSymbol = 'n'
/** @public */
export const BISHOP: PieceSymbol = 'b'
/** @public */
export const ROOK: PieceSymbol = 'r'
/** @public */
export const QUEEN: PieceSymbol = 'q'
/** @public */
export const KING: PieceSymbol = 'k'
/** @public */
export const EMPTY = -1

export const NULL_MOVES: string[] = ['--', 'Z0', 'pass', 'null', '@@@@', '0000']

export const CASTLING_MOVES: string[] = ['O-O', 'O-O-O', '0-0', '0-0-0']

export const SYMBOLS = 'pnbrqkPNBRQK'

export const DEFAULT_POSITION =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export const POSSIBLE_RESULTS: string[] = ['1-0', '0-1', '1/2-1/2', '*']

// CharCode constants for hand-rolled SAN/NAG parsing
export const CC_a = 97
export const CC_h = 104
export const CC_1 = 49
export const CC_8 = 56
export const CC_x = 120
export const CC_DASH = 45
export const CC_EQ = 61
export const CC_PLUS = 43
export const CC_HASH = 35
export const CC_BANG = 33
export const CC_QMARK = 63
export const CC_N = 78
export const CC_B = 66
export const CC_R = 82
export const CC_Q = 81
export const CC_K = 75
export const CC_n = 110
export const CC_b = 98
export const CC_r = 114
export const CC_q = 113

// 0-3 are horizontal/vertical, 4-7 are diagonal
export const DIRECTIONS = [-16, 16, -1, 1, -17, 17, -15, 15]

export const PAWN_OFFSETS: Record<Color, number[]> = {
  b: [16, 32, 17, 15],
  w: [-16, -32, -17, -15],
}

export const PAWN_ATTACK_OFFSETS: Record<Color, number[]> = {
  b: [-17, -15],
  w: [17, 15],
}

export const PIECE_OFFSETS: Record<PieceSymbol, number[]> = {
  p: [],
  n: [-18, -33, -31, -14, 18, 33, 31, 14],
  b: [-17, -15, 17, 15],
  r: [-16, 1, 16, -1],
  q: [-17, -16, -15, 1, 17, 16, 15, -1],
  k: [-17, -16, -15, 1, 17, 16, 15, -1],
}

// prettier-ignore
export const ATTACKS: number[] = [
  20, 0, 0, 0, 0, 0, 0, 24,  0, 0, 0, 0, 0, 0,20, 0,
   0,20, 0, 0, 0, 0, 0, 24,  0, 0, 0, 0, 0,20, 0, 0,
   0, 0,20, 0, 0, 0, 0, 24,  0, 0, 0, 0,20, 0, 0, 0,
   0, 0, 0,20, 0, 0, 0, 24,  0, 0, 0,20, 0, 0, 0, 0,
   0, 0, 0, 0,20, 0, 0, 24,  0, 0,20, 0, 0, 0, 0, 0,
   0, 0, 0, 0, 0,20, 2, 24,  2,20, 0, 0, 0, 0, 0, 0,
   0, 0, 0, 0, 0, 2,53, 56, 53, 2, 0, 0, 0, 0, 0, 0,
  24,24,24,24,24,24,56,  0, 56,24,24,24,24,24,24, 0,
   0, 0, 0, 0, 0, 2,53, 56, 53, 2, 0, 0, 0, 0, 0, 0,
   0, 0, 0, 0, 0,20, 2, 24,  2,20, 0, 0, 0, 0, 0, 0,
   0, 0, 0, 0,20, 0, 0, 24,  0, 0,20, 0, 0, 0, 0, 0,
   0, 0, 0,20, 0, 0, 0, 24,  0, 0, 0,20, 0, 0, 0, 0,
   0, 0,20, 0, 0, 0, 0, 24,  0, 0, 0, 0,20, 0, 0, 0,
   0,20, 0, 0, 0, 0, 0, 24,  0, 0, 0, 0, 0,20, 0, 0,
  20, 0, 0, 0, 0, 0, 0, 24,  0, 0, 0, 0, 0, 0,20
]

// prettier-ignore
export const RAYS: number[] = [
   17,  0,  0,  0,  0,  0,  0, 16,  0,  0,  0,  0,  0,  0, 15, 0,
    0, 17,  0,  0,  0,  0,  0, 16,  0,  0,  0,  0,  0, 15,  0, 0,
    0,  0, 17,  0,  0,  0,  0, 16,  0,  0,  0,  0, 15,  0,  0, 0,
    0,  0,  0, 17,  0,  0,  0, 16,  0,  0,  0, 15,  0,  0,  0, 0,
    0,  0,  0,  0, 17,  0,  0, 16,  0,  0, 15,  0,  0,  0,  0, 0,
    0,  0,  0,  0,  0, 17,  0, 16,  0, 15,  0,  0,  0,  0,  0, 0,
    0,  0,  0,  0,  0,  0, 17, 16, 15,  0,  0,  0,  0,  0,  0, 0,
    1,  1,  1,  1,  1,  1,  1,  0, -1, -1,  -1,-1, -1, -1, -1, 0,
    0,  0,  0,  0,  0,  0,-15,-16,-17,  0,  0,  0,  0,  0,  0, 0,
    0,  0,  0,  0,  0,-15,  0,-16,  0,-17,  0,  0,  0,  0,  0, 0,
    0,  0,  0,  0,-15,  0,  0,-16,  0,  0,-17,  0,  0,  0,  0, 0,
    0,  0,  0,-15,  0,  0,  0,-16,  0,  0,  0,-17,  0,  0,  0, 0,
    0,  0,-15,  0,  0,  0,  0,-16,  0,  0,  0,  0,-17,  0,  0, 0,
    0,-15,  0,  0,  0,  0,  0,-16,  0,  0,  0,  0,  0,-17,  0, 0,
  -15,  0,  0,  0,  0,  0,  0,-16,  0,  0,  0,  0,  0,  0,-17
]

export const PIECE_MASKS: Record<PieceSymbol, number> = {
  p: 0x1,
  n: 0x2,
  b: 0x4,
  r: 0x8,
  q: 0x10,
  k: 0x20,
}

/** @public */
export const FLAGS: Record<FlagKey, string> = {
  NORMAL: 'n',
  CAPTURE: 'c',
  BIG_PAWN: 'b',
  EP_CAPTURE: 'e',
  PROMOTION: 'p',
  KSIDE_CASTLE: 'k',
  QSIDE_CASTLE: 'q',
  NULL_MOVE: '-',
  CHECK: '+',
  CHECKMATE: '#',
}

/** @public */
export const BITS: Record<FlagKey, number> = {
  NORMAL: 1,
  CAPTURE: 2,
  BIG_PAWN: 4,
  EP_CAPTURE: 8,
  PROMOTION: 16,
  KSIDE_CASTLE: 32,
  QSIDE_CASTLE: 64,
  NULL_MOVE: 128,
  CHECK: 256,
  CHECKMATE: 512,
}

export const RANK_1 = 7
export const RANK_2 = 6
export const RANK_3 = 5
export const RANK_4 = 4
export const RANK_5 = 3
export const RANK_6 = 2
export const RANK_7 = 1
export const RANK_8 = 0

export const RANKS = [
  RANK_8,
  RANK_7,
  RANK_6,
  RANK_5,
  RANK_4,
  RANK_3,
  RANK_2,
  RANK_1,
]

// prettier-ignore
/** @public */
export const SQUARES: Record<Square, number> = {
  a8:   0, b8:   1, c8:   2, d8:   3, e8:   4, f8:   5, g8:   6, h8:   7,
  a7:  16, b7:  17, c7:  18, d7:  19, e7:  20, f7:  21, g7:  22, h7:  23,
  a6:  32, b6:  33, c6:  34, d6:  35, e6:  36, f6:  37, g6:  38, h6:  39,
  a5:  48, b5:  49, c5:  50, d5:  51, e5:  52, f5:  53, g5:  54, h5:  55,
  a4:  64, b4:  65, c4:  66, d4:  67, e4:  68, f4:  69, g4:  70, h4:  71,
  a3:  80, b3:  81, c3:  82, d3:  83, e3:  84, f3:  85, g3:  86, h3:  87,
  a2:  96, b2:  97, c2:  98, d2:  99, e2: 100, f2: 101, g2: 102, h2: 103,
  a1: 112, b1: 113, c1: 114, d1: 115, e1: 116, f1: 117, g1: 118, h1: 119
}

// prettier-ignore
/** @public */
export const BIT_SQUARES: Record<Square, number> = {
  a8:  0, b8:  1, c8:  2, d8:  3, e8:  4, f8:  5, g8:  6, h8:  7,
  a7:  8, b7:  9, c7: 10, d7: 11, e7: 12, f7: 13, g7: 14, h7: 15,
  a6: 16, b6: 17, c6: 18, d6: 19, e6: 20, f6: 21, g6: 22, h6: 23,
  a5: 24, b5: 25, c5: 26, d5: 27, e5: 28, f5: 29, g5: 30, h5: 31,
  a4: 32, b4: 33, c4: 34, d4: 35, e4: 36, f4: 37, g4: 38, h4: 39,
  a3: 40, b3: 41, c3: 42, d3: 43, e3: 44, f3: 45, g3: 46, h3: 47,
  a2: 48, b2: 49, c2: 50, d2: 51, e2: 52, f2: 53, g2: 54, h2: 55,
  a1: 56, b1: 57, c1: 58, d1: 59, e1: 60, f1: 61, g1: 62, h1: 63,
}

type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/**
 * Pre-computed bitmasks for each file (column).
 * Each mask has all 8 squares on that file set.
 * @public
 */
// prettier-ignore
export const FILE_MASKS: Record<File, bigint> = {
  a: 0x0101010101010101n,
  b: 0x0202020202020202n,
  c: 0x0404040404040404n,
  d: 0x0808080808080808n,
  e: 0x1010101010101010n,
  f: 0x2020202020202020n,
  g: 0x4040404040404040n,
  h: 0x8080808080808080n,
}

/**
 * Pre-computed bitmasks for each rank (row).
 * Each mask has all 8 squares on that rank set.
 * @public
 */
// prettier-ignore
export const RANK_MASKS: Record<Rank, bigint> = {
  8: 0x00000000000000FFn,
  7: 0x000000000000FF00n,
  6: 0x0000000000FF0000n,
  5: 0x00000000FF000000n,
  4: 0x000000FF00000000n,
  3: 0x0000FF0000000000n,
  2: 0x00FF000000000000n,
  1: 0xFF00000000000000n,
}

// Numeric piece type constants for Uint8Array board encoding
// Encoding: 0 = empty, bits 0-2 = piece type (1-6), bit 3 = color (0=white, 8=black)
export const PT_PAWN = 1
export const PT_KNIGHT = 2
export const PT_BISHOP = 3
export const PT_ROOK = 4
export const PT_QUEEN = 5
export const PT_KING = 6
export const COLOR_W = 0
export const COLOR_B = 8

// Maps PieceSymbol to numeric piece type
export const PIECE_TYPE_NUM: Record<PieceSymbol, number> = {
  p: PT_PAWN,
  n: PT_KNIGHT,
  b: PT_BISHOP,
  r: PT_ROOK,
  q: PT_QUEEN,
  k: PT_KING,
}

// Maps numeric piece type back to PieceSymbol (index 0 is intentionally undefined)
// prettier-ignore
export const NUM_PIECE_TYPE: (PieceSymbol | undefined)[] = [
  undefined, // 0 = empty square, should never be looked up
  'p', // 1
  'n', // 2
  'b', // 3
  'r', // 4
  'q', // 5
  'k', // 6
]

// Maps Color to numeric color bit
export const COLOR_NUM: Record<Color, number> = {
  w: COLOR_W,
  b: COLOR_B,
}

export const ROOKS: Record<Color, { square: number; flag: number }[]> = {
  w: [
    { square: SQUARES.a1, flag: BITS.QSIDE_CASTLE },
    { square: SQUARES.h1, flag: BITS.KSIDE_CASTLE },
  ],
  b: [
    { square: SQUARES.a8, flag: BITS.QSIDE_CASTLE },
    { square: SQUARES.h8, flag: BITS.KSIDE_CASTLE },
  ],
}
