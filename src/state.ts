import { BitState, BoardState, HexState, PieceSymbol } from './interfaces/types'
import { fromCastlingBits, toBitBoard, toCastlingBits } from './board'
import { bitToSquare, squareToBit } from './utils'
import {
  EMPTY,
  WHITE,
  PIECE_TYPE_NUM,
  COLOR_NUM,
  PT_ROOK,
  COLOR_W,
  COLOR_B,
  BITS,
} from './constants'
import { cloneMove } from './move'

export function defaultBoardState(): BoardState {
  return {
    board: new Uint8Array(128),
    kings: { w: EMPTY, b: EMPTY },
    turn: WHITE,
    castling: { w: 0, b: 0 },
    castlingRooks: {
      w: { k: EMPTY, q: EMPTY },
      b: { k: EMPTY, q: EMPTY },
    },
    ep_square: EMPTY,
    half_moves: 0,
    move_number: 1,
  }
}

export function cloneHexState(state: HexState): HexState {
  return {
    boardState: cloneBoardState(state.boardState),
    nags: state.nags?.slice(),
    move: state.move ? cloneMove(state.move) : undefined,
    comment: state.comment,
    startingComment: state.startingComment,
  }
}

export function cloneBoardState(state: BoardState): BoardState {
  return {
    board: state.board.slice(),
    kings: { ...state.kings },
    turn: state.turn,
    castling: { ...state.castling },
    castlingRooks: {
      w: { ...state.castlingRooks.w },
      b: { ...state.castlingRooks.b },
    },
    ep_square: state.ep_square,
    half_moves: state.half_moves,
    move_number: state.move_number,
  }
}

/** @public */
export function fromBitState(state: BitState): BoardState {
  const board = new Uint8Array(128)
  const kings = { w: EMPTY, b: EMPTY }
  for (const color of ['w', 'b'] as const) {
    const colorBit = COLOR_NUM[color]
    for (const piece of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
      const pt = PIECE_TYPE_NUM[piece as PieceSymbol]
      let bits = state.board[color][piece]
      let pos = 0
      while (bits > 0n) {
        if (bits & 1n) {
          const sq = bitToSquare(pos)
          board[sq] = colorBit | pt
          if (piece === 'k') kings[color] = sq
        }
        bits >>= 1n
        pos++
      }
    }
  }
  const castling = fromCastlingBits(state.castling)
  const castlingRooks = {
    w: { k: EMPTY, q: EMPTY },
    b: { k: EMPTY, q: EMPTY },
  }
  // Infer castling rook squares from actual rook positions on the back rank.
  // For each side with castling rights, find the outermost rook on each side
  // of the king (rightmost for kside, leftmost for qside).
  for (const color of ['w', 'b'] as const) {
    const colorBit = color === 'w' ? COLOR_W : COLOR_B
    const backRank = color === 'w' ? 0x70 : 0x00 // rank 1 or rank 8
    const kingSq = kings[color]
    if (castling[color] & BITS.KSIDE_CASTLE) {
      // Rightmost rook to the right of the king
      for (let sq = backRank + 7; sq > kingSq; sq--) {
        if (
          board[sq] &&
          (board[sq] & 7) === PT_ROOK &&
          (board[sq] & 8) === colorBit
        ) {
          castlingRooks[color].k = sq
          break
        }
      }
    }
    if (castling[color] & BITS.QSIDE_CASTLE) {
      // Leftmost rook to the left of the king
      for (let sq = backRank; sq < kingSq; sq++) {
        if (
          board[sq] &&
          (board[sq] & 7) === PT_ROOK &&
          (board[sq] & 8) === colorBit
        ) {
          castlingRooks[color].q = sq
          break
        }
      }
    }
  }
  return {
    board,
    kings,
    turn: state.wtm ? 'w' : 'b',
    castling,
    castlingRooks,
    ep_square: bitToSquare(state.ep_square),
    half_moves: state.half_moves,
    move_number: state.move_number,
  }
}

/** @public */
export function toBitState(state: BoardState): BitState {
  return {
    board: toBitBoard(state.board),
    wtm: state.turn === 'w',
    ep_square: squareToBit(state.ep_square),
    half_moves: state.half_moves,
    move_number: state.move_number,
    castling: toCastlingBits(state.castling),
  }
}
