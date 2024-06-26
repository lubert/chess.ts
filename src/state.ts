import { BitState, BoardState, HexState } from './interfaces/types'
import {
  fromBitBoard,
  fromCastlingBits,
  toBitBoard,
  toCastlingBits,
} from './board'
import { bitToSquare, getBitIndices, squareToBit } from './utils'
import { EMPTY, WHITE } from './constants'
import { cloneMove } from './move'

export function defaultBoardState(): BoardState {
  return {
    board: new Array(128),
    kings: { w: EMPTY, b: EMPTY },
    turn: WHITE,
    castling: { w: 0, b: 0 },
    ep_square: EMPTY,
    half_moves: 0,
    move_number: 1,
  }
}

export function cloneHexState(state: HexState): HexState {
  return {
    boardState: cloneBoardState(state.boardState),
    fen: state.fen,
    nags: state.nags?.slice(),
    move: state.move ? cloneMove(state.move) : undefined,
    comment: state.comment,
  }
}

export function cloneBoardState(state: BoardState): BoardState {
  return {
    board: state.board.slice(),
    kings: { ...state.kings },
    turn: state.turn,
    castling: { ...state.castling },
    ep_square: state.ep_square,
    half_moves: state.half_moves,
    move_number: state.move_number,
  }
}

export function fromBitState(state: BitState): BoardState {
  return {
    board: fromBitBoard(state.board),
    kings: {
      w: bitToSquare(getBitIndices(state.board.w.k, true)[0]),
      b: bitToSquare(getBitIndices(state.board.b.k, true)[0]),
    },
    turn: state.wtm ? 'w' : 'b',
    castling: fromCastlingBits(state.castling),
    ep_square: bitToSquare(state.ep_square),
    half_moves: state.half_moves,
    move_number: state.move_number,
  }
}

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
