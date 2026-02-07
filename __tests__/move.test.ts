import { generateMoves, isAttacking, loadFen } from '../src/move'
import { SQUARES, KING } from '../src/constants'
import { Chess } from '../src/chess'
import { algebraic } from '../src/utils'

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

describe('pin-aware move generation', () => {
  describe('pinned rook', () => {
    it('pinned rook on a file can only move along that file', () => {
      // White rook on e4 pinned by black rook on e8, king on e1
      const state = loadFen('4r3/8/8/8/4R3/8/8/4K3 w - - 0 1')
      if (!state) throw new Error('state is undefined')
      const rookMoves = generateMoves(state, { from: 'e4' })
      // All rook moves must stay on the e-file
      expect(rookMoves.length).toBeGreaterThan(0)
      rookMoves.forEach((m) => {
        const toSq = algebraic(m.to)
        expect(toSq?.[0]).toBe('e')
      })
    })
  })

  describe('pinned knight', () => {
    it('pinned knight cannot move at all', () => {
      // White knight on e4 pinned by black rook on e8, king on e1
      const state = loadFen('4r3/8/8/8/4N3/8/8/4K3 w - - 0 1')
      if (!state) throw new Error('state is undefined')
      const knightMoves = generateMoves(state, { from: 'e4' })
      expect(knightMoves.length).toBe(0)
    })
  })

  describe('pinned pawn', () => {
    it('pinned pawn on file can push but not capture', () => {
      // White pawn on e2 pinned by black rook on e8, king on e1
      // Black pieces on d3 and f3 for potential captures
      const state = loadFen('4r3/8/8/8/8/3p1p2/4P3/4K3 w - - 0 1')
      if (!state) throw new Error('state is undefined')
      const pawnMoves = generateMoves(state, { from: 'e2' })
      // Pawn can push to e3 and e4 but not capture d3 or f3
      expect(pawnMoves.length).toBe(2)
      pawnMoves.forEach((m) => {
        const toSq = algebraic(m.to)
        expect(toSq?.[0]).toBe('e')
      })
    })

    it('pinned pawn on diagonal can capture along diagonal', () => {
      // King h1, pawn g2 pinned by bishop on f3
      // Pin ray: h1 -> g2 -> f3 (bishop)
      // Pawn can capture f3 (the pinner) but not push to g3 or g4
      const state = loadFen('8/8/8/8/8/5b2/6P1/7K w - - 0 1')
      if (!state) throw new Error('state is undefined')
      const pawnMoves = generateMoves(state, { from: 'g2' })
      expect(pawnMoves.length).toBe(1)
      expect(algebraic(pawnMoves[0].to)).toBe('f3')
    })
  })

  describe('double check', () => {
    it('only king moves are generated in double check', () => {
      // Knight on f6 and rook on e1 both check black king on e8
      const state = loadFen('4k3/8/5N2/8/8/8/8/4R2K b - - 0 1')
      if (!state) throw new Error('state is undefined')
      const moves = generateMoves(state)
      expect(moves.length).toBeGreaterThan(0)
      // All moves should be king moves
      moves.forEach((m) => {
        expect(m.piece).toBe(KING)
      })
    })
  })

  describe('en passant', () => {
    it('en passant horizontal discovered check is correctly rejected', () => {
      // 8/8/8/KPp4r/8/8/8/k7 w - c6 0 1
      // bxc6 would leave white king exposed to rook on h5
      const state = loadFen('8/8/8/KPp4r/8/8/8/k7 w - c6 0 1')
      if (!state) throw new Error('state is undefined')
      const moves = generateMoves(state)
      // b5xc6 en passant should NOT be in the move list
      const epMoves = moves.filter(
        (m) =>
          algebraic(m.from) === 'b5' && algebraic(m.to) === 'c6',
      )
      expect(epMoves.length).toBe(0)
    })

    it('en passant resolving a check is legal', () => {
      // Black pawn on d4 just moved, giving discovered check from d8 rook
      // White pawn on e4 can capture en passant on d3... actually let's use
      // a position where en passant captures the checking pawn
      // 8/8/8/2k5/3Pp3/8/8/4K3 b - d3 0 1
      // Black pawn on e4 captures d3 en passant, capturing the checking pawn
      const state = loadFen('8/8/8/2k5/3Pp3/8/8/4K3 b - d3 0 1')
      if (!state) throw new Error('state is undefined')
      const moves = generateMoves(state)
      const epMoves = moves.filter(
        (m) =>
          algebraic(m.from) === 'e4' && algebraic(m.to) === 'd3',
      )
      expect(epMoves.length).toBe(1)
    })
  })
})
