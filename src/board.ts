import { BITS, BIT_SQUARES, RANKS, SQUARES } from './constants'
import {
  BitBoard,
  Board,
  ColorState,
  PieceSymbol,
  Square,
} from './interfaces/types'
import { bitToSquare, symbol } from './utils'
import { decodePiece, encodePiece } from './move'

/**
 * Renders a map of squares to characters on an ASCII board.
 * @param charMap - Map of squares to characters
 * @param eol - End of line character
 * @public
 */
export function mapToAscii(
  charMap: Readonly<Partial<Record<Square, string>>>,
  eol = '\n',
): string {
  const pieces = RANKS.map((rank) => {
    const rankPieces = RANKS.map((file) => {
      const sq = ('abcdefgh'[file] + '87654321'[rank]) as Square
      const symbol = charMap[sq]
      return symbol ? ` ${symbol} ` : ' . '
    })
    const rankStr = rankPieces.join('')

    return '87654321'[rank] + ' |' + rankStr + '|'
  })

  return [
    '  +------------------------+',
    pieces.join(eol),
    '  +------------------------+',
    '    a  b  c  d  e  f  g  h',
  ].join(eol)
}

/**
 * Converts a board state to a map of squares to piece symbols.
 * @param board - Board state
 * @public
 */
export function boardToMap(
  board: Readonly<Board>,
): Partial<Record<Square, string>> {
  const charMap: Partial<Record<Square, string>> = {}
  Object.entries(SQUARES).forEach(([sq, i]) => {
    const encoded = board[i]
    if (encoded) charMap[sq as Square] = symbol(decodePiece(encoded))
  })
  return charMap
}

const BIT_SHIFT: bigint[] = new Array(64)
for (let i = 0; i < 64; i++) {
  BIT_SHIFT[i] = BigInt(1) << BigInt(i)
}

// Precomputed: 64 valid 0x88 square indices
const VALID_SQ: number[] = []
for (let i = 0; i < 128; i++) {
  if (!(i & 0x88)) VALID_SQ.push(i)
}

// Precomputed: 0x88 square index → BigInt bit mask
export const SQ_BIT: bigint[] = new Array(128)
for (let i = 0; i < 128; i++) {
  if (i & 0x88) {
    SQ_BIT[i] = 0n
    continue
  }
  SQ_BIT[i] = BIT_SHIFT[(i >> 4) * 8 + (i & 7)]
}

// Precomputed: encoded byte → flat bitboard index (0-11)
// white pieces: p=0, n=1, b=2, r=3, q=4, k=5
// black pieces: p=6, n=7, b=8, r=9, q=10, k=11
const ENC_TO_BB: number[] = new Array(16)
for (let e = 0; e < 16; e++) {
  const pt = e & 7
  const color = (e >> 3) & 1
  ENC_TO_BB[e] = pt ? color * 6 + (pt - 1) : 0
}

export function toBitBoard(board: Board): BitBoard {
  const bb: bigint[] = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]
  for (let si = 0; si < 64; si++) {
    const sq = VALID_SQ[si]
    const encoded = board[sq]
    if (encoded) {
      bb[ENC_TO_BB[encoded]] |= SQ_BIT[sq]
    }
  }
  return {
    w: { p: bb[0], n: bb[1], b: bb[2], r: bb[3], q: bb[4], k: bb[5] },
    b: { p: bb[6], n: bb[7], b: bb[8], r: bb[9], q: bb[10], k: bb[11] },
  }
}

export function toCastlingBits(castling: ColorState): number {
  return (
    (+!!(BITS.KSIDE_CASTLE & castling.w) << 3) +
    (+!!(BITS.QSIDE_CASTLE & castling.w) << 2) +
    (+!!(BITS.KSIDE_CASTLE & castling.b) << 1) +
    +!!(BITS.QSIDE_CASTLE & castling.b)
  )
}

export function fromCastlingBits(castling: number): ColorState {
  return {
    w:
      ((castling >> 3) & 1) * BITS.KSIDE_CASTLE +
      ((castling >> 2) & 1) * BITS.QSIDE_CASTLE,
    b:
      ((castling >> 1) & 1) * BITS.KSIDE_CASTLE +
      (castling & 1) * BITS.QSIDE_CASTLE,
  }
}

export function toNibbleBoard(board: Board): number[] {
  const nibbleBoard: number[] = new Array(64).fill(0)
  const squares = Object.keys(SQUARES) as Square[]
  for (let i = 0; i < squares.length; i++) {
    const key = squares[i]
    const sq = BIT_SQUARES[key]
    const encoded = board[SQUARES[key]]
    if (encoded) {
      const piece = decodePiece(encoded)
      const color = piece.color === 'w' ? 1 : 7
      const nibble = color + 'pnbrqk'.indexOf(piece.type)
      nibbleBoard[sq] = nibble
    }
  }
  return nibbleBoard
}

export function fromBitBoard(bitboard: BitBoard): Board {
  const board: Board = new Uint8Array(128)
  for (let i = 0; i < 64; i++) {
    const sq = bitToSquare(i)
    const bit = BigInt(1) << BigInt(i)
    for (const color of ['w', 'b'] as const) {
      for (const piece of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
        if (bitboard[color][piece] & bit) {
          board[sq] = encodePiece(piece, color)
        }
      }
    }
  }
  return board
}

export function fromNibbleBoard(nibbleBoard: number[]): Board {
  const board: Board = new Uint8Array(128)
  for (let i = 0; i < 64; i++) {
    const sq = bitToSquare(i)
    const nibble = nibbleBoard[i]
    if (nibble) {
      const color = nibble < 7 ? 'w' : 'b'
      const piece = 'pnbrqk'[
        nibble > 6 ? nibble - 7 : nibble - 1
      ] as PieceSymbol
      board[sq] = encodePiece(piece, color)
    }
  }
  return board
}
