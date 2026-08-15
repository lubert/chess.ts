import { TreeNode } from 'treenode.ts'
import { Chess } from '../src/chess'
import {
  asStoredMove,
  ensureSan,
  hexMoveToMove,
  hexToMove,
  generateMoves,
  loadFen,
} from '../src/move'
import { NodeModel } from '../src/interfaces/types'

const PGN_WITH_VARIATIONS = `[Event "Test"]

1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 (2... d6 3. d4) 3. Bb5 a6 *`

/** Every node below the root, in tree order. */
function moveNodes(chess: Chess): TreeNode<NodeModel>[] {
  return chess.tree.flatten('pre').filter((n) => !n.isRoot)
}

describe('StoredMove invariant', () => {
  it('holds for every node built by move()', () => {
    const chess = new Chess()
    ;['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'].forEach((san) => chess.move(san))

    const nodes = moveNodes(chess)
    expect(nodes).toHaveLength(5)
    nodes.forEach((node) => {
      expect(typeof node.model.move?.san).toBe('string')
      expect(node.model.move?.san).not.toBe('')
    })
  })

  it('holds for every node built by loadPgn, variations included', () => {
    const chess = new Chess()
    chess.loadPgn(PGN_WITH_VARIATIONS)

    const nodes = moveNodes(chess)
    // Mainline is 6 plies; the two variations add 4 and 2.
    expect(nodes.length).toBeGreaterThan(6)
    nodes.forEach((node) => {
      expect(typeof node.model.move?.san).toBe('string')
    })
  })

  it('survives a move played into an existing variation', () => {
    const chess = new Chess()
    chess.loadPgn(PGN_WITH_VARIATIONS)
    chess.setCurrentNode('')
    chess.move('e4')
    chess.move('c5', { asVariation: true })

    moveNodes(chess).forEach((node) => {
      expect(typeof node.model.move?.san).toBe('string')
    })
  })
})

describe('hexMoveToMove', () => {
  it('matches what hexToMove produced from the parent board state', () => {
    const chess = new Chess()
    chess.loadPgn(PGN_WITH_VARIATIONS)

    const nodes = moveNodes(chess)
    expect(nodes.length).toBeGreaterThan(0)
    nodes.forEach((node) => {
      const stored = node.model.move!
      // The pre-refactor conversion: parent's board state plus the raw move.
      const viaParent = hexToMove(node.parent!.model.boardState, stored)
      expect(hexMoveToMove(stored)).toEqual(viaParent)
    })
  })

  it('carries promotion and capture fields across', () => {
    const chess = new Chess('8/P7/8/8/8/8/8/K6k w - - 0 1')
    chess.move({ from: 'a7', to: 'a8', promotion: 'q' })

    const stored = moveNodes(chess)[0].model.move!
    const move = hexMoveToMove(stored)
    expect(move.promotion).toBe('q')
    expect(move.from).toBe('a7')
    expect(move.to).toBe('a8')
    expect(move.san).toBe(stored.san)
  })
})

describe('ensureSan / asStoredMove', () => {
  it('ensureSan fills in san for a freshly generated move', () => {
    const state = loadFen(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    )!
    const candidate = generateMoves(state)[0]
    expect(candidate.san).toBeUndefined()

    const stored = ensureSan(state, candidate)
    expect(typeof stored.san).toBe('string')
  })

  it('asStoredMove throws rather than deriving san from the wrong position', () => {
    const state = loadFen(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    )!
    const candidate = generateMoves(state)[0]

    expect(() => asStoredMove(candidate)).toThrow(/no san/)
  })

  it('asStoredMove passes through a move that already has san', () => {
    const chess = new Chess()
    chess.move('e4')
    const stored = moveNodes(chess)[0].model.move!

    expect(asStoredMove(stored)).toBe(stored)
  })
})

describe('history', () => {
  it('reports the same sans the tree stores', () => {
    const chess = new Chess()
    const played = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']
    played.forEach((san) => chess.move(san))

    expect(chess.history()).toEqual(played)
  })

  it('verbose form still resolves each move', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('d5')
    chess.move('exd5')

    const verbose = chess.history({ verbose: true })
    expect(verbose.map((m) => m.san)).toEqual(['e4', 'd5', 'exd5'])
    expect(verbose[2].captured).toBe('p')
  })

  it('reports the line reaching the current node, not the mainline', () => {
    const chess = new Chess()
    chess.loadPgn(PGN_WITH_VARIATIONS)
    // Walk into the 1...c5 variation.
    chess.setCurrentNode('')
    chess.move('e4')
    const variation = chess.currentNode.children.find(
      (c) => c.model.move?.san === 'c5',
    )!
    chess.setCurrentNode(variation.pathKey)

    expect(chess.history()).toEqual(['e4', 'c5'])
  })
})
