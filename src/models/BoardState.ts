import {
  Board,
  ColorState,
  Color,
  PieceSymbol,
  Square,
  BitState,
} from '../interfaces/types'
import { fromBitBoard, toBitBoard } from '../board'
import { BITS, EMPTY, WHITE } from '../constants'
import { generateMoves, getFen } from '../move'
import { bitToSquare, getBitIndices } from '../utils'

/** @public */
export class BoardState {
  board: Board
  kings: ColorState
  turn: Color
  castling: ColorState
  ep_square: number
  half_moves: number
  move_number: number

  constructor(
    board?: Board,
    kings?: ColorState,
    turn?: Color,
    castling?: ColorState,
    ep_square?: number,
    half_moves?: number,
    move_number?: number,
  ) {
    this.board = board || new Array(128)
    this.kings = kings || { w: EMPTY, b: EMPTY }
    this.turn = turn || WHITE
    this.castling = castling || { w: 0, b: 0 }
    this.ep_square = ep_square || EMPTY
    this.half_moves = half_moves || 0
    this.move_number = move_number || 1
  }

  public get fen(): string {
    return getFen(this)
  }

  public static fromBitState({
    board,
    castling,
    turn,
    ep_square,
    half_moves,
    move_number,
  }: BitState): BoardState {
    return new BoardState(
      fromBitBoard(board),
      {
        w: bitToSquare(getBitIndices(board.w.k, true)[0]),
        b: bitToSquare(getBitIndices(board.b.k, true)[0]),
      },
      turn,
      {
        w:
          +castling.w.k * BITS.KSIDE_CASTLE + +castling.w.q * BITS.QSIDE_CASTLE,
        b:
          +castling.b.k * BITS.KSIDE_CASTLE + +castling.b.q * BITS.QSIDE_CASTLE,
      },
      ep_square,
      half_moves,
      move_number,
    )
  }

  public toBitState(): BitState {
    return {
      board: toBitBoard(this.board),
      turn: this.turn,
      ep_square: this.ep_square,
      half_moves: this.half_moves,
      move_number: this.move_number,
      castling: {
        w: {
          k: !!(BITS.KSIDE_CASTLE & this.castling.w),
          q: !!(BITS.QSIDE_CASTLE & this.castling.w),
        },
        b: {
          k: !!(BITS.KSIDE_CASTLE & this.castling.b),
          q: !!(BITS.QSIDE_CASTLE & this.castling.b),
        },
      },
    }
  }

  public clone(): BoardState {
    return new BoardState(
      this.board.slice(),
      {
        w: this.kings.w,
        b: this.kings.b,
      },
      this.turn,
      {
        w: this.castling.w,
        b: this.castling.b,
      },
      this.ep_square,
      this.half_moves,
      this.move_number,
    )
  }

  public generateMoves(
    options: {
      legal?: boolean
      piece?: PieceSymbol
      square?: Square | number
    } = {},
  ) {
    return generateMoves(this, options)
  }
}
