import { Board, ColorState, Color } from '../interfaces/types'
import { EMPTY, WHITE } from '../constants'
import { getFen } from '../move'

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

  public get fen(): string {
    return getFen(this)
  }
}
