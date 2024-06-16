import {
  bitToSquare,
  squareToBit,
  diagonalOffset,
  linearOffset,
  squaresByOffset,
} from '../src/utils'
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

describe('linearOffset', () => {
  it('should return the correct linear offset', () => {
    // Same square
    expect(linearOffset(SQUARES.c6, SQUARES.c6)).toBe(0)
    // Top-left
    expect(linearOffset(SQUARES.c6, SQUARES.b7)).toBeUndefined()
    expect(linearOffset(SQUARES.c6, SQUARES.a8)).toBeUndefined()
    // Top
    expect(linearOffset(SQUARES.c6, SQUARES.c7)).toBe(-16)
    expect(linearOffset(SQUARES.c6, SQUARES.c8)).toBe(-16)
    // Top-right
    expect(linearOffset(SQUARES.c6, SQUARES.d7)).toBeUndefined()
    expect(linearOffset(SQUARES.c6, SQUARES.e8)).toBeUndefined()
    // Right
    expect(linearOffset(SQUARES.c6, SQUARES.d6)).toBe(1)
    expect(linearOffset(SQUARES.c6, SQUARES.e6)).toBe(1)
    // Bottom-right
    expect(linearOffset(SQUARES.c6, SQUARES.d5)).toBeUndefined()
    expect(linearOffset(SQUARES.c6, SQUARES.e4)).toBeUndefined()
    // Bottom
    expect(linearOffset(SQUARES.c6, SQUARES.c5)).toBe(16)
    expect(linearOffset(SQUARES.c6, SQUARES.c4)).toBe(16)
    // Bottom-left
    expect(linearOffset(SQUARES.c6, SQUARES.b5)).toBeUndefined()
    expect(linearOffset(SQUARES.c6, SQUARES.a4)).toBeUndefined()
    // Left
    expect(linearOffset(SQUARES.c6, SQUARES.b6)).toBe(-1)
    expect(linearOffset(SQUARES.c6, SQUARES.a6)).toBe(-1)
  })
})

describe('squaresByOffset', () => {
  it('should return the correct squares by linear offset', () => {
    expect(squaresByOffset(SQUARES.a8, SQUARES.h8, 1)).toEqual([
      SQUARES.b8,
      SQUARES.c8,
      SQUARES.d8,
      SQUARES.e8,
      SQUARES.f8,
      SQUARES.g8,
    ])
    expect(squaresByOffset(SQUARES.a8, SQUARES.h8, 16)).toEqual([])
  })

  it('should return the correct squares by diagonal offset', () => {
    expect(squaresByOffset(SQUARES.a8, SQUARES.h1, 17)).toEqual([
      SQUARES.b7,
      SQUARES.c6,
      SQUARES.d5,
      SQUARES.e4,
      SQUARES.f3,
      SQUARES.g2,
    ])
    expect(squaresByOffset(SQUARES.a8, SQUARES.h1, 16)).toEqual([])
  })
})
