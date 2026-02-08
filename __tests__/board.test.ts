import { Chess } from '../src/chess'
import {
  fromBitBoard,
  mapToAscii,
  toBitBoard,
  toNibbleBoard,
  fromNibbleBoard,
} from '../src/board'
import { DEFAULT_POSITION } from '../src/constants'
import { loadFen } from '../src/move'

describe('bitboard', () => {
  it('should convert between a board and bitboard', () => {
    const chess = new Chess()
    const board = chess.state.board
    const bitboard = toBitBoard(board)
    const board2 = fromBitBoard(bitboard)
    expect(board2).toEqual(board)
  })
})

describe('mapToAscii', () => {
  it('should render a char map', () => {
    const charMap = {
      e4: 'O',
      e5: 'X',
    }

    expect(mapToAscii(charMap)).toBe(
      '  +------------------------+\n' +
        '8 | .  .  .  .  .  .  .  . |\n' +
        '7 | .  .  .  .  .  .  .  . |\n' +
        '6 | .  .  .  .  .  .  .  . |\n' +
        '5 | .  .  .  .  X  .  .  . |\n' +
        '4 | .  .  .  .  O  .  .  . |\n' +
        '3 | .  .  .  .  .  .  .  . |\n' +
        '2 | .  .  .  .  .  .  .  . |\n' +
        '1 | .  .  .  .  .  .  .  . |\n' +
        '  +------------------------+\n' +
        '    a  b  c  d  e  f  g  h',
    )
  })
})

describe('nibbleBoard', () => {
  it('round-trips through toNibbleBoard and fromNibbleBoard', () => {
    const chess = new Chess()
    const board = chess.state.board
    const nibble = toNibbleBoard(board)
    const restored = fromNibbleBoard(nibble)
    expect(restored).toEqual(board)
  })

  it('round-trips a position with pawns and pieces of both colors', () => {
    const chess = new Chess(
      'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2',
    )
    const board = chess.state.board
    const nibble = toNibbleBoard(board)
    const restored = fromNibbleBoard(nibble)
    expect(restored).toEqual(board)
  })
})
