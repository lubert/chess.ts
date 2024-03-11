import {
  Board,
  ColorState,
  Color,
  PieceSymbol,
  Square,
  BitState,
  Move,
  HexMove,
  NibbleState,
  NibblePiece,
} from '../interfaces/types'
import {
  fromBitBoard,
  fromCastlingBits,
  fromNibbleBoard,
  toBitBoard,
  toCastlingBits,
  toNibbleBoard,
} from '../board'
import { EMPTY, WHITE } from '../constants'
import { hexToMove, generateMoves, getFen, moveToSan } from '../move'
import { bitToSquare, getBitIndices, squareToBit } from '../utils'

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
    wtm,
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
      wtm ? 'w' : 'b',
      fromCastlingBits(castling),
      bitToSquare(ep_square),
      half_moves,
      move_number,
    )
  }

  public toBitState(): BitState {
    return {
      board: toBitBoard(this.board),
      wtm: this.turn === 'w',
      ep_square: squareToBit(this.ep_square),
      half_moves: this.half_moves,
      move_number: this.move_number,
      castling: toCastlingBits(this.castling),
    }
  }

  public static fromNibbleState({
    board,
    castling,
    wtm,
    ep_square,
    half_moves,
    move_number,
  }: NibbleState): BoardState {
    return new BoardState(
      fromNibbleBoard(board),
      {
        w: bitToSquare(board.indexOf(NibblePiece.WHITE_KING)),
        b: bitToSquare(board.indexOf(NibblePiece.BLACK_KING)),
      },
      wtm ? 'w' : 'b',
      fromCastlingBits(castling),
      bitToSquare(ep_square),
      half_moves,
      move_number,
    )
  }

  public toNibbleState(): NibbleState {
    return {
      board: toNibbleBoard(this.board),
      wtm: this.turn === 'w',
      ep_square: squareToBit(this.ep_square),
      half_moves: this.half_moves,
      move_number: this.move_number,
      castling: toCastlingBits(this.castling),
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
      from?: Square | number
      to?: Square | number
    } = {},
  ) {
    return generateMoves(this, options)
  }

  public toMove(hexMove: Readonly<HexMove>): Move {
    return hexToMove(this, hexMove)
  }

  public toSan(
    hexMove: Readonly<HexMove>,
    moves: HexMove[] = this.generateMoves({ piece: hexMove.piece }),
    options: { addPromotion?: boolean } = {},
  ): string {
    return moveToSan(this, hexMove, moves, options)
  }
}
