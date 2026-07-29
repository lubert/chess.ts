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
  isChess960Fen,
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
      // King on d1/d8, rooks on a1/a8 (qside) and f1/f8 (kside)
      const fen = 'r2k1r2/pppppppp/8/8/8/8/PPPPPPPP/R2K1R2 w AFaf - 0 1'
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
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1RB1KBNR w KBkq - 0 1'
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

  describe('KQkq refers to the outermost rook, not h1/a1', () => {
    // X-FEN reuses KQkq for Chess960, where the flag names whichever rook sits
    // furthest out on that side. Reading it as literally h1/a1 loses castling
    // whenever the rooks are elsewhere.
    it('resolves K/Q to the outermost rooks when they are off h1/a1', () => {
      const state = loadFen('4k3/8/8/8/8/8/8/1R1K2R1 w KQ - 0 1')!
      expect(algebraic(state.castlingRooks.w.k)).toBe('g1')
      expect(algebraic(state.castlingRooks.w.q)).toBe('b1')
    })

    it('still resolves to h1/a1 in standard chess', () => {
      const state = loadFen('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1')!
      expect(algebraic(state.castlingRooks.w.k)).toBe('h1')
      expect(algebraic(state.castlingRooks.w.q)).toBe('a1')
    })

    it('generates both castles for a KQ position with rooks off h1/a1', () => {
      const chess = new Chess('4k3/8/8/8/8/8/8/1R1K2R1 w KQ - 0 1', {
        chess960: true,
      })
      const sans = chess
        .moves()
        .filter((m) => /[kq]/.test(m.flags))
        .map((m) => m.san)
        .sort()
      expect(sans).toEqual(['O-O', 'O-O-O'])
    })

    it('drops a flag with no rook behind it', () => {
      // Invalid FEN, and engines disagree on the consequence: Stockfish
      // crashes or hangs, lc0 silently keeps analysing the previous position.
      // python-chess and cozy-chess both refuse it too.
      expect(
        getFen(loadFen('4k3/8/8/8/8/8/8/4K3 w KQkq - 0 1')!).split(' ')[2],
      ).toBe('-')
      expect(
        getFen(loadFen('4k3/8/8/8/8/8/8/4K2R w KQ - 0 1')!).split(' ')[2],
      ).toBe('K')
      // File letter naming a square that holds something other than a rook.
      expect(
        getFen(loadFen('4k3/8/8/8/8/8/8/1N2K2R w BK - 0 1')!).split(' ')[2],
      ).toBe('K')
    })

    it('drops rights when the king is off its back rank', () => {
      expect(
        getFen(loadFen('4k3/8/8/8/8/8/4K3/R6R w KQ - 0 1')!).split(' ')[2],
      ).toBe('-')
    })

    it('lowercase flags resolve against the black king', () => {
      const state = loadFen('1r1k2r1/8/8/8/8/8/8/4K3 b kq - 0 1')!
      expect(algebraic(state.castlingRooks.b.k)).toBe('g8')
      expect(algebraic(state.castlingRooks.b.q)).toBe('b8')
    })
  })

  describe('editing the board revokes rights it leaves unbacked', () => {
    // A right names one rook, so editing that rook away used to leave a castle
    // that moved no rook and a FEN flag with nothing behind it.
    it('drops the right when its rook is removed', () => {
      const chess = new Chess('4k3/8/8/8/8/8/8/4K2R w K - 0 1')
      expect(chess.moves().some((m) => m.san === 'O-O')).toBe(true)
      chess.removePiece('h1')
      expect(chess.fen().split(' ')[2]).toBe('-')
      expect(chess.moves().some((m) => m.san === 'O-O')).toBe(false)
    })

    it('drops the right when its rook is overwritten', () => {
      const chess = new Chess('4k3/8/8/8/8/8/8/4K2R w K - 0 1')
      chess.putPiece({ type: 'b', color: 'w' }, 'h1')
      expect(chess.fen().split(' ')[2]).toBe('-')
    })

    it('keeps the right when the same rook is re-placed', () => {
      const chess = new Chess('4k3/8/8/8/8/8/8/4K2R w K - 0 1')
      chess.putPiece({ type: 'r', color: 'w' }, 'h1')
      expect(chess.fen().split(' ')[2]).toBe('K')
    })

    it('drops both rights when the king is removed', () => {
      const chess = new Chess('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1')
      chess.removePiece('e1')
      expect(chess.fen().split(' ')[2]).toBe('-')
    })

    it('leaves the other colour alone', () => {
      const chess = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
      chess.removePiece('h1')
      expect(chess.fen().split(' ')[2]).toBe('Qkq')
    })

    it('drops a Chess960 right when its rook is removed', () => {
      // King f1, rooks d1 and h1: removing d1 costs only the queenside right.
      const chess = new Chess('4k3/8/8/8/8/8/8/3R1K1R w KQ - 0 1', {
        chess960: true,
      })
      expect(chess.fen().split(' ')[2]).toBe('KD')
      chess.removePiece('d1')
      expect(chess.fen().split(' ')[2]).toBe('K')
    })
  })

  describe('{from,to} is ambiguous when the king starts beside g1/c1', () => {
    // Black king f8, rooks d8 and h8: Kg8 and O-O share (f8,g8) but reach
    // different positions, since only the castle also moves the rook.
    const FEN =
      'bbqrnk1r/1ppp2pp/5n2/pP2pp2/P2PP3/8/2P2PPP/BBQRNKNR b KDkd e3 0 5'

    it('generates both moves with the same from/to', () => {
      const state = loadFen(FEN)!
      const kingMoves = generateMoves(state).filter(
        (m) => algebraic(m.from) === 'f8' && algebraic(m.to) === 'g8',
      )
      expect(kingMoves).toHaveLength(2)
      expect(kingMoves.filter((m) => m.flags & BITS.KSIDE_CASTLE)).toHaveLength(
        1,
      )
    })

    it('reads a bare {from,to} as the ordinary king move', () => {
      const chess = new Chess(FEN, { chess960: true })
      expect(chess.move({ from: 'f8', to: 'g8' })!.san).toBe('Kg8')
      // Rook stays on h8.
      expect(chess.fen().split(' ')[0]).toBe(
        'bbqrn1kr/1ppp2pp/5n2/pP2pp2/P2PP3/8/2P2PPP/BBQRNKNR',
      )
    })

    it('castles via king-captures-rook', () => {
      const chess = new Chess(FEN, { chess960: true })
      expect(chess.move({ from: 'f8', to: 'h8' })!.san).toBe('O-O')
      expect(chess.fen().split(' ')[0]).toBe(
        'bbqrnrk1/1ppp2pp/5n2/pP2pp2/P2PP3/8/2P2PPP/BBQRNKNR',
      )
    })

    it('still accepts e1->g1 as castling in standard chess', () => {
      const chess = new Chess('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1')
      expect(chess.move({ from: 'e1', to: 'g1' })!.san).toBe('O-O')
    })

    it('round-trips a move object straight from moves()', () => {
      // Enumerate-then-play is the natural usage, and the castle and the king
      // move are only told apart by flags.
      const chess = new Chess(FEN, { chess960: true })
      for (const m of chess.moves()) {
        const probe = new Chess(FEN, { chess960: true })
        expect(probe.move(m)!.san).toBe(m.san)
      }
    })

    it('does not let a castle and an ordinary king move share a node', () => {
      const chess = new Chess(FEN, { chess960: true })
      chess.move({ from: 'f8', to: 'h8' }) // O-O
      chess.undo()
      // Same from/to as the castle's king travel, but a different move: it must
      // create its own node rather than navigate into the castle.
      expect(chess.move({ from: 'f8', to: 'g8' })!.san).toBe('Kg8')
    })
  })

  describe('load() declares the variant', () => {
    it('sets the Variant header when told the position is 960', () => {
      const chess = new Chess()
      chess.load(generateChess960Fen(0), { chess960: true })
      expect(chess.chess960).toBe(true)
      expect(chess.header['Variant']).toBe('Chess960')
    })

    it('reset() clears a previous 960 game', () => {
      const chess = new Chess(generateChess960Fen(0), { chess960: true })
      chess.reset()
      expect(chess.chess960).toBe(false)
      expect(chess.header['Variant']).toBeUndefined()
    })

    it('still honours the constructor option', () => {
      const chess = new Chess(generateChess960Fen(0), { chess960: true })
      expect(chess.chess960).toBe(true)
    })

    it('loadPgn clears the flag for a game with no Variant tag', () => {
      const chess = new Chess(generateChess960Fen(0), { chess960: true })
      chess.loadPgn('[Event "Standard"]\n\n1. e4 *')
      expect(chess.chess960).toBe(false)
    })

    it('loadPgn still sets the flag from a Variant tag', () => {
      const chess = new Chess()
      chess.loadPgn(
        '[Variant "Chess960"]\n[SetUp "1"]\n[FEN "' +
          generateChess960Fen(0) +
          '"]\n\n*',
      )
      expect(chess.chess960).toBe(true)
    })
  })

  describe('deriving the variant from the position', () => {
    it('is false for the classic start', () => {
      expect(isChess960Fen(new Chess().fen())).toBe(false)
    })

    it('is true when the king is off its classic square', () => {
      expect(isChess960Fen('4k3/8/8/8/8/8/8/3R1KR1 w GD - 0 1')).toBe(true)
    })

    it('is true when a rook is off its classic square', () => {
      expect(isChess960Fen('4k3/8/8/8/8/8/8/R3K1RR w G - 0 1')).toBe(true)
    })

    it('is false once the rights are spent', () => {
      expect(isChess960Fen('4k3/8/8/8/8/8/8/3R1KR1 w - - 0 1')).toBe(false)
    })

    it('is false for an unparseable FEN', () => {
      expect(isChess960Fen('not a fen')).toBe(false)
    })

    // The classic-geometry SPs are indistinguishable from classic chess, and
    // the rules coincide there, so reading them as classic is correct.
    it('reports classic-geometry positions as classic', () => {
      expect(isChess960Fen(generateChess960Fen(518))).toBe(false)
    })

    it('covers exactly the 18 classic-geometry positions', () => {
      const classic: number[] = []
      for (let sp = 0; sp < 960; sp++) {
        if (!isChess960Fen(generateChess960Fen(sp))) classic.push(sp)
      }
      expect(classic).toEqual([
        414, 430, 446, 454, 460, 461, 502, 508, 509, 518, 524, 525, 532, 533,
        548, 549, 692, 693,
      ])
    })

    // SP 517 is RNBBQKNR: rooks on a1/h1 but the king on f1, so a plain KQkq
    // token is still X-FEN. Real-world 960 databases arrive in this shape.
    it('catches a position whose castling token is plain KQkq', () => {
      expect(generateChess960Fen(517).split(' ')[2]).toBe('KQkq')
      expect(isChess960Fen(generateChess960Fen(517))).toBe(true)
    })

    it('is false for a shuffled back rank with classic castling geometry', () => {
      expect(
        isChess960Fen(
          'rqbnkbnr/pppppppp/8/8/8/8/PPPPPPPP/RQBNKBNR w KQkq - 0 1',
        ),
      ).toBe(false)
    })

    it('is false for rights with no backing rook', () => {
      expect(isChess960Fen('4k3/8/8/8/8/8/8/4K3 w KQkq - 0 1')).toBe(false)
    })

    it('is false when the king is missing', () => {
      expect(isChess960Fen('4k3/8/8/8/8/8/8/R6R w KQ - 0 1')).toBe(false)
    })

    it('a loaded position declares itself without the option', () => {
      const chess = new Chess(generateChess960Fen(0))
      expect(chess.chess960).toBe(true)
      expect(chess.header.Variant).toBe('Chess960')
    })

    it('an explicit option still wins', () => {
      const chess = new Chess(generateChess960Fen(0), { chess960: false })
      expect(chess.chess960).toBe(false)
    })

    it('reset() clears the derived flag', () => {
      const chess = new Chess(generateChess960Fen(0))
      expect(chess.chess960).toBe(true)
      chess.reset()
      expect(chess.chess960).toBe(false)
      expect(chess.header.Variant).toBeUndefined()
    })

    it('castles correctly without being told the variant', () => {
      const chess = new Chess('4k3/8/8/8/8/8/8/R2K3R w KQ - 0 1')
      expect(chess.move({ from: 'd1', to: 'h1' })?.san).toBe('O-O')
    })

    it('loadPgn derives from a FEN tag with no Variant tag', () => {
      const chess = new Chess()
      chess.loadPgn('[SetUp "1"]\n[FEN "' + generateChess960Fen(0) + '"]\n\n*')
      expect(chess.chess960).toBe(true)
    })
  })
})
