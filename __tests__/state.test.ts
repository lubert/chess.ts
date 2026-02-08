import { Chess } from '../src/chess'
import { toBitState, fromBitState } from '../src/state'

describe('Bit State', () => {
  it('should convert between a board and bitstate', () => {
    const chess = new Chess()
    const bitstate = toBitState(chess.state)
    const state = fromBitState(bitstate)
    expect(state).toEqual(chess.state)
  })

  it('should round-trip with black to move', () => {
    const chess = new Chess(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    )
    const bitstate = toBitState(chess.state)
    const state = fromBitState(bitstate)
    expect(state).toEqual(chess.state)
  })
})
