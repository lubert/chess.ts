import { readFileSync } from 'fs'
import { join } from 'path'

import { Chess } from '../src/chess'
import {
  SQUARES,
  PAWN,
  BISHOP,
  KNIGHT,
  ROOK,
  QUEEN,
  KING,
  WHITE,
  BLACK,
} from '../src/constants'
import { algebraic } from '../src/utils'
import { PieceSymbol, Move, PartialMove } from '../src/interfaces/types'
import { Square } from '../dist/interfaces/types'

const SQUARES_LIST: string[] = []
for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
  if (i & 0x88) {
    i += 7
    continue
  }
  SQUARES_LIST.push(algebraic(i) as string)
}

function readPgn(filename: string): string {
  return readFileSync(join(__dirname, 'fixtures/pgn', filename))
    .toString()
    .trim()
}

describe('gameTree', () => {
  it('returns the expected tree', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.setComment('tactical')
    chess.undo()
    chess.move('d4')
    chess.setComment('positional')
    const expected = {
      model: {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      },
      children: [
        {
          model: {
            fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
            comment: 'tactical',
            move: {
              to: 'e4',
              from: 'e2',
              color: 'w',
              flags: 'b',
              piece: 'p',
              san: 'e4',
            },
          },
          children: [],
        },
        {
          model: {
            fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
            comment: 'positional',
            move: {
              to: 'd4',
              from: 'd2',
              color: 'w',
              flags: 'b',
              piece: 'p',
              san: 'd4',
            },
          },
          children: [],
        },
      ],
    }
    expect(chess.tree.toObject()).toEqual(expected)
  })
})

describe('.perft', () => {
  const examples = [
    {
      fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
      depth: 3,
      nodes: 97862,
    },
    {
      fen: '8/PPP4k/8/8/8/8/4Kppp/8 w - - 0 1',
      depth: 4,
      nodes: 89363,
    },
    {
      fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
      depth: 4,
      nodes: 43238,
    },
    {
      fen: 'rnbqkbnr/p3pppp/2p5/1pPp4/3P4/8/PP2PPPP/RNBQKBNR w KQkq b6 0 4',
      depth: 3,
      nodes: 23509,
    },
  ]

  examples.forEach(({ fen, depth, nodes }) => {
    it(fen, () => {
      const chess = new Chess(fen)
      expect(chess.perft(depth)).toBe(nodes)
    })
  })
})

describe('.move', () => {
  describe('dry-run', () => {
    it('does not update the state', () => {
      const chess = new Chess()
      const fen = chess.fen()
      chess.move('e4', { dry_run: true })
      expect(chess.fen()).toEqual(fen)
    })
  })
})

describe('.moves', () => {
  describe('san', () => {
    const examples = [
      {
        name: 'initial position',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        square: 'e2',
        moves: ['e3', 'e4'],
      },
      {
        name: 'invalid square',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        square: 'e9',
        moves: [],
      },
      {
        name: 'pinned piece',
        fen: 'rnbqk1nr/pppp1ppp/4p3/8/1b1P4/2N5/PPP1PPPP/R1BQKBNR w KQkq - 2 3',
        square: 'c3',
        moves: [],
      },
      {
        name: 'promotion',
        fen: '8/k7/8/8/8/8/7p/K7 b - - 0 1',
        square: 'h2',
        moves: ['h1=Q+', 'h1=R+', 'h1=B', 'h1=N'],
      },
      {
        name: 'castling',
        fen: 'r1bq1rk1/1pp2ppp/p1np1n2/2b1p3/2B1P3/2NP1N2/PPPBQPPP/R3K2R w KQ - 0 8',
        square: 'e1',
        moves: ['Kf1', 'Kd1', 'O-O', 'O-O-O'],
      },
      {
        name: 'no castling',
        fen: 'r1bq1rk1/1pp2ppp/p1np1n2/2b1p3/2B1P3/2NP1N2/PPPBQPPP/R3K2R w - - 0 8',
        square: 'e1',
        moves: ['Kf1', 'Kd1'],
      },
      {
        name: 'trapped king',
        fen: '8/7K/8/8/1R6/k7/1R1p4/8 b - - 0 1',
        square: 'a3',
        moves: [],
      },
    ]

    examples.forEach(({ name, fen, square, moves }) => {
      it(name, () => {
        const chess = new Chess(fen)
        expect(chess.sanMoves({ from: square as Square })).toEqual(moves)
      })
    })
  })

  describe('verbose', () => {
    const positions = [
      {
        name: 'verbose',
        fen: '8/7K/8/8/1R6/k7/1R1p4/8 b - - 0 1',
        square: 'd2',
        moves: [
          {
            color: 'b',
            from: 'd2',
            to: 'd1',
            flags: 'np',
            piece: 'p',
            promotion: 'q',
            san: 'd1=Q',
          },
          {
            color: 'b',
            from: 'd2',
            to: 'd1',
            flags: 'np',
            piece: 'p',
            promotion: 'r',
            san: 'd1=R',
          },
          {
            color: 'b',
            from: 'd2',
            to: 'd1',
            flags: 'np',
            piece: 'p',
            promotion: 'b',
            san: 'd1=B',
          },
          {
            color: 'b',
            from: 'd2',
            to: 'd1',
            flags: 'np',
            piece: 'p',
            promotion: 'n',
            san: 'd1=N',
          },
        ],
      },
      {
        name: 'no castling moves',
        fen: 'rnbqk2r/ppp1pp1p/5n1b/3p2pQ/1P2P3/B1N5/P1PP1PPP/R3KBNR b KQkq - 3 5',
        square: 'f1',
        moves: [],
      },
    ]

    positions.forEach(({ name, fen, square, moves }) => {
      it(name, () => {
        const chess = new Chess(fen)
        expect(moves).toEqual(chess.moves({ from: square as Square }))
      })
    })
  })

  describe('algebraic notation', () => {
    const examples = [
      {
        fen: '7k/3R4/3p2Q1/6Q1/2N1N3/8/8/3R3K w - - 0 1',
        moves: [
          'Rd8#',
          'Re7',
          'Rf7',
          'Rg7',
          'Rh7#',
          'R7xd6',
          'Rc7',
          'Rb7',
          'Ra7',
          'Qf7',
          'Qe8#',
          'Qg7#',
          'Qg8#',
          'Qh7#',
          'Q6h6#',
          'Q6h5#',
          'Q6f5',
          'Q6f6#',
          'Qe6',
          'Qxd6',
          'Q5f6#',
          'Qe7',
          'Qd8#',
          'Q5h6#',
          'Q5h5#',
          'Qh4#',
          'Qg4',
          'Qg3',
          'Qg2',
          'Qg1',
          'Qf4',
          'Qe3',
          'Qd2',
          'Qc1',
          'Q5f5',
          'Qe5+',
          'Qd5',
          'Qc5',
          'Qb5',
          'Qa5',
          'Na5',
          'Nb6',
          'Ncxd6',
          'Ne5',
          'Ne3',
          'Ncd2',
          'Nb2',
          'Na3',
          'Nc5',
          'Nexd6',
          'Nf6',
          'Ng3',
          'Nf2',
          'Ned2',
          'Nc3',
          'Rd2',
          'Rd3',
          'Rd4',
          'Rd5',
          'R1xd6',
          'Re1',
          'Rf1',
          'Rg1',
          'Rc1',
          'Rb1',
          'Ra1',
          'Kg2',
          'Kh2',
          'Kg1',
        ],
      },
      {
        fen: '1r3k2/P1P5/8/8/8/8/8/R3K2R w KQ - 0 1',
        moves: [
          'a8=Q',
          'a8=R',
          'a8=B',
          'a8=N',
          'axb8=Q+',
          'axb8=R+',
          'axb8=B',
          'axb8=N',
          'c8=Q+',
          'c8=R+',
          'c8=B',
          'c8=N',
          'cxb8=Q+',
          'cxb8=R+',
          'cxb8=B',
          'cxb8=N',
          'Ra2',
          'Ra3',
          'Ra4',
          'Ra5',
          'Ra6',
          'Rb1',
          'Rc1',
          'Rd1',
          'Kd2',
          'Ke2',
          'Kf2',
          'Kf1',
          'Kd1',
          'Rh2',
          'Rh3',
          'Rh4',
          'Rh5',
          'Rh6',
          'Rh7',
          'Rh8+',
          'Rg1',
          'Rf1+',
          'O-O+',
          'O-O-O',
        ],
      },
      {
        fen: '5rk1/8/8/8/8/8/2p5/R3K2R w KQ - 0 1',
        moves: [
          'Ra2',
          'Ra3',
          'Ra4',
          'Ra5',
          'Ra6',
          'Ra7',
          'Ra8',
          'Rb1',
          'Rc1',
          'Rd1',
          'Kd2',
          'Ke2',
          'Rh2',
          'Rh3',
          'Rh4',
          'Rh5',
          'Rh6',
          'Rh7',
          'Rh8+',
          'Rg1+',
          'Rf1',
        ],
      },
      {
        fen: '5rk1/8/8/8/8/8/2p5/R3K2R b KQ - 0 1',
        moves: [
          'Rf7',
          'Rf6',
          'Rf5',
          'Rf4',
          'Rf3',
          'Rf2',
          'Rf1+',
          'Re8+',
          'Rd8',
          'Rc8',
          'Rb8',
          'Ra8',
          'Kg7',
          'Kf7',
          'c1=Q+',
          'c1=R+',
          'c1=B',
          'c1=N',
        ],
      },
      {
        fen: 'r3k2r/p2pqpb1/1n2pnp1/2pPN3/1p2P3/2N2Q1p/PPPB1PPP/R3K2R w KQkq c6 0 2',
        moves: [
          'gxh3',
          'Qxf6',
          'Qxh3',
          'Nxd7',
          'Nxf7',
          'Nxg6',
          'dxc6',
          'dxe6',
          'Rg1',
          'Rf1',
          'Ke2',
          'Kf1',
          'Kd1',
          'Rb1',
          'Rc1',
          'Rd1',
          'g3',
          'g4',
          'Be3',
          'Bf4',
          'Bg5',
          'Bh6',
          'Bc1',
          'b3',
          'a3',
          'a4',
          'Qf4',
          'Qf5',
          'Qg4',
          'Qh5',
          'Qg3',
          'Qe2',
          'Qd1',
          'Qe3',
          'Qd3',
          'Na4',
          'Nb5',
          'Ne2',
          'Nd1',
          'Nb1',
          'Nc6',
          'Ng4',
          'Nd3',
          'Nc4',
          'd6',
          'O-O',
          'O-O-O',
        ],
      },
      {
        fen: 'k7/8/K7/8/3n3n/5R2/3n4/8 b - - 0 1',
        moves: [
          'N2xf3',
          'Nhxf3',
          'Nd4xf3',
          'N2b3',
          'Nc4',
          'Ne4',
          'Nf1',
          'Nb1',
          'Nhf5',
          'Ng6',
          'Ng2',
          'Nb5',
          'Nc6',
          'Ne6',
          'Ndf5',
          'Ne2',
          'Nc2',
          'N4b3',
          'Kb8',
        ],
      },
    ]

    examples.forEach(({ fen, moves }) => {
      it(fen, () => {
        const chess = new Chess(fen)
        expect(chess.sanMoves().sort()).toEqual(moves.sort())
      })
    })
  })
})

describe('.inCheckmate', () => {
  const examples = [
    '8/5r2/4K1q1/4p3/3k4/8/8/8 w - - 0 7',
    '4r2r/p6p/1pnN2p1/kQp5/3pPq2/3P4/PPP3PP/R5K1 b - - 0 2',
    'r3k2r/ppp2p1p/2n1p1p1/8/2B2P1q/2NPb1n1/PP4PP/R2Q3K w kq - 0 8',
    '8/6R1/pp1r3p/6p1/P3R1Pk/1P4P1/7K/8 b - - 0 4',
  ]

  examples.forEach((example) => {
    it(example, () => {
      const chess = new Chess(example)
      expect(chess.inCheckmate()).toBe(true)
    })
  })
})

describe('.inStalemate', () => {
  const examples = [
    '1R6/8/8/8/8/8/7R/k6K b - - 0 1',
    '8/8/5k2/p4p1p/P4K1P/1r6/8/8 w - - 0 2',
  ]

  examples.forEach((example) => {
    it(example, () => {
      const chess = new Chess(example)
      expect(chess.inStalemate()).toBe(true)
    })
  })
})

describe('.insufficientMaterial', () => {
  const examples = [
    {
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      draw: false,
    },
    {
      fen: '8/8/8/8/8/8/8/k6K w - - 0 1',
      draw: true,
    },
    {
      fen: '8/2p5/8/8/8/8/8/k6K w - - 0 1',
      draw: false,
    },
    {
      fen: '8/2N5/8/8/8/8/8/k6K w - - 0 1',
      draw: true,
    },
    {
      fen: '8/2b5/8/8/8/8/8/k6K w - - 0 1',
      draw: true,
    },
    {
      fen: '8/b7/3B4/8/8/8/8/k6K w - - 0 1',
      draw: true,
    },
    {
      fen: '8/b7/B7/8/8/8/8/k6K w - - 0 1',
      draw: false,
    },
    {
      fen: '8/b1B1b1B1/1b1B1b1B/8/8/8/8/1k5K w - - 0 1',
      draw: true,
    },
    {
      fen: '8/bB2b1B1/1b1B1b1B/8/8/8/8/1k5K w - - 0 1',
      draw: false,
    },
  ]

  examples.forEach(({ fen, draw }) => {
    it(fen, () => {
      const chess = new Chess(fen)
      expect(chess.insufficientMaterial()).toBe(draw)
      expect(chess.inDraw()).toBe(draw)
    })
  })
})

describe('.inThreefoldRepetition', () => {
  const positions = [
    {
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves: ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'],
    },
    // Fischer - Petrosian, Buenos Aires, 1971
    {
      fen: '8/pp3p1k/2p2q1p/3r1P2/5R2/7P/P1P1QP2/7K b - - 2 30',
      moves: ['Qe5', 'Qh5', 'Qf6', 'Qe2', 'Re5', 'Qd3', 'Rd5', 'Qe2'],
    },
  ]

  positions.forEach(({ fen, moves }) => {
    it(fen, () => {
      const chess = new Chess(fen)
      moves.forEach((move) => {
        expect(chess.inThreefoldRepetition()).toBe(false)
        expect(chess.move(move)).toBeDefined()
      })
      expect(chess.inThreefoldRepetition()).toBe(true)
      expect(chess.inDraw()).toBe(true)
    })
  })
})

describe('.move', () => {
  interface MoveExample {
    name: string
    fen: string
    expect: boolean
    move: string
    next?: string
    captured?: string
  }

  const examples: MoveExample[] = [
    {
      name: 'legal first move',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      expect: true,
      move: 'e4',
      next: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    },
    {
      name: 'illegal first move',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      expect: false,
      move: 'e5',
    },
    {
      name: 'checkmate',
      fen: '7k/3R4/3p2Q1/6Q1/2N1N3/8/8/3R3K w - - 0 1',
      expect: true,
      move: 'Rd8#',
      next: '3R3k/8/3p2Q1/6Q1/2N1N3/8/8/3R3K b - - 1 1',
    },
    {
      name: 'white en passant',
      fen: 'rnbqkbnr/pp3ppp/2pp4/4pP2/4P3/8/PPPP2PP/RNBQKBNR w KQkq e6 0 1',
      expect: true,
      move: 'fxe6',
      next: 'rnbqkbnr/pp3ppp/2ppP3/8/4P3/8/PPPP2PP/RNBQKBNR b KQkq - 0 1',
      captured: 'p',
    },
    {
      name: 'black en passant',
      fen: 'rnbqkbnr/pppp2pp/8/4p3/4Pp2/2PP4/PP3PPP/RNBQKBNR b KQkq e3 0 1',
      expect: true,
      move: 'fxe3',
      next: 'rnbqkbnr/pppp2pp/8/4p3/8/2PPp3/PP3PPP/RNBQKBNR w KQkq - 0 2',
      captured: 'p',
    },

    {
      name: 'correct disambiguation',
      fen: 'r2qkbnr/ppp2ppp/2n5/1B2pQ2/4P3/8/PPP2PPP/RNB1K2R b KQkq - 3 7',
      expect: true,
      next: 'r2qkb1r/ppp1nppp/2n5/1B2pQ2/4P3/8/PPP2PPP/RNB1K2R w KQkq - 4 8',
      move: 'Ne7',
    },
    {
      name: 'over disambiguation',
      fen: 'r2qkbnr/ppp2ppp/2n5/1B2pQ2/4P3/8/PPP2PPP/RNB1K2R b KQkq - 3 7',
      expect: true,
      next: 'r2qkb1r/ppp1nppp/2n5/1B2pQ2/4P3/8/PPP2PPP/RNB1K2R w KQkq - 4 8',
      move: 'Nge7',
    },
  ]

  examples.forEach((example) => {
    const chess = new Chess(example.fen)

    it(example.name, () => {
      const move = chess.move(example.move)
      if (example.expect) {
        expect(move).not.toBeNull()
        expect(chess.fen()).toEqual(example.next)
        expect(move!.captured).toEqual(example.captured)
      } else {
        expect(move).toBeNull()
      }
    })
  })

  describe('promotion', () => {
    const fen = '8/2P2k2/8/8/8/5K2/8/8 w - - 0 1'
    const san = 'c8'
    const move: PartialMove = { from: 'c7', to: 'c8' }
    const pieces: PieceSymbol[] = ['q', 'r', 'b', 'n']

    describe(`${fen} (${move.from} ${move.to})`, () => {
      it('returns null when missing a promotion', () => {
        const chess = new Chess()
        expect(chess.move(san)).toBe(null)
        expect(chess.move(`${move.from}${move.to}`)).toBe(null)
        expect(chess.move(move)).toBe(null)
      })

      it('works when properly formatted', () => {
        pieces.forEach((piece) => {
          const chess = new Chess(fen)
          const move = chess.move(`${san}=${piece.toUpperCase()}`)
          expect(move).toBeDefined()
          expect(move!.promotion).toEqual(piece)
        })
      })

      it('works when improperly formatted', () => {
        pieces.forEach((piece) => {
          const chess = new Chess(fen)
          const move = chess.move(`${san}=${piece}`)
          expect(move).toBeDefined()
          expect(move!.promotion).toEqual(piece)
        })
      })
    })
  })
})

describe('.isPromotion', () => {
  const examples = [
    {
      name: 'non-promotion',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      san: 'e4',
      move: { from: 'e2', to: 'e4' },
      promotion: false,
    },
    {
      name: 'illegal move',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      san: 'e8',
      move: { from: 'e2', to: 'e8' },
      promotion: false,
    },
    {
      name: 'no piece on from',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      san: 'e4',
      move: { from: 'e3', to: 'e4' },
      promotion: false,
    },
    {
      name: 'illegal promotion due to discovery',
      fen: '1K6/2P2k2/8/8/5b2/8/8/8 w - - 0 1',
      san: 'c8',
      move: { from: 'c7', to: 'c8' },
      promotion: false,
    },
    {
      name: 'illegal move non-capturing diagonal',
      fen: '8/2P2k2/8/8/8/5K2/8/8 w - - 0 1',
      san: 'b8',
      move: { from: 'c7', to: 'b8' },
      promotion: false,
    },
    {
      name: 'legal promotion',
      fen: '8/2P2k2/8/8/8/5K2/8/8 w - - 0 1',
      san: 'c8',
      move: { from: 'c7', to: 'c8' },
      promotion: true,
    },
    {
      name: 'legal capturing promotion',
      fen: '1b6/2P2k2/8/8/5K2/8/8/8 w - - 0 1',
      san: 'cxb8',
      move: { from: 'c7', to: 'b8' },
      promotion: true,
    },
  ]

  examples.forEach(({ name, fen, san, move, promotion }) => {
    it(name, () => {
      const chess = new Chess(fen)
      expect(chess.isPromotion(san)).toBe(promotion)
      expect(chess.isPromotion(`${move.from}${move.to}`)).toBe(promotion)
      expect(chess.isPromotion(move as PartialMove)).toBe(promotion)
    })
  })
})

describe('.getPiece, .putPiece, .removePiece', () => {
  describe('valid', () => {
    it('non-king', () => {
      const pieces = {
        a7: { type: PAWN, color: WHITE },
        b7: { type: PAWN, color: BLACK },
        c7: { type: KNIGHT, color: WHITE },
        d7: { type: KNIGHT, color: BLACK },
        e7: { type: BISHOP, color: WHITE },
        f7: { type: BISHOP, color: BLACK },
        g7: { type: ROOK, color: WHITE },
        h7: { type: ROOK, color: BLACK },
        a6: { type: QUEEN, color: WHITE },
        b6: { type: QUEEN, color: BLACK },
        a4: { type: KING, color: WHITE },
        h4: { type: KING, color: BLACK },
      }
      const chess = new Chess()
      chess.clear()

      Object.entries(pieces).forEach(([square, piece]) => {
        expect(chess.putPiece(piece, square)).toBe(true)
      })
      expect(chess.getPieces()).toEqual(pieces)
      Object.entries(pieces).forEach(([square, piece]) => {
        expect(chess.removePiece(square)).toEqual(piece)
      })
      expect(chess.getPieces()).toEqual({})
    })

    it('same square kings', () => {
      const pieces = {
        a7: { type: KING, color: BLACK },
        h2: { type: KING, color: WHITE },
      }

      const chess = new Chess()
      chess.clear()

      expect(chess.putPiece(pieces.a7, 'a7')).toBe(true)
      expect(chess.putPiece(pieces.a7, 'a7')).toBe(true)
      expect(chess.putPiece(pieces.h2, 'h2')).toBe(true)
      expect(chess.putPiece(pieces.h2, 'h2')).toBe(true)
      expect(chess.getPieces()).toEqual(pieces)
      expect(chess.removePiece('a7')).toEqual(pieces.a7)
      expect(chess.removePiece('h2')).toEqual(pieces.h2)
      expect(chess.getPieces()).toEqual({})
    })
  })

  describe('invalid', () => {
    it('bad piece', () => {
      const chess = new Chess()
      chess.clear()

      expect(
        chess.putPiece({ type: 'z' as PieceSymbol, color: BLACK }, 'a7'),
      ).toBe(false)
      expect(chess.removePiece('a7')).toBeNull()
      expect(chess.getPieces()).toEqual({})
    })

    it('bad square', () => {
      const chess = new Chess()
      chess.clear()

      expect(chess.putPiece({ type: PAWN, color: WHITE }, 'j4')).toBe(false)
      expect(chess.removePiece('j4')).toBeNull()
      expect(chess.getPieces()).toEqual({})
    })

    it('two white kings', () => {
      const pieces = {
        a7: { type: KING, color: BLACK },
        h2: { type: KING, color: WHITE },
      }
      const badPieces = {
        h1: { type: KING, color: WHITE },
      }
      const chess = new Chess()
      chess.clear()

      expect(chess.putPiece(pieces.a7, 'a7')).toBe(true)
      expect(chess.putPiece(pieces.h2, 'h2')).toBe(true)
      expect(chess.putPiece(badPieces.h1, 'h1')).toBe(false)
      expect(chess.getPieces()).toEqual(pieces)
      expect(chess.removePiece('a7')).toEqual(pieces.a7)
      expect(chess.removePiece('h2')).toEqual(pieces.h2)
      expect(chess.removePiece('h1')).toBeNull()
      expect(chess.getPieces()).toEqual({})
    })

    it('two black kings', () => {
      const pieces = {
        a7: { type: KING, color: BLACK },
        h2: { type: KING, color: WHITE },
      }
      const badPieces = {
        a8: { type: KING, color: BLACK },
      }
      const chess = new Chess()
      chess.clear()

      expect(chess.putPiece(pieces.a7, 'a7')).toBe(true)
      expect(chess.putPiece(pieces.h2, 'h2')).toBe(true)
      expect(chess.putPiece(badPieces.a8, 'a8')).toBe(false)
      expect(chess.getPieces()).toEqual(pieces)
      expect(chess.removePiece('a7')).toEqual(pieces.a7)
      expect(chess.removePiece('h2')).toEqual(pieces.h2)
      expect(chess.removePiece('a8')).toBeNull()
      expect(chess.getPieces()).toEqual({})
    })
  })
})

describe('.fen, .load', () => {
  describe('valid', () => {
    const examples = [
      '8/8/8/8/8/8/8/8 w - - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      '1nbqkbn1/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/1NBQKBN1 b - - 1 2',
    ]

    examples.forEach((example) => {
      it(example, () => {
        const chess = new Chess(example)
        expect(chess.fen()).toEqual(example)
      })
    })
  })

  describe('invalid', () => {
    const examples = [
      // incomplete FEN string
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN w KQkq - 0 1',
      // bad digit (9)
      'rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      // bad piece (X)
      '1nbqkbn1/pppp1ppX/8/4p3/4P3/8/PPPP1PPP/1NBQKBN1 b - - 1 2',
    ]

    examples.forEach((example) => {
      it(example, () => {
        expect(() => {
          new Chess(example)
        }).toThrowError()
      })
    })
  })
})

describe('.pgn', () => {
  interface PgnExample {
    name: string
    moves: string[]
    header?: Record<string, string>
    initial?: string
    newline?: string
    width?: number
    pgn: string
    fen: string
  }

  const examples: PgnExample[] = [
    // {
    //   moves: [
    //     'd4',
    //     'd5',
    //     'Nf3',
    //     'Nc6',
    //     'e3',
    //     'e6',
    //     'Bb5',
    //     'g5',
    //     'O-O',
    //     'Qf6',
    //     'Nc3',
    //     'Bd7',
    //     'Bxc6',
    //     'Bxc6',
    //     'Re1',
    //     'O-O-O',
    //     'a4',
    //     'Bb4',
    //     'a5',
    //     'b5',
    //     'axb6',
    //     'axb6',
    //     'Ra8+',
    //     'Kd7',
    //     'Ne5+',
    //     'Kd6',
    //     'Rxd8+',
    //     'Qxd8',
    //     'Nxf7+',
    //     'Ke7',
    //     'Nxd5+',
    //     'Qxd5',
    //     'c3',
    //     'Kxf7',
    //     'Qf3+',
    //     'Qxf3',
    //     'gxf3',
    //     'Bxf3',
    //     'cxb4',
    //     'e5',
    //     'dxe5',
    //     'Ke6',
    //     'b3',
    //     'Kxe5',
    //     'Bb2+',
    //     'Ke4',
    //     'Bxh8',
    //     'Nf6',
    //     'Bxf6',
    //     'h5',
    //     'Bxg5',
    //     'Bg2',
    //     'Kxg2',
    //     'Kf5',
    //     'Bh4',
    //     'Kg4',
    //     'Bg3',
    //     'Kf5',
    //     'e4+',
    //     'Kg4',
    //     'e5',
    //     'h4',
    //     'Bxh4',
    //     'Kxh4',
    //     'e6',
    //     'c5',
    //     'bxc5',
    //     'bxc5',
    //     'e7',
    //     'c4',
    //     'bxc4',
    //     'Kg4',
    //     'e8=Q',
    //     'Kf5',
    //     'Qe5+',
    //     'Kg4',
    //     'Re4#',
    //   ],
    //   header: {
    //     White: 'Jeff Hlywa',
    //     Black: 'Steve Bragg',
    //     'GreatestGameEverPlayed?': 'True',
    //   },
    //   newline: '<br />',
    //   width: 19,
    //   pgn: '[White "Jeff Hlywa"]<br />[Black "Steve Bragg"]<br />[GreatestGameEverPlayed? "True"]<br /><br />1. d4 d5 2. Nf3 Nc6<br />3. e3 e6 4. Bb5 g5<br />5. O-O Qf6<br />6. Nc3 Bd7<br />7. Bxc6 Bxc6<br />8. Re1 O-O-O<br />9. a4 Bb4 10. a5 b5<br />11. axb6 axb6<br />12. Ra8+ Kd7<br />13. Ne5+ Kd6<br />14. Rxd8+ Qxd8<br />15. Nxf7+ Ke7<br />16. Nxd5+ Qxd5<br />17. c3 Kxf7<br />18. Qf3+ Qxf3<br />19. gxf3 Bxf3<br />20. cxb4 e5<br />21. dxe5 Ke6<br />22. b3 Kxe5<br />23. Bb2+ Ke4<br />24. Bxh8 Nf6<br />25. Bxf6 h5<br />26. Bxg5 Bg2<br />27. Kxg2 Kf5<br />28. Bh4 Kg4<br />29. Bg3 Kf5<br />30. e4+ Kg4<br />31. e5 h4<br />32. Bxh4 Kxh4<br />33. e6 c5<br />34. bxc5 bxc5<br />35. e7 c4<br />36. bxc4 Kg4<br />37. e8=Q Kf5<br />38. Qe5+ Kg4<br />39. Re4#',
    //   fen: '8/8/8/4Q3/2P1R1k1/8/5PKP/8 b - - 4 39',
    // },
    {
      name: 'regular game',
      moves: [
        'c4',
        'e6',
        'Nf3',
        'd5',
        'd4',
        'Nf6',
        'Nc3',
        'Be7',
        'Bg5',
        'O-O',
        'e3',
        'h6',
        'Bh4',
        'b6',
        'cxd5',
        'Nxd5',
        'Bxe7',
        'Qxe7',
        'Nxd5',
        'exd5',
        'Rc1',
        'Be6',
        'Qa4',
        'c5',
        'Qa3',
        'Rc8',
        'Bb5',
        'a6',
        'dxc5',
        'bxc5',
        'O-O',
        'Ra7',
        'Be2',
        'Nd7',
        'Nd4',
        'Qf8',
        'Nxe6',
        'fxe6',
        'e4',
        'd4',
        'f4',
        'Qe7',
        'e5',
        'Rb8',
        'Bc4',
        'Kh8',
        'Qh3',
        'Nf8',
        'b3',
        'a5',
        'f5',
        'exf5',
        'Rxf5',
        'Nh7',
        'Rcf1',
        'Qd8',
        'Qg3',
        'Re7',
        'h4',
        'Rbb7',
        'e6',
        'Rbc7',
        'Qe5',
        'Qe8',
        'a4',
        'Qd8',
        'R1f2',
        'Qe8',
        'R2f3',
        'Qd8',
        'Bd3',
        'Qe8',
        'Qe4',
        'Nf6',
        'Rxf6',
        'gxf6',
        'Rxf6',
        'Kg8',
        'Bc4',
        'Kh8',
        'Qf4',
      ],
      header: {
        Event: 'Reykjavik WCh',
        Site: 'Reykjavik WCh',
        Date: '1972.01.07',
        EventDate: '?',
        Round: '6',
        Result: '1-0',
        White: 'Robert James Fischer',
        Black: 'Boris Spassky',
        ECO: 'D59',
        WhiteElo: '?',
        BlackElo: '?',
        PlyCount: '81',
      },
      pgn: '[Event "Reykjavik WCh"]\n[Site "Reykjavik WCh"]\n[Date "1972.01.07"]\n[EventDate "?"]\n[Round "6"]\n[Result "1-0"]\n[White "Robert James Fischer"]\n[Black "Boris Spassky"]\n[ECO "D59"]\n[WhiteElo "?"]\n[BlackElo "?"]\n[PlyCount "81"]\n\n1. c4 e6 2. Nf3 d5 3. d4 Nf6 4. Nc3 Be7 5. Bg5 O-O 6. e3 h6 7. Bh4 b6 8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6 12. Qa4 c5 13. Qa3 Rc8 14. Bb5 a6 15. dxc5 bxc5 16. O-O Ra7 17. Be2 Nd7 18. Nd4 Qf8 19. Nxe6 fxe6 20. e4 d4 21. f4 Qe7 22. e5 Rb8 23. Bc4 Kh8 24. Qh3 Nf8 25. b3 a5 26. f5 exf5 27. Rxf5 Nh7 28. Rcf1 Qd8 29. Qg3 Re7 30. h4 Rbb7 31. e6 Rbc7 32. Qe5 Qe8 33. a4 Qd8 34. R1f2 Qe8 35. R2f3 Qd8 36. Bd3 Qe8 37. Qe4 Nf6 38. Rxf6 gxf6 39. Rxf6 Kg8 40. Bc4 Kh8 41. Qf4 1-0',
      fen: '4q2k/2r1r3/4PR1p/p1p5/P1Bp1Q1P/1P6/6P1/6K1 b - - 4 41',
    },
    {
      name: 'non-starting position',
      moves: ['Ba5', 'O-O', 'd6', 'd4'],
      pgn: '[SetUp "1"]\n[FEN "r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 1"]\n\n1...Ba5 2. O-O d6 3. d4',
      initial:
        'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 1',
      fen: 'r1bqk1nr/ppp2ppp/2np4/b3p3/2BPP3/2P2N2/P4PPP/RNBQ1RK1 b kq d3 0 3',
    },
  ]

  examples.forEach(
    ({ name, fen, moves, header, initial, newline, width, pgn }) => {
      it(name, () => {
        const chess = new Chess(initial)

        moves.forEach((move) => {
          expect(chess.move(move)).toBeDefined()
        })

        if (header) chess.header = header
        expect(chess.pgn({ newline, width })).toEqual(pgn)
        expect(chess.fen()).toEqual(fen)
      })
    },
  )
})

describe('.loadPgn', () => {
  describe.skip('tree', () => {
    it('matches', () => {
      const pgn = readPgn('tree01.pgn')
      const chess = new Chess()
      chess.loadPgn(pgn)
      const expected = {
        model: {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        },
        children: [
          {
            model: {
              fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
              move: {
                to: 'e4',
                from: 'e2',
                color: 'w',
                flags: 'b',
                piece: 'p',
                san: 'e4',
              },
            },
            children: [
              {
                model: {
                  fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
                  move: {
                    to: 'e5',
                    from: 'e7',
                    color: 'b',
                    flags: 'b',
                    piece: 'p',
                    san: 'e5',
                  },
                },
                children: [
                  {
                    model: {
                      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
                      move: {
                        to: 'f3',
                        from: 'g1',
                        color: 'w',
                        flags: 'n',
                        piece: 'n',
                        san: 'Nf3',
                      },
                    },
                    children: [
                      {
                        model: {
                          fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
                          move: {
                            to: 'c6',
                            from: 'b8',
                            color: 'b',
                            flags: 'n',
                            piece: 'n',
                            san: 'Nc6',
                          },
                        },
                        children: [
                          {
                            model: {
                              fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 3 3',
                              move: {
                                to: 'c3',
                                from: 'b1',
                                color: 'w',
                                flags: 'n',
                                piece: 'n',
                                san: 'Nc3',
                              },
                            },
                            children: [
                              {
                                model: {
                                  fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4',
                                  move: {
                                    to: 'f6',
                                    from: 'g8',
                                    color: 'b',
                                    flags: 'n',
                                    piece: 'n',
                                    san: 'Nf6',
                                  },
                                },
                                children: [],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }
      expect(chess.tree.toObject()).toEqual(expected)
    })
  })

  describe('valid', () => {
    const examples = [
      {
        name: 'No comments',
        pgn: readPgn('comments01.pgn'),
        expectedPgn: readPgn('comments01_expected.pgn'),
      },
      {
        name: 'Bracket comments',
        pgn: readPgn('comments02.pgn'),
        expectedPgn: readPgn('comments02_expected.pgn'),
      },
      {
        name: 'Comment before first move',
        pgn: readPgn('comments03.pgn'),
        expectedPgn: readPgn('comments03_expected.pgn'),
      },
      {
        name: 'No header',
        pgn: readPgn('header01.pgn'),
        expectedPgn: readPgn('header01_expected.pgn'),
      },
      {
        name: 'Extra space in header',
        pgn: readPgn('header02.pgn'),
        expectedPgn: readPgn('header02_expected.pgn'),
      },
      {
        name: 'PGN parser regression test',
        pgn: '1. d4 Nf6 2. c4 e6 3. Nf3 c5 4. Nc3 cxd4 5. Nxd4 Bb4 6. Nb5',
      },
      {
        name: 'Encoded nags',
        pgn: '1. e4 $3 e5 $6 2. d4 $4 d5 $5',
      },
      {
        name: 'Symbol nags',
        pgn: '1. e4!! e5?! 2. d4?? d5!?',
        expectedPgn: '1. e4 $3 e5 $6 2. d4 $4 d5 $5',
      },
      {
        name: 'Nag id',
        pgn: readPgn('nag01.pgn'),
        expectedPgn: readPgn('nag01_expected.pgn'),
      },
      {
        name: 'Nags with check, capture, promotion',
        pgn: '1.e4 e6 2.d4 d5 3.exd5 c6?? 4.dxe6 Nf6?! 5.exf7+!! Kd7!? 6.Nf3 Bd6 7.f8=N+!! Qxf8',
        expectedPgn:
          '1. e4 e6 2. d4 d5 3. exd5 c6 $4 4. dxe6 Nf6 $6 5. exf7+ $3 Kd7 $5 6. Nf3 Bd6 7. f8=N+ $3 Qxf8',
      },
      {
        name: 'Bracket comments and shallow variation',
        pgn: "1. e4 ( 1. d4 { Queen's pawn } d5 ( 1... Nf6 ) ) e5",
        expectedPgn: "1. e4 ( 1. d4 {Queen's pawn} d5 ( 1...Nf6 ) ) e5",
      },
      {
        name: 'Bracket comments and extended variations',
        pgn: readPgn('variations01.pgn'),
        expectedPgn: readPgn('variations01_expected.pgn'),
      },
      {
        name: 'Bracket variation',
        pgn: readPgn('variations02.pgn'),
        expectedPgn: readPgn('variations02_expected.pgn'),
      },
      {
        name: 'Incorrect disambiguation (Nge7)',
        pgn: readPgn('disambiguation01.pgn'),
        expectedPgn: readPgn('disambiguation01_expected.pgn'),
      },
      {
        name: 'Extra disambiguation',
        pgn: readPgn('disambiguation02.pgn'),
        expectedPgn: readPgn('disambiguation02_expected.pgn'),
      },
      {
        name: 'Correct disambiguation',
        pgn: '1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5 5.exd5 Nxd5 6.Nxf7 Kxf7 7.Qf3+ Ke6 8.Nc3 Nb4',
        expectedPgn:
          '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3 Nb4',
      },
      {
        name: 'Lazy disambiguation (e.g. Rc1c4)',
        pgn: readPgn('disambiguation03.pgn'),
        expectedPgn: readPgn('disambiguation03_expected.pgn'),
      },
      {
        name: 'Long algebraic notation',
        pgn: readPgn('lan01.pgn'),
        expectedPgn: readPgn('lan01_expected.pgn'),
      },
      {
        name: 'Long algebraic notation with en passant',
        pgn: readPgn('lan02.pgn'),
        expectedPgn: readPgn('lan02_expected.pgn'),
      },
      {
        name: 'Abbreviated long algebraic notation',
        pgn: readPgn('lan03.pgn'),
        expectedPgn: readPgn('lan03_expected.pgn'),
      },
      {
        name: 'Long algebraic notation with underpromotions',
        pgn: readPgn('lan04.pgn'),
        expectedPgn: readPgn('lan04_expected.pgn'),
      },
      {
        name: 'Extended long algebraic notation',
        pgn: readPgn('lan05.pgn'),
        expectedPgn: readPgn('lan05_expected.pgn'),
      },
    ]

    examples.forEach(({ name, pgn, expectedPgn }) => {
      it(name, () => {
        const chess = new Chess()
        chess.loadPgn(pgn)
        expect(expectedPgn || pgn).toEqual(chess.pgn())
        if (expectedPgn) {
          chess.load(expectedPgn)
          expect(expectedPgn).toEqual(chess.pgn())
        }
      })
    })
  })

  describe('invalid', () => {
    const examples = [
      {
        name: 'Illegal move',
        pgn: '1. e4 Qxd7 1/2-1/2',
      },
      {
        name: 'Bad check',
        pgn: '1. e4!+',
      },
    ]

    examples.forEach(({ name, pgn }) => {
      it(name, () => {
        const chess = new Chess()
        expect(() => chess.loadPgn(pgn)).toThrowError()
      })
    })
  })

  it('mixed newlines', () => {
    const pgn =
      '[Event "Reykjavik WCh"]\n' +
      '[Site "Reykjavik WCh"]\n' +
      '[Date "1972.01.07"]\n' +
      '[EventDate "?"]\n' +
      '[Round "6"]\n' +
      '[Result "1-0"]\n' +
      '[White "Robert James Fischer"]\r\n' +
      '[Black "Boris Spassky"]\n' +
      '[ECO "D59"]\n' +
      '[WhiteElo "?"]\n' +
      '[BlackElo "?"]\n' +
      '[PlyCount "81"]\n' +
      '\r\n' +
      '1. c4 e6 2. Nf3 d5 3. d4 Nf6 4. Nc3 Be7 5. Bg5 O-O 6. e3 h6\n' +
      '7. Bh4 b6 8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6\n' +
      '12. Qa4 c5 13. Qa3 Rc8 14. Bb5 a6 15. dxc5 bxc5 16. O-O Ra7\n' +
      '17. Be2 Nd7 18. Nd4 Qf8 19. Nxe6 fxe6 20. e4 d4 21. f4 Qe7\r\n' +
      '22. e5 Rb8 23. Bc4 Kh8 24. Qh3 Nf8 25. b3 a5 26. f5 exf5\n' +
      '27. Rxf5 Nh7 28. Rcf1 Qd8 29. Qg3 Re7 30. h4 Rbb7 31. e6 Rbc7\n' +
      '32. Qe5 Qe8 33. a4 Qd8 34. R1f2 Qe8 35. R2f3 Qd8 36. Bd3 Qe8\n' +
      '37. Qe4 Nf6 38. Rxf6 gxf6 39. Rxf6 Kg8 40. Bc4 Kh8 41. Qf4 1-0\n'
    const chess = new Chess()
    chess.loadPgn(pgn)
    expect(chess.pgn().match(/^\[\[/)).toBeNull()
  })

  describe('comments', () => {
    const tests = [
      {
        name: 'bracket comments',
        input: '1. e4 {good move} e5 {classical response}',
        output: '1. e4 {good move} e5 {classical response}',
      },
      {
        name: 'semicolon comments',
        input: '1. e4 e5; romantic era\n 2. Nf3 Nc6; common continuation',
        output: '1. e4 e5 {romantic era} 2. Nf3 Nc6 {common continuation}',
      },
      {
        name: 'bracket and semicolon comments',
        input: '1. e4 {good!} e5; standard response\n 2. Nf3 Nc6 {common}',
        output: '1. e4 {good!} e5 {standard response} 2. Nf3 Nc6 {common}',
      },
      {
        name: 'bracket comments with newlines',
        input: '1. e4 {good\nmove} e5 {classical\nresponse}',
        output: '1. e4 {good move} e5 {classical response}',
      },
      {
        name: 'initial comment',
        input: '{ great game }\n1. e4 e5',
        output: '{great game} 1. e4 e5',
      },
      {
        name: 'empty bracket comment',
        input: '1. e4 {}',
        output: '1. e4',
      },
      {
        name: 'empty semicolon comment',
        input: '1. e4;\ne5',
        output: '1. e4 e5',
      },
      {
        name: 'unicode comment',
        input: '1. e4 {Δ, Й, ק ,م, ๗, あ, 叶, 葉, and 말}',
        output: '1. e4 {Δ, Й, ק ,م, ๗, あ, 叶, 葉, and 말}',
      },
      {
        name: 'semicolon in bracket comment',
        input: '1. e4 { a classic; well-studied } e5',
        output: '1. e4 {a classic; well-studied} e5',
      },
      {
        name: 'bracket in semicolon comment',
        input: '1. e4 e5 ; a classic {well-studied}',
        output: '1. e4 e5 {a classic {well-studied}}',
      },
      {
        name: 'markers in bracket comment',
        input: '1. e4 e5 {($1) 1. e4 is good}',
        output: '1. e4 e5 {($1) 1. e4 is good}',
      },
      {
        name: 'markers in semicolon comment',
        input: '1. e4 e5; ($1) 1. e4 is good',
        output: '1. e4 e5 {($1) 1. e4 is good}',
      },
    ]

    tests.forEach(({ name, input, output }) => {
      it(name, () => {
        const chess = new Chess()
        chess.loadPgn(input)
        expect(chess.pgn()).toEqual(output)
      })
    })
  })
})

describe('.getComment, .deleteComment', () => {
  it('no comments', () => {
    const chess = new Chess()
    expect(chess.getComment()).toBeUndefined()
    expect(chess.getComments()).toEqual({})
    chess.move('e4')
    expect(chess.getComment()).toBeUndefined()
    expect(chess.getComments()).toEqual({})
    expect(chess.pgn()).toEqual('1. e4')
  })

  it('comment for initial position', () => {
    const chess = new Chess()
    const fen = chess.fen()
    const comment = 'starting position'
    chess.setComment(comment)
    expect(chess.getComment()).toEqual(comment)
    expect(chess.getComment(fen)).toEqual(comment)
    expect(chess.getComments()).toEqual({ [chess.fen()]: comment })
    expect(chess.pgn()).toEqual(`{${comment}}`)
  })

  it('comment for first move', () => {
    const chess = new Chess()
    chess.move('e4')
    const e4 = chess.fen()
    const comment = 'good move'
    chess.setComment(comment)
    expect(chess.getComment()).toEqual(comment)
    expect(chess.getComment(e4)).toEqual(comment)
    expect(chess.getComments()).toEqual({ [e4]: comment })
    chess.move('e5')
    expect(chess.getComment()).toBeUndefined()
    expect(chess.getComment(e4)).toEqual(comment)
    expect(chess.getComments()).toEqual({ [e4]: comment })
    expect(chess.pgn()).toEqual(`1. e4 {${comment}} e5`)
  })

  it('comment for last move', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e6')
    const e6 = chess.fen()
    chess.setComment('dubious move')
    expect(chess.getComment()).toEqual('dubious move')
    expect(chess.getComment(e6)).toEqual('dubious move')
    expect(chess.getComments()).toEqual({ [chess.fen()]: 'dubious move' })
    expect(chess.pgn()).toEqual('1. e4 e6 {dubious move}')
  })

  it('comment with brackets', () => {
    const chess = new Chess()
    chess.setComment('{starting position}')
    expect(chess.getComment()).toEqual('[starting position]')
  })

  it('comments for everything', () => {
    const chess = new Chess()

    const initial = chess.fen()
    chess.setComment('starting position')
    expect(chess.getComment()).toEqual('starting position')
    expect(chess.getComments()).toEqual({ [initial]: 'starting position' })
    expect(chess.pgn()).toEqual('{starting position}')

    chess.move('e4')
    const e4 = chess.fen()
    chess.setComment('good move')
    expect(chess.getComment()).toEqual('good move')
    expect(chess.getComment(e4)).toEqual('good move')
    expect(chess.getComments()).toEqual({
      [initial]: 'starting position',
      [e4]: 'good move',
    })
    expect(chess.pgn()).toEqual('{starting position} 1. e4 {good move}')

    chess.move('e6')
    const e6 = chess.fen()
    chess.setComment('dubious move')
    expect(chess.getComment()).toEqual('dubious move')
    expect(chess.getComment(e6)).toEqual('dubious move')
    expect(chess.getComments()).toEqual({
      [initial]: 'starting position',
      [e4]: 'good move',
      [e6]: 'dubious move',
    })
    expect(chess.pgn()).toEqual(
      '{starting position} 1. e4 {good move} e6 {dubious move}',
    )
  })

  it('delete comments', () => {
    const chess = new Chess()
    const init = chess.fen()
    expect(chess.deleteComment()).toBeUndefined()
    expect(chess.deleteComment(init)).toBeUndefined()
    chess.deleteComments()
    expect(chess.getComments()).toEqual({})
    const initial = chess.fen()
    chess.setComment('starting position')
    chess.move('e4')
    const e4 = chess.fen()
    chess.setComment('good move')
    chess.move('e6')
    const e6 = chess.fen()
    chess.setComment('dubious move')
    expect(chess.getComments()).toEqual({
      [initial]: 'starting position',
      [e4]: 'good move',
      [e6]: 'dubious move',
    })
    expect(chess.deleteComment(e6)).toEqual('dubious move')
    expect(chess.pgn()).toEqual('{starting position} 1. e4 {good move} e6')
    expect(chess.deleteComment()).toBeUndefined()
    chess.deleteComments()
    expect(chess.getComments()).toEqual({})
    expect(chess.pgn()).toEqual('1. e4 e6')
  })

  it('preserves branch comments', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.setComment('tactical')
    const fen1 = chess.fen()
    expect(chess.getComments()).toEqual({ [fen1]: 'tactical' })
    chess.undo()
    chess.move('d4')
    chess.setComment('positional')
    const fen2 = chess.fen()
    expect(chess.getComments()).toEqual({
      [fen1]: 'tactical',
      [fen2]: 'positional',
    })
    expect(chess.pgn()).toEqual('1. e4 {tactical} ( 1. d4 {positional} )')
  })

  it('clear comments', () => {
    const test = function (fn: (chess: Chess) => void) {
      const chess = new Chess()
      chess.move('e4')
      chess.setComment('good move')
      expect(chess.getComments()).toEqual({ [chess.fen()]: 'good move' })
      fn(chess)
      expect(chess.getComments()).toEqual({})
    }
    test((chess) => {
      chess.reset()
    })
    test((chess) => {
      chess.clear()
    })
    test((chess) => {
      chess.load(chess.fen())
    })
    test((chess) => {
      chess.loadPgn('1. e4')
    })
  })
})

describe('.history', () => {
  it('default', () => {
    const chess = new Chess()
    const fen = '4q2k/2r1r3/4PR1p/p1p5/P1Bp1Q1P/1P6/6P1/6K1 b - - 4 41'
    const moves = [
      'c4',
      'e6',
      'Nf3',
      'd5',
      'd4',
      'Nf6',
      'Nc3',
      'Be7',
      'Bg5',
      'O-O',
      'e3',
      'h6',
      'Bh4',
      'b6',
      'cxd5',
      'Nxd5',
      'Bxe7',
      'Qxe7',
      'Nxd5',
      'exd5',
      'Rc1',
      'Be6',
      'Qa4',
      'c5',
      'Qa3',
      'Rc8',
      'Bb5',
      'a6',
      'dxc5',
      'bxc5',
      'O-O',
      'Ra7',
      'Be2',
      'Nd7',
      'Nd4',
      'Qf8',
      'Nxe6',
      'fxe6',
      'e4',
      'd4',
      'f4',
      'Qe7',
      'e5',
      'Rb8',
      'Bc4',
      'Kh8',
      'Qh3',
      'Nf8',
      'b3',
      'a5',
      'f5',
      'exf5',
      'Rxf5',
      'Nh7',
      'Rcf1',
      'Qd8',
      'Qg3',
      'Re7',
      'h4',
      'Rbb7',
      'e6',
      'Rbc7',
      'Qe5',
      'Qe8',
      'a4',
      'Qd8',
      'R1f2',
      'Qe8',
      'R2f3',
      'Qd8',
      'Bd3',
      'Qe8',
      'Qe4',
      'Nf6',
      'Rxf6',
      'gxf6',
      'Rxf6',
      'Kg8',
      'Bc4',
      'Kh8',
      'Qf4',
    ]

    moves.forEach((move) => chess.move(move))
    const history = chess.history()
    expect(fen).toEqual(chess.fen())
    expect(moves).toEqual(history)
  })

  it('verbose', () => {
    const chess = new Chess()
    const fen = '4q2k/2r1r3/4PR1p/p1p5/P1Bp1Q1P/1P6/6P1/6K1 b - - 4 41'
    const moves: Move[] = [
      { color: 'w', from: 'c2', to: 'c4', flags: 'b', piece: 'p', san: 'c4' },
      { color: 'b', from: 'e7', to: 'e6', flags: 'n', piece: 'p', san: 'e6' },
      { color: 'w', from: 'g1', to: 'f3', flags: 'n', piece: 'n', san: 'Nf3' },
      { color: 'b', from: 'd7', to: 'd5', flags: 'b', piece: 'p', san: 'd5' },
      { color: 'w', from: 'd2', to: 'd4', flags: 'b', piece: 'p', san: 'd4' },
      { color: 'b', from: 'g8', to: 'f6', flags: 'n', piece: 'n', san: 'Nf6' },
      { color: 'w', from: 'b1', to: 'c3', flags: 'n', piece: 'n', san: 'Nc3' },
      { color: 'b', from: 'f8', to: 'e7', flags: 'n', piece: 'b', san: 'Be7' },
      { color: 'w', from: 'c1', to: 'g5', flags: 'n', piece: 'b', san: 'Bg5' },
      { color: 'b', from: 'e8', to: 'g8', flags: 'k', piece: 'k', san: 'O-O' },
      { color: 'w', from: 'e2', to: 'e3', flags: 'n', piece: 'p', san: 'e3' },
      { color: 'b', from: 'h7', to: 'h6', flags: 'n', piece: 'p', san: 'h6' },
      { color: 'w', from: 'g5', to: 'h4', flags: 'n', piece: 'b', san: 'Bh4' },
      { color: 'b', from: 'b7', to: 'b6', flags: 'n', piece: 'p', san: 'b6' },
      {
        color: 'w',
        from: 'c4',
        to: 'd5',
        flags: 'c',
        piece: 'p',
        captured: 'p',
        san: 'cxd5',
      },
      {
        color: 'b',
        from: 'f6',
        to: 'd5',
        flags: 'c',
        piece: 'n',
        captured: 'p',
        san: 'Nxd5',
      },
      {
        color: 'w',
        from: 'h4',
        to: 'e7',
        flags: 'c',
        piece: 'b',
        captured: 'b',
        san: 'Bxe7',
      },
      {
        color: 'b',
        from: 'd8',
        to: 'e7',
        flags: 'c',
        piece: 'q',
        captured: 'b',
        san: 'Qxe7',
      },
      {
        color: 'w',
        from: 'c3',
        to: 'd5',
        flags: 'c',
        piece: 'n',
        captured: 'n',
        san: 'Nxd5',
      },
      {
        color: 'b',
        from: 'e6',
        to: 'd5',
        flags: 'c',
        piece: 'p',
        captured: 'n',
        san: 'exd5',
      },
      { color: 'w', from: 'a1', to: 'c1', flags: 'n', piece: 'r', san: 'Rc1' },
      { color: 'b', from: 'c8', to: 'e6', flags: 'n', piece: 'b', san: 'Be6' },
      { color: 'w', from: 'd1', to: 'a4', flags: 'n', piece: 'q', san: 'Qa4' },
      { color: 'b', from: 'c7', to: 'c5', flags: 'b', piece: 'p', san: 'c5' },
      { color: 'w', from: 'a4', to: 'a3', flags: 'n', piece: 'q', san: 'Qa3' },
      { color: 'b', from: 'f8', to: 'c8', flags: 'n', piece: 'r', san: 'Rc8' },
      { color: 'w', from: 'f1', to: 'b5', flags: 'n', piece: 'b', san: 'Bb5' },
      { color: 'b', from: 'a7', to: 'a6', flags: 'n', piece: 'p', san: 'a6' },
      {
        color: 'w',
        from: 'd4',
        to: 'c5',
        flags: 'c',
        piece: 'p',
        captured: 'p',
        san: 'dxc5',
      },
      {
        color: 'b',
        from: 'b6',
        to: 'c5',
        flags: 'c',
        piece: 'p',
        captured: 'p',
        san: 'bxc5',
      },
      { color: 'w', from: 'e1', to: 'g1', flags: 'k', piece: 'k', san: 'O-O' },
      { color: 'b', from: 'a8', to: 'a7', flags: 'n', piece: 'r', san: 'Ra7' },
      { color: 'w', from: 'b5', to: 'e2', flags: 'n', piece: 'b', san: 'Be2' },
      { color: 'b', from: 'b8', to: 'd7', flags: 'n', piece: 'n', san: 'Nd7' },
      { color: 'w', from: 'f3', to: 'd4', flags: 'n', piece: 'n', san: 'Nd4' },
      { color: 'b', from: 'e7', to: 'f8', flags: 'n', piece: 'q', san: 'Qf8' },
      {
        color: 'w',
        from: 'd4',
        to: 'e6',
        flags: 'c',
        piece: 'n',
        captured: 'b',
        san: 'Nxe6',
      },
      {
        color: 'b',
        from: 'f7',
        to: 'e6',
        flags: 'c',
        piece: 'p',
        captured: 'n',
        san: 'fxe6',
      },
      { color: 'w', from: 'e3', to: 'e4', flags: 'n', piece: 'p', san: 'e4' },
      { color: 'b', from: 'd5', to: 'd4', flags: 'n', piece: 'p', san: 'd4' },
      { color: 'w', from: 'f2', to: 'f4', flags: 'b', piece: 'p', san: 'f4' },
      { color: 'b', from: 'f8', to: 'e7', flags: 'n', piece: 'q', san: 'Qe7' },
      { color: 'w', from: 'e4', to: 'e5', flags: 'n', piece: 'p', san: 'e5' },
      { color: 'b', from: 'c8', to: 'b8', flags: 'n', piece: 'r', san: 'Rb8' },
      { color: 'w', from: 'e2', to: 'c4', flags: 'n', piece: 'b', san: 'Bc4' },
      { color: 'b', from: 'g8', to: 'h8', flags: 'n', piece: 'k', san: 'Kh8' },
      { color: 'w', from: 'a3', to: 'h3', flags: 'n', piece: 'q', san: 'Qh3' },
      { color: 'b', from: 'd7', to: 'f8', flags: 'n', piece: 'n', san: 'Nf8' },
      { color: 'w', from: 'b2', to: 'b3', flags: 'n', piece: 'p', san: 'b3' },
      { color: 'b', from: 'a6', to: 'a5', flags: 'n', piece: 'p', san: 'a5' },
      { color: 'w', from: 'f4', to: 'f5', flags: 'n', piece: 'p', san: 'f5' },
      {
        color: 'b',
        from: 'e6',
        to: 'f5',
        flags: 'c',
        piece: 'p',
        captured: 'p',
        san: 'exf5',
      },
      {
        color: 'w',
        from: 'f1',
        to: 'f5',
        flags: 'c',
        piece: 'r',
        captured: 'p',
        san: 'Rxf5',
      },
      { color: 'b', from: 'f8', to: 'h7', flags: 'n', piece: 'n', san: 'Nh7' },
      { color: 'w', from: 'c1', to: 'f1', flags: 'n', piece: 'r', san: 'Rcf1' },
      { color: 'b', from: 'e7', to: 'd8', flags: 'n', piece: 'q', san: 'Qd8' },
      { color: 'w', from: 'h3', to: 'g3', flags: 'n', piece: 'q', san: 'Qg3' },
      { color: 'b', from: 'a7', to: 'e7', flags: 'n', piece: 'r', san: 'Re7' },
      { color: 'w', from: 'h2', to: 'h4', flags: 'b', piece: 'p', san: 'h4' },
      { color: 'b', from: 'b8', to: 'b7', flags: 'n', piece: 'r', san: 'Rbb7' },
      { color: 'w', from: 'e5', to: 'e6', flags: 'n', piece: 'p', san: 'e6' },
      { color: 'b', from: 'b7', to: 'c7', flags: 'n', piece: 'r', san: 'Rbc7' },
      { color: 'w', from: 'g3', to: 'e5', flags: 'n', piece: 'q', san: 'Qe5' },
      { color: 'b', from: 'd8', to: 'e8', flags: 'n', piece: 'q', san: 'Qe8' },
      { color: 'w', from: 'a2', to: 'a4', flags: 'b', piece: 'p', san: 'a4' },
      { color: 'b', from: 'e8', to: 'd8', flags: 'n', piece: 'q', san: 'Qd8' },
      { color: 'w', from: 'f1', to: 'f2', flags: 'n', piece: 'r', san: 'R1f2' },
      { color: 'b', from: 'd8', to: 'e8', flags: 'n', piece: 'q', san: 'Qe8' },
      { color: 'w', from: 'f2', to: 'f3', flags: 'n', piece: 'r', san: 'R2f3' },
      { color: 'b', from: 'e8', to: 'd8', flags: 'n', piece: 'q', san: 'Qd8' },
      { color: 'w', from: 'c4', to: 'd3', flags: 'n', piece: 'b', san: 'Bd3' },
      { color: 'b', from: 'd8', to: 'e8', flags: 'n', piece: 'q', san: 'Qe8' },
      { color: 'w', from: 'e5', to: 'e4', flags: 'n', piece: 'q', san: 'Qe4' },
      { color: 'b', from: 'h7', to: 'f6', flags: 'n', piece: 'n', san: 'Nf6' },
      {
        color: 'w',
        from: 'f5',
        to: 'f6',
        flags: 'c',
        piece: 'r',
        captured: 'n',
        san: 'Rxf6',
      },
      {
        color: 'b',
        from: 'g7',
        to: 'f6',
        flags: 'c',
        piece: 'p',
        captured: 'r',
        san: 'gxf6',
      },
      {
        color: 'w',
        from: 'f3',
        to: 'f6',
        flags: 'c',
        piece: 'r',
        captured: 'p',
        san: 'Rxf6',
      },
      { color: 'b', from: 'h8', to: 'g8', flags: 'n', piece: 'k', san: 'Kg8' },
      { color: 'w', from: 'd3', to: 'c4', flags: 'n', piece: 'b', san: 'Bc4' },
      { color: 'b', from: 'g8', to: 'h8', flags: 'n', piece: 'k', san: 'Kh8' },
      { color: 'w', from: 'e4', to: 'f4', flags: 'n', piece: 'q', san: 'Qf4' },
    ]

    moves.forEach((move) => chess.move(move))
    const history = chess.history({ verbose: true })
    expect(fen).toEqual(chess.fen())
    expect(moves).toEqual(history)
  })
})

describe('.board', () => {
  const examples = [
    {
      name: 'initial position',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      board: [
        [
          { type: 'r', color: 'b' },
          { type: 'n', color: 'b' },
          { type: 'b', color: 'b' },
          { type: 'q', color: 'b' },
          { type: 'k', color: 'b' },
          { type: 'b', color: 'b' },
          { type: 'n', color: 'b' },
          { type: 'r', color: 'b' },
        ],
        [
          { type: 'p', color: 'b' },
          { type: 'p', color: 'b' },
          { type: 'p', color: 'b' },
          { type: 'p', color: 'b' },
          { type: 'p', color: 'b' },
          { type: 'p', color: 'b' },
          { type: 'p', color: 'b' },
          { type: 'p', color: 'b' },
        ],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [
          { type: 'p', color: 'w' },
          { type: 'p', color: 'w' },
          { type: 'p', color: 'w' },
          { type: 'p', color: 'w' },
          { type: 'p', color: 'w' },
          { type: 'p', color: 'w' },
          { type: 'p', color: 'w' },
          { type: 'p', color: 'w' },
        ],
        [
          { type: 'r', color: 'w' },
          { type: 'n', color: 'w' },
          { type: 'b', color: 'w' },
          { type: 'q', color: 'w' },
          { type: 'k', color: 'w' },
          { type: 'b', color: 'w' },
          { type: 'n', color: 'w' },
          { type: 'r', color: 'w' },
        ],
      ],
    },
    {
      name: 'checkmate',
      fen: 'r3k2r/ppp2p1p/2n1p1p1/8/2B2P1q/2NPb1n1/PP4PP/R2Q3K w kq - 0 8',
      board: [
        [
          { type: 'r', color: 'b' },
          null,
          null,
          null,
          { type: 'k', color: 'b' },
          null,
          null,
          { type: 'r', color: 'b' },
        ],
        [
          { type: 'p', color: 'b' },
          { type: 'p', color: 'b' },
          { type: 'p', color: 'b' },
          null,
          null,
          { type: 'p', color: 'b' },
          null,
          { type: 'p', color: 'b' },
        ],
        [
          null,
          null,
          { type: 'n', color: 'b' },
          null,
          { type: 'p', color: 'b' },
          null,
          { type: 'p', color: 'b' },
          null,
        ],
        [null, null, null, null, null, null, null, null],
        [
          null,
          null,
          { type: 'b', color: 'w' },
          null,
          null,
          { type: 'p', color: 'w' },
          null,
          { type: 'q', color: 'b' },
        ],
        [
          null,
          null,
          { type: 'n', color: 'w' },
          { type: 'p', color: 'w' },
          { type: 'b', color: 'b' },
          null,
          { type: 'n', color: 'b' },
          null,
        ],
        [
          { type: 'p', color: 'w' },
          { type: 'p', color: 'w' },
          null,
          null,
          null,
          null,
          { type: 'p', color: 'w' },
          { type: 'p', color: 'w' },
        ],
        [
          { type: 'r', color: 'w' },
          null,
          null,
          { type: 'q', color: 'w' },
          null,
          null,
          null,
          { type: 'k', color: 'w' },
        ],
      ],
    },
  ]

  examples.forEach(({ name, fen, board }) => {
    it(name, () => {
      const chess = new Chess(fen)
      expect(chess.board()).toEqual(board)
    })
  })
})

describe('Regression Tests', () => {
  it('Github Issue #32 - castling flag reappearing', () => {
    const chess = new Chess(
      'b3k2r/5p2/4p3/1p5p/6p1/2PR2P1/BP3qNP/6QK b k - 2 28',
    )
    chess.move({ from: 'a8', to: 'g2' })
    expect(
      chess.fen() == '4k2r/5p2/4p3/1p5p/6p1/2PR2P1/BP3qbP/6QK w k - 0 29',
    ).toBe(true)
  })

  it('Github Issue #58 - placing more than one king', () => {
    const chess = new Chess('N3k3/8/8/8/8/8/5b2/4K3 w - - 0 1')
    expect(chess.putPiece({ type: 'k', color: 'w' }, 'a1')).toBe(false)
    chess.putPiece({ type: 'q', color: 'w' }, 'a1')
    chess.removePiece('a1')
    expect(chess.sanMoves().join(' ')).toBe('Kd2 Ke2 Kxf2 Kf1 Kd1')
  })

  it('Github Issue #85 (white) - SetUp and FEN should be accepted in loadPgn', () => {
    const chess = new Chess()
    const pgn = [
      '[SetUp "1"]',
      '[FEN "7k/5K2/4R3/8/8/8/8/8 w KQkq - 0 1"]',
      '',
      '1. Rh6#',
    ]
    chess.loadPgn(pgn.join('\n'))
    expect(chess.fen()).toBe('7k/5K2/7R/8/8/8/8/8 b KQkq - 1 1')
  })

  it('Github Issue #85 (black) - SetUp and FEN should be accepted in loadPgn', () => {
    const chess = new Chess()
    const pgn = [
      '[SetUp "1"]',
      '[FEN "r4r1k/1p4b1/3p3p/5qp1/1RP5/6P1/3NP3/2Q2RKB b KQkq - 0 1"]',
      '',
      '1. ... Qc5+',
    ]
    chess.loadPgn(pgn.join('\n'))
    expect(chess.fen()).toBe(
      'r4r1k/1p4b1/3p3p/2q3p1/1RP5/6P1/3NP3/2Q2RKB w KQkq - 1 2',
    )
  })

  it('Github Issue #98 (white) - Wrong movement number after setting a position via FEN', () => {
    const chess = new Chess(
      '4r3/8/2p2PPk/1p6/pP2p1R1/P1B5/2P2K2/3r4 w - - 1 45',
    )
    chess.move('f7')
    expect(chess.pgn()).toContain('45. f7')
  })

  it('Github Issue #98 (black) - Wrong movement number after setting a position via FEN', () => {
    const chess = new Chess(
      '4r3/8/2p2PPk/1p6/pP2p1R1/P1B5/2P2K2/3r4 b - - 1 45',
    )
    chess.move('Rf1+')
    expect(chess.pgn()).toContain('45...Rf1+')
  })

  it('Github Issue #129 loadPgn() should not clear headers if PGN contains SetUp and FEN tags', () => {
    const pgn = [
      '[Event "Test Olympiad"]',
      '[Site "Earth"]',
      '[Date "????.??.??"]',
      '[Round "6"]',
      '[White "Testy"]',
      '[Black "McTest"]',
      '[Result "*"]',
      '[FEN "rnbqkb1r/1p3ppp/p2ppn2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R w KQkq - 0 1"]',
      '[SetUp "1"]',
      '',
      '1.Qd2 Be7 *',
    ]

    const chess = new Chess()
    chess.loadPgn(pgn.join('\n'))
    const expected = {
      Event: 'Test Olympiad',
      Site: 'Earth',
      Date: '????.??.??',
      Round: '6',
      White: 'Testy',
      Black: 'McTest',
      Result: '*',
      FEN: 'rnbqkb1r/1p3ppp/p2ppn2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R w KQkq - 0 1',
      SetUp: '1',
    }
    expect(chess.header).toEqual(expected)
  })

  it('Github Issue #129 clear() should clear the board and delete all headers with the exception of SetUp and FEN', () => {
    const pgn = [
      '[Event "Test Olympiad"]',
      '[Site "Earth"]',
      '[Date "????.??.??"]',
      '[Round "6"]',
      '[White "Testy"]',
      '[Black "McTest"]',
      '[Result "*"]',
      '[FEN "rnbqkb1r/1p3ppp/p2ppn2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R w KQkq - 0 1"]',
      '[SetUp "1"]',
      '',
      '1.Qd2 Be7 *',
    ]

    const chess = new Chess()
    chess.loadPgn(pgn.join('\n'))
    chess.clear()
    const expected = {
      FEN: '8/8/8/8/8/8/8/8 w - - 0 1',
      SetUp: '1',
    }
    expect(chess.header).toEqual(expected)
  })

  it('Github Issue #279 - load_pgn duplicate last move if it has a comment', () => {
    const history = [
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'Bb5',
      'd6',
      'd4',
      'Bd7',
      'Nc3',
      'Nf6',
      'Bxc6',
    ]

    // trailing comment - no end of game marker
    const chess = new Chess()
    chess.loadPgn(
      '1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 ' +
        '4. d4 Bd7 5. Nc3 Nf6 6. Bxc6 {comment}',
    )
    expect(chess.history()).toEqual(history)
    expect(chess.header['Result']).toBeUndefined()

    // trailing comment - end of game marker after comment
    chess.loadPgn(
      '1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 ' +
        '4. d4 Bd7 5. Nc3 Nf6 6. Bxc6 {comment} *',
    )
    expect(chess.history()).toEqual(history)
    expect(chess.header['Result']).toBe('*')

    // trailing comment - end of game marker before comment
    chess.loadPgn(
      '1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 ' +
        '4. d4 Bd7 5. Nc3 Nf6 6. Bxc6 * {comment}',
    )
    expect(chess.history()).toEqual(history)
    expect(chess.header['Result']).toBe('*')

    // trailing comment with PGN header - no end of game marker
    chess.loadPgn(
      '[White "name"]\n\n' +
        '1. e4 e5 2. Nf3 Nc6 ' +
        '3. Bb5 d6 ' +
        '4. d4 Bd7 5. Nc3 Nf6 ' +
        '6. Bxc6 {comment}',
    )
    expect(chess.history()).toEqual(history)
    expect(chess.header['Result']).toBeUndefined()

    // trailing comment with result header - end of game marker after comment
    chess.loadPgn(
      '[White "name"]\n\n' +
        '1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 ' +
        '4. d4 Bd7 5. Nc3 Nf6 6. Bxc6 {comment} *',
    )
    expect(chess.history()).toEqual(history)
    expect(chess.header['Result']).toBe('*')

    // trailing comment with result header - end of game marker before comment
    chess.loadPgn(
      '[White "name"]\n\n' +
        '1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 ' +
        '4. d4 Bd7 5. Nc3 Nf6 6. Bxc6 1/2-1/2 {comment}',
    )
    expect(chess.history()).toEqual(history)
    expect(chess.header['Result']).toBe('1/2-1/2')
  })

  it('Github Issue #282 - playing a move on an empty board throws an error', function () {
    var chess = new Chess('8/8/8/8/8/8/8/8 w KQkq - 0 1')
    expect(chess.move('e4')).toBeNull()
  })

  it('Github Issue #284 - sloppy settings allows illegal moves', function () {
    var chess = new Chess('4k3/8/8/8/8/4p3/8/4K3 w - - 0 1')
    expect(chess.move('e1f2')).toBeNull()
  })

  it('Github Issue #286 - pgn should not generate sloppy moves', () => {
    const chess = new Chess()
    chess.loadPgn('1. e4 d5 2. Nf3 Nd7 3. Bb5 Nf6 4. O-O')
    expect(chess.pgn()).toBe('1. e4 d5 2. Nf3 Nd7 3. Bb5 Nf6 4. O-O')
  })
})

describe('.validateMoves', () => {
  it('returns moves', () => {
    const chess = new Chess()
    const moves = ['e4', 'e5', 'Nf3', 'Nc6']
    const expected = [
      {
        color: 'w',
        flags: 'b',
        from: 'e2',
        piece: 'p',
        san: 'e4',
        to: 'e4',
      },
      {
        color: 'b',
        flags: 'b',
        from: 'e7',
        piece: 'p',
        san: 'e5',
        to: 'e5',
      },
      {
        color: 'w',
        flags: 'n',
        from: 'g1',
        piece: 'n',
        san: 'Nf3',
        to: 'f3',
      },
      {
        color: 'b',
        flags: 'n',
        from: 'b8',
        piece: 'n',
        san: 'Nc6',
        to: 'c6',
      },
    ]
    expect(chess.validateMoves(moves)).toEqual(expected)
  })
})

describe('.ascii', () => {
  it('initial position', () => {
    const chess = new Chess()
    expect(chess.ascii()).toBe(
      '  +------------------------+\n' +
        '8 | r  n  b  q  k  b  n  r |\n' +
        '7 | p  p  p  p  p  p  p  p |\n' +
        '6 | .  .  .  .  .  .  .  . |\n' +
        '5 | .  .  .  .  .  .  .  . |\n' +
        '4 | .  .  .  .  .  .  .  . |\n' +
        '3 | .  .  .  .  .  .  .  . |\n' +
        '2 | P  P  P  P  P  P  P  P |\n' +
        '1 | R  N  B  Q  K  B  N  R |\n' +
        '  +------------------------+\n' +
        '    a  b  c  d  e  f  g  h',
    )
  })
})

describe('.clone', () => {
  it('clones the position', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    const clone = chess.clone()
    expect(chess.fen()).toBe(clone.fen())
  })

  it('mutating clones does not affect the original', () => {
    const chess = new Chess()
    const clone = chess.clone()
    expect(chess.state).not.toBe(clone.state)
    clone.putPiece({ type: 'q', color: 'w' }, 'e4')
    expect(chess.fen()).not.toBe(clone.fen())
  })
})
