import { BitState, BoardState, HexState, PieceSymbol } from './interfaces/types'
import { fromCastlingBits, toBitBoard, toCastlingBits } from './board'
import { bitToSquare, squareToBit } from './utils'
import { EMPTY, WHITE, PIECE_TYPE_NUM, COLOR_NUM, SQUARES } from './constants'
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
    w: {
      k: castling.w & 32 ? SQUARES.h1 : EMPTY, // BITS.KSIDE_CASTLE = 32
      q: castling.w & 64 ? SQUARES.a1 : EMPTY, // BITS.QSIDE_CASTLE = 64
    },
    b: {
      k: castling.b & 32 ? SQUARES.h8 : EMPTY,
      q: castling.b & 64 ? SQUARES.a8 : EMPTY,
    },
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
