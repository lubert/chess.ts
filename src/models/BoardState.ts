import { Board, ColorState, Color, HexMove, Square } from '../interfaces/types'
import { EMPTY, WHITE, SQUARES } from '../constants'
import { getFen, generateMoves, isLegal } from '../move'
import { isSquare } from '../utils'

/** @public */
export class BoardState {
  board: Board
  kings: ColorState
  turn: Color
  castling: ColorState
  ep_square: number
  half_moves: number
  move_number: number

  protected moves?: HexMove[]

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

  public generateMoves(
    options: { legal?: boolean; square?: string } = {},
  ): HexMove[] {
    const { legal = true, square } = options

    let sq: number | undefined
    if (square) {
      if (!isSquare(square)) return []
      sq = SQUARES[square]
    }

    if (!this.moves) this.moves = generateMoves(this)

    const filters = []
    if (sq) filters.push((move: HexMove) => move.from === sq)
    if (legal) filters.push((move: HexMove) => isLegal(this, move))
    return filters.reduce(
      (moves, filter) => moves.filter(filter),
      this.moves.slice(),
    )
  }
}
