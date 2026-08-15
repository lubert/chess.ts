import { Chess } from '../src/chess'
import { getFen } from '../src/move'

describe('NodeState.fen', () => {
  it('agrees with getFen', () => {
    const chess = new Chess()
    ;['e4', 'e5', 'Nf3'].forEach((san) => chess.move(san))

    for (const node of chess.tree.flatten('pre')) {
      expect(node.model.fen).toBe(getFen(node.model.boardState))
    }
  })

  it('returns the same value on repeat reads', () => {
    const chess = new Chess()
    chess.move('e4')
    const { model } = chess.currentNode

    const first = model.fen
    expect(model.fen).toBe(first)
    expect(model.fen).toBe(getFen(model.boardState))
  })

  it('tracks a position edited by putPiece', () => {
    const chess = new Chess()
    const before = chess.fen()

    chess.putPiece({ type: 'q', color: 'w' }, 'e4')
    const after = chess.fen()

    expect(after).not.toBe(before)
    expect(after).toBe(getFen(chess.state))
    expect(after).toContain('Q')
  })

  it('tracks a position edited by removePiece', () => {
    const chess = new Chess()
    chess.removePiece('e2')

    expect(chess.fen()).toBe(getFen(chess.state))
    // Rank 2 has a hole where the pawn was.
    expect(chess.fen().split(' ')[0]).toContain('PPPP1PPP')
  })

  it('survives repeated edits to the same node', () => {
    const chess = new Chess()
    chess.clear()

    chess.putPiece({ type: 'k', color: 'w' }, 'a1')
    const oneKing = chess.fen()
    chess.putPiece({ type: 'k', color: 'b' }, 'h8')
    const twoKings = chess.fen()
    chess.removePiece('a1')
    const oneAgain = chess.fen()

    expect(oneKing).not.toBe(twoKings)
    expect(twoKings).not.toBe(oneAgain)
    expect(oneAgain).toBe(getFen(chess.state))
  })
})
