import { Chess } from '../src/chess'
import {
  boardToAscii,
  fromBitBoard,
  mapToAscii,
  toBitBoard,
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

describe('boardToAscii', () => {
  it('should render a board state', () => {
    const state = loadFen(DEFAULT_POSITION)
    const board = state?.board
    if (!board) throw new Error('board is undefined')
    expect(boardToAscii(board)).toBe(
      '  +------------------------+\n' +
        '8 | r  n  b  q  k  b  n  r |\n' +
        '7 | p  p  p  p  p  p  p  p |\n' +
        '6 | .  .  .  .  .  .  .  . |\n' +
        '5 | .  .  .  .  .  .  .  . |\n' +
        '4 | .  .  .  .  .  .  .  . |\n' +
        '3 | .  .  .  .  .  .  .  . |\n' +
        '2 | P  P  P  P  P  P  P  P |\n' +
        '1 | R  N  B  Q  K  B  N  R |\n' +
        '  +------------------------+\n' +
        '    a  b  c  d  e  f  g  h',
    )
  })
})
