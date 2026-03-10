import { Chess } from '../src/chess'
import { SQUARES, BITS } from '../src/constants'
import {
  loadFen,
  generateMoves,
  perft,
  getFen,
  validateMove,
  moveToUci,
  generateChess960Fen,
} from '../src/move'
import { algebraic } from '../src/utils'

describe('Chess960 / X-FEN', () => {
  describe('X-FEN parsing', () => {
    it('parses standard KQkq as standard rook squares', () => {
      const chess = new Chess()
      const state = chess.state
      expect(state.castlingRooks.w.k).toBe(SQUARES.h1)
      expect(state.castlingRooks.w.q).toBe(SQUARES.a1)
      expect(state.castlingRooks.b.k).toBe(SQUARES.h8)
      expect(state.castlingRooks.b.q).toBe(SQUARES.a8)
    })

    it('parses X-FEN with file letters for white', () => {
      // King on d1, rooks on a1 (qside) and f1 (kside)
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R2K1R2 w AFaf - 0 1'
      const state = loadFen(fen)!
      expect(state).not.toBeNull()
      expect(state.castlingRooks.w.q).toBe(SQUARES.a1)
      expect(state.castlingRooks.w.k).toBe(SQUARES.f1)
      expect(state.castlingRooks.b.q).toBe(SQUARES.a8)
      expect(state.castlingRooks.b.k).toBe(SQUARES.f8)
      expect(state.castling.w).toBe(BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)
      expect(state.castling.b).toBe(BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)
    })

    it('parses X-FEN with single castling rights', () => {
      // King on b1, rook on a1 (qside only)
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RK6 w A - 0 1'
      const state = loadFen(fen)!
      expect(state).not.toBeNull()
      expect(state.castlingRooks.w.q).toBe(SQUARES.a1)
      expect(state.castling.w).toBe(BITS.QSIDE_CASTLE)
    })

    it('parses no castling rights as dash', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'
      const state = loadFen(fen)!
      expect(state.castling.w).toBe(0)
      expect(state.castling.b).toBe(0)
    })
  })

  describe('X-FEN round-trip', () => {
    it('standard position round-trips as KQkq', () => {
      const chess = new Chess()
      expect(chess.fen()).toBe(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      )
    })

    it('non-standard rook positions round-trip as file letters', () => {
      const fen =
        'rn2k1r1/ppp1pp1p/3p2p1/5bn1/P7/2N2B2/1PPPPP2/2BNK1RR w Gg - 4 11'
      const state = loadFen(fen)!
      expect(state).not.toBeNull()
      expect(getFen(state)).toBe(fen)
    })

    it('mixed standard and X-FEN round-trips correctly', () => {
      // White: standard h1 rook (K), non-standard b1 rook (B)
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KBkq - 0 1'
      const state = loadFen(fen)!
      expect(getFen(state)).toBe(fen)
    })
  })

  describe('Chess960 castling move generation', () => {
    it('generates kside castling with king on d1, rook on f1', () => {
      // King on d1, rook on f1, empty e1/g1
      const fen = '8/8/8/8/8/8/8/3K1R2 w F - 0 1'
      const state = loadFen(fen)!
      const moves = generateMoves(state, { piece: 'k' })
      const castleMove = moves.find((m) => m.flags & BITS.KSIDE_CASTLE)
      expect(castleMove).toBeDefined()
      // King should go to g1
      expect(algebraic(castleMove!.to)).toBe('g1')
    })

    it('generates qside castling with king on f1, rook on a1', () => {
      // King on f1, rook on a1, empty b1-e1
      const fen = '8/8/8/8/8/8/8/R4K2 w A - 0 1'
      const state = loadFen(fen)!
      const moves = generateMoves(state, { piece: 'k' })
      const castleMove = moves.find((m) => m.flags & BITS.QSIDE_CASTLE)
      expect(castleMove).toBeDefined()
      // King should go to c1
      expect(algebraic(castleMove!.to)).toBe('c1')
    })

    it('generates castling when king is on b1 (edge case)', () => {
      // King on b1, kside rook on h1, qside rook on a1
      const fen = '8/8/8/8/8/8/8/RK5R w AH - 0 1'
      const state = loadFen(fen)!
      const moves = generateMoves(state, { piece: 'k' })
      const ksideCastle = moves.find((m) => m.flags & BITS.KSIDE_CASTLE)
      const qsideCastle = moves.find((m) => m.flags & BITS.QSIDE_CASTLE)
      expect(ksideCastle).toBeDefined()
      expect(algebraic(ksideCastle!.to)).toBe('g1')
      expect(qsideCastle).toBeDefined()
      expect(algebraic(qsideCastle!.to)).toBe('c1')
    })

    it('generates castling when king is on g1 (kside edge)', () => {
      // King on g1, kside rook on h1 — king stays on g1, rook goes to f1
      const fen = '8/8/8/8/8/8/8/R5KR w AH - 0 1'
      const state = loadFen(fen)!
      const moves = generateMoves(state, { piece: 'k' })
      const ksideCastle = moves.find((m) => m.flags & BITS.KSIDE_CASTLE)
      expect(ksideCastle).toBeDefined()
      expect(algebraic(ksideCastle!.to)).toBe('g1')
    })

    it('does not generate castling through attacked squares', () => {
      // King on d1, rook on h1, enemy rook attacking e1
      const fen = '4r3/8/8/8/8/8/8/3K3R w H - 0 1'
      const state = loadFen(fen)!
      const moves = generateMoves(state, { piece: 'k' })
      const castleMove = moves.find((m) => m.flags & BITS.KSIDE_CASTLE)
      expect(castleMove).toBeUndefined()
    })

    it('does not generate castling through occupied squares', () => {
      // King on d1, rook on h1, piece on f1
      const fen = '8/8/8/8/8/8/8/3K1B1R w H - 0 1'
      const state = loadFen(fen)!
      const moves = generateMoves(state, { piece: 'k' })
      const castleMove = moves.find((m) => m.flags & BITS.KSIDE_CASTLE)
      expect(castleMove).toBeUndefined()
    })

    it('does not generate castling when in check', () => {
      // King on e1 in check from rook on e8, own rook on h1
      const fen = '4r3/8/8/8/8/8/8/4K2R w K - 0 1'
      const state = loadFen(fen)!
      const moves = generateMoves(state, { piece: 'k' })
      const castleMove = moves.find((m) => m.flags & BITS.KSIDE_CASTLE)
      expect(castleMove).toBeUndefined()
    })
  })

  describe('Chess960 make/unmake castling', () => {
    it('make/unmake kside castling with non-standard king position', () => {
      const fen = '8/8/8/8/8/8/8/3K1R2 w F - 0 1'
      const chess = new Chess(fen)
      const originalFen = chess.fen()

      // Make the castling move via SAN
      chess.move('O-O')
      const afterCastle = chess.fen()
      // King should be on g1, rook on f1
      expect(afterCastle).toContain('5RK1')
      // Castling rights gone
      expect(afterCastle).toContain(' - ')

      // Undo should restore original position
      chess.undo()
      expect(chess.fen()).toBe(originalFen)
    })

    it('make/unmake qside castling with non-standard king position', () => {
      const fen = '8/8/8/8/8/8/8/R4K2 w A - 0 1'
      const chess = new Chess(fen)
      const originalFen = chess.fen()

      chess.move('O-O-O')
      const afterCastle = chess.fen()
      // King should be on c1, rook on d1
      expect(afterCastle).toContain('2KR4')

      chess.undo()
      expect(chess.fen()).toBe(originalFen)
    })

    it('handles king staying on same square during castling', () => {
      // King on g1, rook on h1 — king stays, rook goes to f1
      const fen = '8/8/8/8/8/8/8/R5KR w AH - 0 1'
      const chess = new Chess(fen)
      const originalFen = chess.fen()

      chess.move('O-O')
      const afterCastle = chess.fen()
      // Rook on a1 stays, rook moves h1->f1, king stays on g1
      expect(afterCastle).toContain('R4RK1')

      chess.undo()
      expect(chess.fen()).toBe(originalFen)
    })
  })

  describe('King-captures-rook input via validateMove', () => {
    it('accepts king-captures-rook as kside castling', () => {
      // Standard position after 1.e4 e5 2.Nf3 Nf6 3.Bc4 Bc5
      // King on e1, rook on h1, castling available
      const fen =
        'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'
      const state = loadFen(fen)!
      // Send king captures rook: e1 -> h1
      const move = validateMove(state, { from: 'e1', to: 'h1' })
      expect(move).not.toBeNull()
      expect(move!.flags & BITS.KSIDE_CASTLE).toBeTruthy()
    })

    it('accepts king-captures-rook as qside castling', () => {
      const fen =
        'r3kbnr/pppqpppp/2n5/3p1b2/3P1B2/2N5/PPPQPPPP/R3KBNR w KQkq - 6 5'
      const state = loadFen(fen)!
      const move = validateMove(state, { from: 'e1', to: 'a1' })
      expect(move).not.toBeNull()
      expect(move!.flags & BITS.QSIDE_CASTLE).toBeTruthy()
    })

    it('does not accept king-captures-rook when castling is not available', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'
      const state = loadFen(fen)!
      const move = validateMove(state, { from: 'e1', to: 'h1' })
      expect(move).toBeNull()
    })
  })

  describe('SAN O-O/O-O-O for non-standard king positions', () => {
    it('outputs O-O for kside castling regardless of king position', () => {
      const fen = '8/8/8/8/8/8/8/3K1R2 w F - 0 1'
      const chess = new Chess(fen)
      const result = chess.move('O-O')
      expect(result).not.toBeNull()
      expect(result!.san).toBe('O-O')
    })

    it('outputs O-O-O for qside castling regardless of king position', () => {
      const fen = '8/8/8/8/8/8/8/R4K2 w A - 0 1'
      const chess = new Chess(fen)
      const result = chess.move('O-O-O')
      expect(result).not.toBeNull()
      expect(result!.san).toBe('O-O-O')
    })
  })

  describe('Chess960 perft', () => {
    it('standard starting position perft(3) is unchanged', () => {
      const chess = new Chess()
      expect(chess.perft(3)).toBe(8902)
    })

    // Chess960 starting position #518 = standard chess
    // A few well-known Chess960 perft positions:
    it('Chess960 position BBQNNRKR perft', () => {
      // SP 0: BBQNNRKR — 16 pawn + 4 knight moves = 20
      const fen = 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1'
      const state = loadFen(fen)!
      expect(state).not.toBeNull()
      expect(perft(state, 1)).toBe(20)
    })

    it('Chess960 position with castling available perft(2)', () => {
      // King on f1, rook on a1 and h1
      const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R4K1R w Aha - 0 1'
      const state = loadFen(fen)!
      // Just verify it doesn't crash and returns a reasonable number
      const nodes = perft(state, 2)
      expect(nodes).toBeGreaterThan(0)
    })
  })

  describe('generateChess960Fen', () => {
    it('SP 518 produces standard chess starting position', () => {
      expect(generateChess960Fen(518)).toBe(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      )
    })

    it('SP 0 produces BBQNNRKR', () => {
      const fen = generateChess960Fen(0)
      expect(fen).toMatch(/^bbqnnrkr\//)
      expect(fen).toMatch(/\/BBQNNRKR /)
    })

    it('SP 959 produces RKRNNQBB', () => {
      const fen = generateChess960Fen(959)
      expect(fen).toMatch(/^rkrnnqbb\//)
      expect(fen).toMatch(/\/RKRNNQBB /)
    })

    it('all 960 positions are unique and valid', () => {
      const fens = new Set<string>()
      for (let i = 0; i < 960; i++) {
        const fen = generateChess960Fen(i)
        fens.add(fen)
        // Each should be loadable
        const state = loadFen(fen)
        expect(state).not.toBeNull()
      }
      expect(fens.size).toBe(960)
    })

    it('all 960 positions have bishops on opposite colors', () => {
      for (let i = 0; i < 960; i++) {
        const fen = generateChess960Fen(i)
        const rank = fen.split('/')[7].split(' ')[0]
        const bishops: number[] = []
        let file = 0
        for (const ch of rank) {
          if (ch >= '1' && ch <= '8') {
            file += parseInt(ch)
          } else {
            if (ch === 'B') bishops.push(file)
            file++
          }
        }
        expect(bishops.length).toBe(2)
        // One on even, one on odd file
        expect((bishops[0] + bishops[1]) % 2).toBe(1)
      }
    })

    it('all 960 positions have king between rooks', () => {
      for (let i = 0; i < 960; i++) {
        const fen = generateChess960Fen(i)
        const rank = fen.split('/')[7].split(' ')[0]
        const positions: Record<string, number[]> = { R: [], K: [] }
        let file = 0
        for (const ch of rank) {
          if (ch >= '1' && ch <= '8') {
            file += parseInt(ch)
          } else {
            if (ch === 'R' || ch === 'K') positions[ch].push(file)
            file++
          }
        }
        expect(positions.R.length).toBe(2)
        expect(positions.K.length).toBe(1)
        expect(positions.K[0]).toBeGreaterThan(positions.R[0])
        expect(positions.K[0]).toBeLessThan(positions.R[1])
      }
    })

    it('throws for invalid SP index', () => {
      expect(() => generateChess960Fen(-1)).toThrow()
      expect(() => generateChess960Fen(960)).toThrow()
      expect(() => generateChess960Fen(1.5)).toThrow()
    })
  })

  describe('Chess960 mode on Chess class', () => {
    it('constructor accepts chess960 option', () => {
      const chess = new Chess({ chess960: true })
      expect(chess.chess960).toBe(true)
    })

    it('constructor accepts fen + chess960 option', () => {
      const fen = generateChess960Fen(0)
      const chess = new Chess(fen, { chess960: true })
      expect(chess.chess960).toBe(true)
      expect(chess.fen()).toBe(fen)
    })

    it('defaults to chess960 = false', () => {
      const chess = new Chess()
      expect(chess.chess960).toBe(false)
    })

    it('sets Variant header when chess960 is true', () => {
      const chess = new Chess(generateChess960Fen(0), { chess960: true })
      expect(chess.header.Variant).toBe('Chess960')
    })

    it('does not set Variant header when chess960 is false', () => {
      const chess = new Chess()
      expect(chess.header.Variant).toBeUndefined()
    })

    it('loadPgn sets chess960 flag from Variant header', () => {
      const chess = new Chess()
      chess.loadPgn(
        '[Variant "Chess960"]\n[FEN "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KFkf - 0 1"]\n[SetUp "1"]\n\n*',
      )
      expect(chess.chess960).toBe(true)
    })

    it('loadPgn sets chess960 flag from Fischerandom variant', () => {
      const chess = new Chess()
      chess.loadPgn(
        '[Variant "Fischerandom"]\n[FEN "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KFkf - 0 1"]\n[SetUp "1"]\n\n*',
      )
      expect(chess.chess960).toBe(true)
    })

    it('Variant header survives PGN round-trip', () => {
      const chess = new Chess(generateChess960Fen(0), { chess960: true })
      const pgn = chess.pgn()
      expect(pgn).toContain('[Variant "Chess960"]')
    })

    it('replays an existing move via object notation using UCI comparison', () => {
      const chess = new Chess(generateChess960Fen(518), { chess960: true })
      chess.move('e4')
      chess.undo()
      // Replay the same move using object notation
      const result = chess.move({ from: 'e2', to: 'e4' })
      expect(result).not.toBeNull()
      expect(result!.san).toBe('e4')
    })

    it('replays castling via king-captures-rook object notation', () => {
      // SP 518 = standard position; play to a position where O-O is legal
      const chess = new Chess(generateChess960Fen(518), { chess960: true })
      chess.move('e4')
      chess.move('e5')
      chess.move('Nf3')
      chess.move('Nc6')
      chess.move('Bc4')
      chess.move('Bc5')
      chess.move('O-O') // castling creates a child node
      chess.undo()
      // Replay via king-captures-rook notation {from:'e1', to:'h1'}
      const result = chess.move({ from: 'e1', to: 'h1' })
      expect(result).not.toBeNull()
      expect(result!.san).toBe('O-O')
    })
  })

  describe('moveToUci with Chess960 castling', () => {
    it('outputs king-captures-rook for kside castling', () => {
      // Standard position with castling: king on e1, rook on h1
      const fen =
        'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'
      const state = loadFen(fen)!
      const moves = generateMoves(state, { piece: 'k' })
      const castleMove = moves.find((m) => m.flags & BITS.KSIDE_CASTLE)
      expect(castleMove).toBeDefined()
      // With state: should output e1h1 (king captures rook)
      const uci = moveToUci(
        { from: algebraic(castleMove!.from)!, to: algebraic(castleMove!.to)! },
        state,
      )
      expect(uci).toBe('e1h1')
    })

    it('outputs king-captures-rook for qside castling', () => {
      const fen =
        'r3kbnr/pppqpppp/2n5/3p1b2/3P1B2/2N5/PPPQPPPP/R3KBNR w KQkq - 6 5'
      const state = loadFen(fen)!
      const moves = generateMoves(state, { piece: 'k' })
      const castleMove = moves.find((m) => m.flags & BITS.QSIDE_CASTLE)
      expect(castleMove).toBeDefined()
      const uci = moveToUci(
        { from: algebraic(castleMove!.from)!, to: algebraic(castleMove!.to)! },
        state,
      )
      expect(uci).toBe('e1a1')
    })

    it('outputs standard e1g1 when no state is provided', () => {
      const uci = moveToUci({ from: 'e1', to: 'g1' })
      expect(uci).toBe('e1g1')
    })

    it('outputs non-standard rook square for Chess960', () => {
      // King on d1, rook on f1 (kside)
      const fen = '8/8/8/8/8/8/8/3K1R2 w F - 0 1'
      const state = loadFen(fen)!
      const moves = generateMoves(state, { piece: 'k' })
      const castleMove = moves.find((m) => m.flags & BITS.KSIDE_CASTLE)
      expect(castleMove).toBeDefined()
      const uci = moveToUci(
        { from: algebraic(castleMove!.from)!, to: algebraic(castleMove!.to)! },
        state,
      )
      // King on d1 castles kside: king goes to g1, but UCI output is d1f1 (king captures rook)
      expect(uci).toBe('d1f1')
    })

    it('uses numeric flags for reliable castling detection', () => {
      const fen = '8/8/8/8/8/8/8/5K1R w H - 0 1'
      const state = loadFen(fen)!
      const moves = generateMoves(state, { piece: 'k' })
      const castleMove = moves.find((m) => m.flags & BITS.KSIDE_CASTLE)!
      const regularMove = moves.find(
        (m) => algebraic(m.to) === 'g1' && !(m.flags & BITS.KSIDE_CASTLE),
      )!
      // With numeric flags: castling encodes as king-captures-rook
      expect(
        moveToUci(
          {
            from: algebraic(castleMove.from)!,
            to: algebraic(castleMove.to)!,
            flags: castleMove.flags,
          } as any,
          state,
        ),
      ).toBe('f1h1')
      // With numeric flags: regular move stays as-is
      expect(
        moveToUci(
          {
            from: algebraic(regularMove.from)!,
            to: algebraic(regularMove.to)!,
            flags: regularMove.flags,
          } as any,
          state,
        ),
      ).toBe('f1g1')
    })

    it('does not affect normal king moves', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const state = loadFen(fen)!
      // Normal non-castling move
      const uci = moveToUci({ from: 'e2', to: 'e4' }, state)
      expect(uci).toBe('e2e4')
    })
  })
})
