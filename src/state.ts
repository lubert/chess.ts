import { BitState, BoardState, HexState, PieceSymbol } from './interfaces/types'
import { fromCastlingBits, toBitBoard, toCastlingBits } from './board'
import { bitToSquare, squareToBit } from './utils'
import { EMPTY, WHITE, PIECE_TYPE_NUM, COLOR_NUM } from './constants'
import { cloneMove } from './move'

export function defaultBoardState(): BoardState {
  return {
    board: new Uint8Array(128),
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
    ep_square: state.ep_square,
    half_moves: state.half_moves,
    move_number: state.move_number,
  }
}

export function fromBitState(state: BitState): BoardState {
  const board = new Uint8Array(128)
  const kings = { w: EMPTY, b: EMPTY }
  for (const color of ['w', 'b'] as const) {
    const colorBit = COLOR_NUM[color]
    for (const piece of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
      const pt = PIECE_TYPE_NUM[piece as PieceSymbol]
      let bits = state.board[color][piece]
      let pos = 0
      while (bits > BigInt(0)) {
        if (bits & BigInt(1)) {
          const sq = bitToSquare(pos)
          board[sq] = colorBit | pt
          if (piece === 'k') kings[color] = sq
        }
        bits >>= BigInt(1)
        pos++
      }
    }
  }
  return {
    board,
    kings,
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
