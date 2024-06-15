import { bitToSquare, squareToBit, diagonalOffset } from '../src/utils'
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

describe('diagonalOffset', () => {
  it('should return the correct diagonal offset', () => {
    // Same square
    expect(diagonalOffset(SQUARES.c6, SQUARES.c6)).toBe(0)
    // Top-left
    expect(diagonalOffset(SQUARES.c6, SQUARES.b7)).toBe(-17)
    expect(diagonalOffset(SQUARES.c6, SQUARES.a8)).toBe(-17)
    // Top
    expect(diagonalOffset(SQUARES.c6, SQUARES.c7)).toBeUndefined()
    expect(diagonalOffset(SQUARES.c6, SQUARES.c8)).toBeUndefined()
    // Top-right
    expect(diagonalOffset(SQUARES.c6, SQUARES.d7)).toBe(-15)
    expect(diagonalOffset(SQUARES.c6, SQUARES.e8)).toBe(-15)
    // Right
    expect(diagonalOffset(SQUARES.c6, SQUARES.d6)).toBeUndefined()
    expect(diagonalOffset(SQUARES.c6, SQUARES.e6)).toBeUndefined()
    // Bottom-right
    expect(diagonalOffset(SQUARES.c6, SQUARES.d5)).toBe(17)
    expect(diagonalOffset(SQUARES.c6, SQUARES.e4)).toBe(17)
    // Bottom
    expect(diagonalOffset(SQUARES.c6, SQUARES.c5)).toBeUndefined()
    expect(diagonalOffset(SQUARES.c6, SQUARES.c4)).toBeUndefined()
    // Bottom-left
    expect(diagonalOffset(SQUARES.c6, SQUARES.b5)).toBe(15)
    expect(diagonalOffset(SQUARES.c6, SQUARES.a4)).toBe(15)
    // Left
    expect(diagonalOffset(SQUARES.c6, SQUARES.b6)).toBeUndefined()
    expect(diagonalOffset(SQUARES.c6, SQUARES.a6)).toBeUndefined()
  })
})
