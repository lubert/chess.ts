import {
  BitState,
  BoardState,
  NodeModel,
  PieceSymbol,
  StoredMove,
} from './interfaces/types'
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
import { cloneMove, getFen } from './move'

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

/**
 * A node's state. `fen` is derived once and held, so walking a tree costs no
 * conversion. Callers must replace `boardState` rather than mutate it in
 * place, or the memoized `fen` goes stale.
 */
export class NodeState implements NodeModel {
  public nags?: number[]

  public move?: StoredMove

  public comment?: string

  public startingComment?: string

  private _boardState: BoardState

  private _fen?: string

  constructor(init: {
    boardState: BoardState
    move?: StoredMove
    nags?: number[]
    comment?: string
    startingComment?: string
  }) {
    this._boardState = init.boardState
    this.move = init.move
    this.nags = init.nags
    this.comment = init.comment
    this.startingComment = init.startingComment
  }

  public get boardState(): BoardState {
    return this._boardState
  }

  // Editing the board replaces the position, so the derived fen is dropped.
  public set boardState(state: BoardState) {
    this._boardState = state
    this._fen = undefined
  }

  public get fen(): string {
    if (this._fen === undefined) this._fen = getFen(this._boardState)
    return this._fen
  }
}

export function cloneNodeState(state: NodeModel): NodeState {
  return new NodeState({
    boardState: cloneBoardState(state.boardState),
    nags: state.nags?.slice(),
    move: state.move ? cloneMove(state.move) : undefined,
    comment: state.comment,
    startingComment: state.startingComment,
  })
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
