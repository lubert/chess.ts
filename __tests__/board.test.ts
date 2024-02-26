import { Chess } from '../src/chess'
import { fromBitBoard, toBitBoard } from '../src/board'

describe('bitboard', () => {
  it('should convert between a board and bitboard', () => {
    const chess = new Chess()
    const board = chess.state.board
    const bitboard = toBitBoard(board)
    expect(bitboard.occupied & bitboard.empty).toEqual(BigInt(0))
    expect(
      bitboard.w.k |
        bitboard.b.k |
        bitboard.w.q |
        bitboard.b.q |
        bitboard.w.r |
        bitboard.b.r |
        bitboard.w.b |
        bitboard.b.b |
        bitboard.w.n |
        bitboard.b.n |
        bitboard.w.p |
        bitboard.b.p,
    ).toEqual(bitboard.occupied)

    const board2 = fromBitBoard(bitboard)
    expect(board2).toEqual(board)
  })
})
