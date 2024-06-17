import { BITS, BIT_SQUARES, RANKS, SQUARES } from './constants'
import {
  BitBoard,
  Board,
  ColorState,
  PieceSymbol,
  Square,
} from './interfaces/types'
import { bitToSquare, symbol } from './utils'

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
    const piece = board[i]
    if (piece) charMap[sq as Square] = symbol(piece)
  })
  return charMap
}

export function toBitBoard(board: Board): BitBoard {
  const bitboard: BitBoard = {
    w: {
      p: BigInt(0),
      n: BigInt(0),
      b: BigInt(0),
      r: BigInt(0),
      q: BigInt(0),
      k: BigInt(0),
    },
    b: {
      p: BigInt(0),
      n: BigInt(0),
      b: BigInt(0),
      r: BigInt(0),
      q: BigInt(0),
      k: BigInt(0),
    },
  }
  const squares = Object.keys(SQUARES) as Square[]
  for (let i = 0; i < squares.length; i++) {
    const key = squares[i]
    const sq = BIT_SQUARES[key]
    const piece = board[SQUARES[key]]
    if (piece) {
      bitboard[piece.color][piece.type] |= BigInt(1) << BigInt(sq)
    }
  }
  return bitboard
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
    const piece = board[SQUARES[key]]
    if (piece) {
      const color = piece.color === 'w' ? 1 : 7
      const nibble = color + 'pnbrqk'.indexOf(piece.type)
      nibbleBoard[sq] = nibble
    }
  }
  return nibbleBoard
}

export function fromBitBoard(bitboard: BitBoard): Board {
  const board: Board = new Array(128)
  for (let i = 0; i < 64; i++) {
    const sq = bitToSquare(i)
    const bit = BigInt(1) << BigInt(i)
    for (const color of ['w', 'b'] as const) {
      for (const piece of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
        if (bitboard[color][piece] & bit) {
          board[sq] = { type: piece, color }
        }
      }
    }
  }
  return board
}

export function fromNibbleBoard(nibbleBoard: number[]): Board {
  const board: Board = new Array(128)
  for (let i = 0; i < 64; i++) {
    const sq = bitToSquare(i)
    const nibble = nibbleBoard[i]
    if (nibble) {
      const color = nibble < 7 ? 'w' : 'b'
      const piece = 'pnbrqk'[
        nibble > 6 ? nibble - 7 : nibble - 1
      ] as PieceSymbol
      board[sq] = { type: piece, color }
    }
  }
  return board
}
