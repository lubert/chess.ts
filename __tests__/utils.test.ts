import { bitToSquare, squareToBit } from '../src/utils'
import { BIT_SQUARES, SQUARES } from '../src/constants'
import { Square } from '../src/interfaces/types'

describe('bitToSquare', () => {
  it('should convert a bit to a square', () => {
    Object.entries(BIT_SQUARES).forEach(([sq, num]) => {
      expect(bitToSquare(num)).toBe(SQUARES[sq as Square])
    })
  })
})

describe('squareToBit', () => {
  it('should convert a square to a bit', () => {
    Object.entries(SQUARES).forEach(([sq, num]) => {
      expect(squareToBit(num)).toBe(BIT_SQUARES[sq as Square])
    })
  })
})
