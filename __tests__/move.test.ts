import { generateMoves, isAttacking, loadFen } from '../src/move'
import { SQUARES } from '../src/constants'
import { Chess } from '../src/chess'

describe('check and checkmate flags', () => {
  it('should set CHECK flag when move gives check', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    chess.move('Qh5')
    chess.move('Nc6')
    const move = chess.move('Qxf7')
    expect(move?.san).toBe('Qxf7+')
    expect(move?.flags).toContain('+')
    expect(move?.flags).not.toContain('#')
  })

  it('should set CHECKMATE flag when move gives checkmate', () => {
    const chess = new Chess()
    chess.move('f3')
    chess.move('e5')
    chess.move('g4')
    const move = chess.move('Qh4')
    expect(move?.san).toBe('Qh4#')
    expect(move?.flags).toContain('#')
    expect(move?.flags).not.toContain('+')
  })

  it('should set CHECK flag when using object move input', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    chess.move('Qh5')
    chess.move('Nc6')
    const move = chess.move({ from: 'h5', to: 'f7' })
    expect(move?.san).toBe('Qxf7+')
    expect(move?.flags).toContain('+')
  })

  it('should not set CHECK/CHECKMATE flags for non-check moves', () => {
    const chess = new Chess()
    const move = chess.move('e4')
    expect(move?.flags).not.toContain('+')
    expect(move?.flags).not.toContain('#')
  })
})

describe('generateMoves', () => {
  describe('castling', () => {
    it('should not generate moves where the to square does not match', () => {
      const game = new Chess('8/8/3K4/8/8/3R4/8/kr6 w KQkq - 0 1')
      const moves = generateMoves(game.state, { from: 'd6', to: 'a8' })
      expect(moves.length).toBe(0)
    })
  })
})

describe('isAttacking', () => {
  describe('pawn', () => {
    it('returns whether a square is attacked by a pawn', () => {
      const state = loadFen('8/8/8/8/8/3ppp2/4P3/8 w KQkq - 0 1')
      if (!state) throw new Error('state is undefined')
      expect(isAttacking(state, SQUARES.e2, SQUARES.f3)).toBe(true)
      expect(isAttacking(state, SQUARES.e2, SQUARES.d3)).toBe(true)
      expect(isAttacking(state, SQUARES.e2, SQUARES.e3)).toBe(false)
      expect(isAttacking(state, SQUARES.e2, SQUARES.e2)).toBe(false)
    })
  })

  describe('knight', () => {
    it('returns whether a square is attacked by a knight', () => {
      const state = loadFen('8/8/3n1n2/2n3n1/4P3/2n3n1/3n1n2/8 b KQkq - 0 1')
      if (!state) throw new Error('state is undefined')
      const attackSquares = [
        SQUARES.f2,
        SQUARES.g3,
        SQUARES.g5,
        SQUARES.f6,
        SQUARES.d6,
        SQUARES.c5,
        SQUARES.c3,
        SQUARES.d2,
      ]
      attackSquares.forEach((square) => {
        expect(isAttacking(state, square, SQUARES.e4)).toBe(true)
      })
    })
  })

  describe('bishop', () => {
    it('returns whether a square is attacked by a bishop', () => {
      const state = loadFen(
        '8/1b5b/2b1b1b1/8/2b1P1b1/8/2b1b1b1/1b5b b KQkq - 0 1',
      )
      if (!state) throw new Error('state is undefined')
      const attackSquares = [SQUARES.c2, SQUARES.c6, SQUARES.g2, SQUARES.g6]
      attackSquares.forEach((square) => {
        expect(isAttacking(state, square, SQUARES.e4)).toBe(true)
      })
      const blockedSquares = [
        SQUARES.b1,
        SQUARES.b7,
        SQUARES.c4,
        SQUARES.e2,
        SQUARES.e6,
        SQUARES.g4,
        SQUARES.h1,
        SQUARES.h7,
      ]
      blockedSquares.forEach((square) => {
        expect(isAttacking(state, square, SQUARES.e4)).toBe(false)
      })
    })
  })

  describe('rook', () => {
    it('returns whether a square is attacked by a rook', () => {
      const state = loadFen(
        '8/4r3/2r1r1r1/8/1rr1P1rr/8/2r1r1r1/4r3 b KQkq - 0 1',
      )
      if (!state) throw new Error('state is undefined')
      const attackSquares = [SQUARES.c4, SQUARES.e2, SQUARES.e6, SQUARES.g4]
      attackSquares.forEach((square) => {
        expect(isAttacking(state, square, SQUARES.e4)).toBe(true)
      })
      const blockedSquares = [
        SQUARES.b4,
        SQUARES.c2,
        SQUARES.c6,
        SQUARES.e1,
        SQUARES.e7,
        SQUARES.g2,
        SQUARES.g6,
        SQUARES.h4,
      ]
      blockedSquares.forEach((square) => {
        expect(isAttacking(state, square, SQUARES.e4)).toBe(false)
      })
    })
  })

  describe('queen', () => {
    it('returns whether a square is attacked by a queen', () => {
      const state = loadFen(
        '8/1q2q2q/2q1q1q1/8/1qq1P1qq/8/2q1q1q1/1q2q2q b KQkq - 0 1',
      )
      if (!state) throw new Error('state is undefined')
      const attackSquares = [
        SQUARES.c2,
        SQUARES.c4,
        SQUARES.c6,
        SQUARES.e2,
        SQUARES.e6,
        SQUARES.g2,
        SQUARES.g4,
        SQUARES.g6,
      ]
      attackSquares.forEach((square) => {
        expect(isAttacking(state, square, SQUARES.e4)).toBe(true)
      })
      const blockedSquares = [
        SQUARES.b1,
        SQUARES.b4,
        SQUARES.b7,
        SQUARES.e1,
        SQUARES.e7,
        SQUARES.h1,
        SQUARES.h4,
        SQUARES.h7,
      ]
      blockedSquares.forEach((square) => {
        expect(isAttacking(state, square, SQUARES.e4)).toBe(false)
      })
    })
  })
})
