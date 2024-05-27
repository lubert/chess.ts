import { Chess } from '../src/chess'
import { toBitState, fromBitState } from '../src/state'

describe('Bit State', () => {
  it('should convert between a board and bitstate', () => {
    const chess = new Chess()
    const bitstate = toBitState(chess.state)
    const state = fromBitState(bitstate)
    expect(state).toEqual(chess.state)
  })
})
