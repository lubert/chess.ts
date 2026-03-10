import { Chess } from '../src/chess'
import { toBitState, fromBitState } from '../src/state'
import { loadFen } from '../src/move'

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

  it('should infer Chess960 castling rook squares from board', () => {
    // Chess960 SP 0 starting position: BBQNNRKR
    // King on g1, rooks on f1 (qside) and h1 (kside)
    const original = loadFen(
      'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KFkf - 0 1',
    )!
    const bitstate = toBitState(original)
    const restored = fromBitState(bitstate)
    expect(restored.castlingRooks).toEqual(original.castlingRooks)
  })
})
