import { BITS, BIT_SQUARES, RANKS, SQUARES } from './constants'
import {
  BitBoard,
  Board,
  ColorState,
  PieceSymbol,
  Square,
} from './interfaces/types'
import { bitToSquare, symbol } from './utils'

export function ascii(board: Readonly<Board>, eol = '\n'): string {
  const pieces = RANKS.map((rank) => {
    const rankPieces = board.slice(rank * 16, rank * 16 + 8)
    // Use a loop because `map` skips empty indexes
    const row: string[] = []
    for (const piece of rankPieces) {
      row.push(piece ? ` ${symbol(piece)} ` : ' . ')
    }
    const rankStr = row.join('')

    return '87654321'[rank] + ' |' + rankStr + '|'
  })

  return [
    '  +------------------------+',
    pieces.join(eol),
    '  +------------------------+',
    '    a  b  c  d  e  f  g  h',
  ].join(eol)
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
