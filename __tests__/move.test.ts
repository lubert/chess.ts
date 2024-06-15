import { extractMove, isAttackedBy, loadFen } from '../src/move'
import { ParsedMove } from '../src/interfaces/types'
import { SQUARES } from '../src/constants'

describe('move', () => {
  describe.only('isAttackedBy', () => {
    describe('pawn', () => {
      it('returns whether a square is attacked by a pawn', () => {
        const state = loadFen('8/8/8/8/8/3ppp2/4P3/8 w KQkq - 0 1')
        if (!state) throw new Error('state is undefined')
        expect(isAttackedBy(state, SQUARES.f3, SQUARES.e2)).toBe(true)
        expect(isAttackedBy(state, SQUARES.d3, SQUARES.e2)).toBe(true)
        expect(isAttackedBy(state, SQUARES.e2, SQUARES.f3)).toBe(true)
        expect(isAttackedBy(state, SQUARES.e2, SQUARES.f3)).toBe(true)

        expect(isAttackedBy(state, SQUARES.e3, SQUARES.e2)).toBe(false)
        expect(isAttackedBy(state, SQUARES.e2, SQUARES.e3)).toBe(false)
      })
    })

    describe('knight', () => {
      it('returns whether a square is attacked by a knight', () => {
        const state = loadFen('8/8/3n1n2/2n3n1/4P3/2n3n1/3n1n2/8 w KQkq - 0 1')
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
          expect(isAttackedBy(state, SQUARES.e4, square)).toBe(true)
        })
      })
    })
  })

  describe('extractMove', () => {
    interface ExtractMoveExample {
      token: string
      parsedMove: ParsedMove
    }
    const examples: ExtractMoveExample[] = [
      {
        token: 'e4',
        parsedMove: {
          san: 'e4',
          to: 'e4',
        },
      },
      {
        token: '1.e4',
        parsedMove: {
          san: 'e4',
          to: 'e4',
        },
      },
      {
        token: 'b2-b4',
        parsedMove: {
          san: 'b2-b4',
          from: 'b2',
          to: 'b4',
        },
      },
      {
        token: 'Bb7',
        parsedMove: {
          piece: 'b',
          san: 'Bb7',
          to: 'b7',
        },
      },
      {
        token: 'Qxd7',
        parsedMove: {
          piece: 'q',
          san: 'Qxd7',
          to: 'd7',
        },
      },
      {
        token: 'e8=Q',
        parsedMove: {
          san: 'e8=Q',
          to: 'e8',
          promotion: 'q',
        },
      },
      {
        token: 'a8=N+',
        parsedMove: {
          san: 'a8=N+',
          to: 'a8',
          promotion: 'n',
          check: '+',
        },
      },
      {
        token: 'Nge7',
        parsedMove: {
          piece: 'n',
          san: 'Nge7',
          to: 'e7',
          disambiguator: 'g',
        },
      },
      {
        token: 'O-O',
        parsedMove: {
          san: 'O-O',
        },
      },
      {
        token: 'O-O+',
        parsedMove: {
          san: 'O-O+',
          check: '+',
        },
      },
      {
        token: 'O-O-O',
        parsedMove: {
          san: 'O-O-O',
        },
      },
      {
        token: 'O-O-O!',
        parsedMove: {
          san: 'O-O-O',
        },
      },
      {
        token: 'b7b8N',
        parsedMove: {
          san: 'b7b8N',
          from: 'b7',
          to: 'b8',
          promotion: 'n',
        },
      },
    ]

    examples.forEach(({ token, parsedMove }) => {
      it(`${token}`, () => {
        expect(extractMove(token)).toEqual(parsedMove)
      })
    })
  })
})
