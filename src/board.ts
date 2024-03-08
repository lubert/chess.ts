import { BIT_SQUARES, SQUARES } from './constants'
import { BitBoard, Board, Square } from './interfaces/types'
import { bitToSquare } from './utils'

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
