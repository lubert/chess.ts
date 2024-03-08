import { Chess } from '../src/chess'
import { fromBitBoard, toBitBoard } from '../src/board'

describe('bitboard', () => {
  it('should convert between a board and bitboard', () => {
    const chess = new Chess()
    const board = chess.state.board
    const bitboard = toBitBoard(board)
    const board2 = fromBitBoard(bitboard)
    expect(board2).toEqual(board)
  })
})
