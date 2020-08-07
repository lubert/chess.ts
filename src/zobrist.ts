import seedrandom from 'seedrandom'
import { Board, PieceSymbol, Color, State, HashKey } from './types'
import { BITS, EMPTY, WHITE, BLACK } from './constants'
import { file } from './utils'

// Seed so that the table is reproducible
const rng = seedrandom('sonofsigma')
// Use two 32 bit ints instead of 64 bit BigInt, since it's not widely supported
const getHashValue = (): HashKey => [rng.int32(), rng.int32()]
const getTable = (length: number = 64): HashKey[] => Array.from(
  { length }, () => getHashValue()
)
const getPieceTable = (): Record<Color, HashKey[]> => ({
  'w': getTable(),
  'b': getTable(),
})
const tableMap: Record<PieceSymbol, Record<Color, HashKey[]>> = {
  'p': getPieceTable(),
  'n': getPieceTable(),
  'b': getPieceTable(),
  'r': getPieceTable(),
  'q': getPieceTable(),
  'k': getPieceTable(),
}
const whiteTurn = getHashValue()
const castlingTable: Record<Color, Record<'k' | 'q', HashKey>> = {
  'w': {
    'k': getHashValue(),
    'q': getHashValue(),
  },
  'b': {
    'k': getHashValue(),
    'q': getHashValue(),
  },
}
const enpassantTable = getTable(8)

export function hashBoard(board: Board): HashKey {
  const h: HashKey = [0, 0]
  for (let i = 0; i < 64; i++) {
    const piece = board[i]
    if (piece) {
      const { color, type } = piece
      h[0] ^= tableMap[type][color][i][0]
      h[1] ^= tableMap[type][color][i][1]
    }
  }
  return h
}

export function hashState(state: State): HashKey {
  const h = hashBoard(state.board)
  // Turn
  if (state.turn === WHITE) {
    h[0] ^= whiteTurn[0]
    h[1] ^= whiteTurn[1]
  }
  // Castling
  if (state.castling[WHITE] & BITS.KSIDE_CASTLE) {
    h[0] ^= castlingTable[WHITE].k[0]
    h[1] ^= castlingTable[WHITE].k[1]
  }
  if (state.castling[WHITE] & BITS.QSIDE_CASTLE) {
    h[0] ^= castlingTable[WHITE].q[0]
    h[1] ^= castlingTable[WHITE].q[1]
  }
  if (state.castling[BLACK] & BITS.KSIDE_CASTLE) {
    h[0] ^= castlingTable[BLACK].k[0]
    h[1] ^= castlingTable[BLACK].k[1]
  }
  if (state.castling[BLACK] & BITS.QSIDE_CASTLE) {
    h[0] ^= castlingTable[BLACK].q[0]
    h[1] ^= castlingTable[BLACK].q[1]
  }
  // Enpassant
  if (state.ep_square !== EMPTY) {
    const f = file(state.ep_square)
    h[0] ^= enpassantTable[f][0]
    h[1] ^= enpassantTable[f][1]
  }
  return h
}
