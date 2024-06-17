import { Chess } from '../src/chess'
import { fromBitBoard, mapToAscii, toBitBoard } from '../src/board'
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
