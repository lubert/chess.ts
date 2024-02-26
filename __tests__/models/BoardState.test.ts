import { Chess } from '../../src/chess'
import { BoardState } from '../../src/models/BoardState'

describe('BoardState', () => {
  it('should convert between a board and bitstate', () => {
    const chess = new Chess()
    const bitstate = chess.state.toBitState()
    const state = BoardState.fromBitState(bitstate)
    expect(state).toEqual(chess.state)
  })
})
