import { Chess } from '../../src/chess'
import { BoardState } from '../../src/models/BoardState'

describe('BoardState', () => {
  it('should convert between a board and bitstate', () => {
    const chess = new Chess()
    const bitstate = chess.state.toBitState()
    const state = BoardState.fromBitState(bitstate)
    expect(state).toEqual(chess.state)
  })

  it('should convert between a board and nibble state', () => {
    const chess = new Chess()
    const nibbleState = chess.state.toNibbleState()
    const state = BoardState.fromNibbleState(nibbleState)
    expect(state).toEqual(chess.state)
  })
})
