import { extractMove } from '../src/move'
import { ParsedMove } from '../src/interfaces/types'

describe('move', () => {
  describe('extractMove', () => {
    interface ExtractMoveExample {
      token: string;
      parsedMove: ParsedMove;
    }
    const examples: ExtractMoveExample[] = [
      {
        token: 'e4',
        parsedMove: {
          san: 'e4',
          to: 'e4',
        }
      },
      {
        token: '1.e4',
        parsedMove: {
          san: 'e4',
          to: 'e4',
        }
      },
      {
        token: 'b2-b4',
        parsedMove: {
          san: 'b2-b4',
          from: 'b2',
          to: 'b4',
        }
      },
      {
        token: 'Bb7',
        parsedMove: {
          piece: 'b',
          san: 'Bb7',
          to: 'b7',
        }
      },
      {
        token: 'e8=Q',
        parsedMove: {
          san: 'e8=Q',
          to: 'e8',
          promotion: 'q',
        }
      },
      {
        token: 'a8=N+',
        parsedMove: {
          san: 'a8=N+',
          to: 'a8',
          promotion: 'n',
          check: '+',
        }
      },
      {
        token: 'Nge7',
        parsedMove: {
          piece: 'n',
          san: 'Nge7',
          to: 'e7',
          disambiguator: 'g',
        }
      },
      {
        token: 'O-O',
        parsedMove: {
          san: 'O-O'
        }
      },
      {
        token: 'O-O+',
        parsedMove: {
          san: 'O-O+',
          check: '+',
        }
      },
      {
        token: 'O-O-O',
        parsedMove: {
          san: 'O-O-O'
        }
      },
      {
        token: 'O-O-O!',
        parsedMove: {
          san: 'O-O-O',
          nag: '!',
        }
      },
    ]

    examples.forEach(({ token, parsedMove }) => {
      it(`${token}`, () => {
        expect(extractMove(token)).toEqual(parsedMove)
      })
    })
  })
})
