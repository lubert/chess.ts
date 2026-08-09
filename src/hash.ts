import { BITS, BLACK, EMPTY, WHITE } from './constants'
import { BoardState } from './interfaces/types'
import { legalEpSquare } from './move'

/*
 * Zobrist hashing for position identity. Two 32-bit lanes give a 64-bit key,
 * because JavaScript bitwise operators only work on 32 bits and bigint XOR is
 * markedly slower than plain numbers in this hot path.
 */

/* xorshift32 with a fixed seed, so keys are identical across runs and a hash
 * stays comparable if it is ever persisted
 */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s >>> 0
  }
}

const random = makeRandom(0x2545f491)

/* indexed by (colorIndex * 7 + pieceType) * 128 + square, matching the board
 * encoding: bits 0-2 are the piece type, bit 3 is the color
 */
const PIECE_LO = new Int32Array(2 * 7 * 128)
const PIECE_HI = new Int32Array(2 * 7 * 128)
for (let i = 0; i < PIECE_LO.length; i++) {
  PIECE_LO[i] = random() | 0
  PIECE_HI[i] = random() | 0
}

/*
 * One key per (colour, side, rook square) rather than per castling bit, so the
 * hash distinguishes X-FEN rights that name different rooks — the FEN prefix
 * does, and the two must agree. Indexed by (colorIndex * 2 + sideIndex) * 128
 * + rookSquare.
 */
const CASTLING_LO = new Int32Array(4 * 128)
const CASTLING_HI = new Int32Array(4 * 128)
for (let i = 0; i < CASTLING_LO.length; i++) {
  CASTLING_LO[i] = random() | 0
  CASTLING_HI[i] = random() | 0
}

/* one key per ep file, plus index 8 meaning "no ep square" */
const EP_LO = new Int32Array(9)
const EP_HI = new Int32Array(9)
for (let i = 0; i < 9; i++) {
  EP_LO[i] = random() | 0
  EP_HI[i] = random() | 0
}

const TURN_LO = random() | 0
const TURN_HI = random() | 0

/*
 * The 64-bit position key, returned as [lo, hi]. Covers exactly the four FEN
 * fields that define position identity — placement, side to move, castling and
 * the ep square — so two positions hash alike exactly when their FEN prefixes
 * match. The ep square goes through legalEpSquare for that reason.
 */
export function hashBoardState(state: BoardState): [number, number] {
  let lo = 0
  let hi = 0

  const board = state.board
  for (let i = 0; i < 128; i++) {
    if (i & 0x88) {
      i += 7
      continue
    }
    const piece = board[i]
    if (!piece) continue
    const idx = ((piece & 8 ? 1 : 0) * 7 + (piece & 7)) * 128 + i
    lo ^= PIECE_LO[idx]
    hi ^= PIECE_HI[idx]
  }

  for (let c = 0; c < 2; c++) {
    const color = c === 0 ? WHITE : BLACK
    const rights = state.castling[color]
    const rooks = state.castlingRooks[color]
    if (rights & BITS.KSIDE_CASTLE && rooks.k !== EMPTY) {
      const idx = c * 2 * 128 + rooks.k
      lo ^= CASTLING_LO[idx]
      hi ^= CASTLING_HI[idx]
    }
    if (rights & BITS.QSIDE_CASTLE && rooks.q !== EMPTY) {
      const idx = (c * 2 + 1) * 128 + rooks.q
      lo ^= CASTLING_LO[idx]
      hi ^= CASTLING_HI[idx]
    }
  }

  const epSq = legalEpSquare(state)
  const epIndex = epSq === EMPTY ? 8 : epSq & 7
  lo ^= EP_LO[epIndex]
  hi ^= EP_HI[epIndex]

  if (state.turn === WHITE) {
    lo ^= TURN_LO
    hi ^= TURN_HI
  }

  return [lo, hi]
}
