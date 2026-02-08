import {
  bitToSquare,
  squareToBit,
  diagonalOffset,
  linearOffset,
  squaresByOffset,
  sameFile,
  sameRank,
  sameRankOrFile,
  sameMajorDiagonal,
  sameMinorDiagonal,
  sameDiagonal,
  diagonalSquaresBetween,
  linearSquaresBetween,
  squaresBetween,
  toPieceSymbol,
  bitToAlgebraic,
  getBitIndices,
  canPromote,
  canDemote,
} from '../src/utils'
import { BIT_SQUARES, SQUARES } from '../src/constants'
import { Square, HexState } from '../src/interfaces/types'
import { TreeNode } from 'treenode.ts'
import { defaultBoardState } from '../src/state'

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

describe('sameFile', () => {
  it('returns true for squares on the same rank (sameFile checks rank)', () => {
    expect(sameFile(SQUARES.a8, SQUARES.b8)).toBe(true)
  })
  it('returns false for different ranks', () => {
    expect(sameFile(SQUARES.a8, SQUARES.a7)).toBe(false)
  })
})

describe('sameRank', () => {
  it('returns true for squares on the same file (sameRank checks file)', () => {
    expect(sameRank(SQUARES.a8, SQUARES.a1)).toBe(true)
  })
  it('returns false for different files', () => {
    expect(sameRank(SQUARES.a8, SQUARES.b8)).toBe(false)
  })
})

describe('sameRankOrFile', () => {
  it('returns true for same rank or file', () => {
    expect(sameRankOrFile(SQUARES.a1, SQUARES.a8)).toBe(true)
    expect(sameRankOrFile(SQUARES.a1, SQUARES.h1)).toBe(true)
  })
  it('returns false for neither', () => {
    expect(sameRankOrFile(SQUARES.a1, SQUARES.b2)).toBe(false)
  })
})

describe('sameMajorDiagonal', () => {
  it('returns true for squares on the same major diagonal', () => {
    expect(sameMajorDiagonal(SQUARES.a8, SQUARES.h1)).toBe(true)
  })
  it('returns false otherwise', () => {
    expect(sameMajorDiagonal(SQUARES.a8, SQUARES.a1)).toBe(false)
  })
})

describe('sameMinorDiagonal', () => {
  it('returns true for squares on the same minor diagonal', () => {
    expect(sameMinorDiagonal(SQUARES.a1, SQUARES.h8)).toBe(true)
  })
  it('returns false otherwise', () => {
    expect(sameMinorDiagonal(SQUARES.a1, SQUARES.a8)).toBe(false)
  })
})

describe('sameDiagonal', () => {
  it('returns true for major or minor diagonal', () => {
    expect(sameDiagonal(SQUARES.a8, SQUARES.h1)).toBe(true)
    expect(sameDiagonal(SQUARES.a1, SQUARES.h8)).toBe(true)
  })
  it('returns false for non-diagonal', () => {
    expect(sameDiagonal(SQUARES.a1, SQUARES.a8)).toBe(false)
  })
})

describe('diagonalSquaresBetween', () => {
  it('returns squares between two diagonal squares', () => {
    expect(diagonalSquaresBetween(SQUARES.a8, SQUARES.c6)).toEqual([SQUARES.b7])
  })
  it('returns empty for non-diagonal squares', () => {
    expect(diagonalSquaresBetween(SQUARES.a8, SQUARES.a1)).toEqual([])
  })
})

describe('linearSquaresBetween', () => {
  it('returns squares between two linear squares', () => {
    expect(linearSquaresBetween(SQUARES.a8, SQUARES.a6)).toEqual([SQUARES.a7])
  })
  it('returns empty for non-linear squares', () => {
    expect(linearSquaresBetween(SQUARES.a8, SQUARES.b7)).toEqual([])
  })
})

describe('squaresBetween', () => {
  it('returns diagonal squares between', () => {
    expect(squaresBetween(SQUARES.a8, SQUARES.c6)).toEqual([SQUARES.b7])
  })
  it('returns linear squares between', () => {
    expect(squaresBetween(SQUARES.a8, SQUARES.a6)).toEqual([SQUARES.a7])
  })
  it('returns empty for unrelated squares', () => {
    expect(squaresBetween(SQUARES.a8, SQUARES.b6)).toEqual([])
  })
})

describe('toPieceSymbol', () => {
  it('returns piece symbol for valid piece', () => {
    expect(toPieceSymbol('p')).toBe('p')
    expect(toPieceSymbol('Q')).toBe('q')
  })
  it('returns undefined for invalid piece', () => {
    expect(toPieceSymbol('x')).toBeUndefined()
  })
  it('returns undefined for non-string', () => {
    expect(toPieceSymbol(42)).toBeUndefined()
  })
})

describe('bitToAlgebraic', () => {
  it('converts bit index 0 to a8', () => {
    expect(bitToAlgebraic(0)).toBe('a8')
  })
  it('converts bit index 63 to h1', () => {
    expect(bitToAlgebraic(63)).toBe('h1')
  })
})

describe('getBitIndices', () => {
  it('returns indices of set bits', () => {
    expect(getBitIndices(BigInt(0b1010))).toEqual([1, 3])
  })
  it('returns only the first set bit with first=true', () => {
    expect(getBitIndices(BigInt(0b1010), true)).toEqual([1])
  })
  it('returns empty for zero', () => {
    expect(getBitIndices(BigInt(0))).toEqual([])
  })
})

describe('canPromote / canDemote', () => {
  function makeTree(): TreeNode<HexState> {
    const root = new TreeNode<HexState>({ boardState: defaultBoardState() })
    root.addModel({ boardState: defaultBoardState() }) // child 0
    root.addModel({ boardState: defaultBoardState() }) // child 1
    return root
  }

  it('canPromote returns true for non-first child', () => {
    const root = makeTree()
    expect(canPromote(root.children[1])).toBe(true)
  })

  it('canPromote returns false for first child', () => {
    const root = makeTree()
    expect(canPromote(root.children[0])).toBe(false)
  })

  it('canDemote returns true for non-last child', () => {
    const root = makeTree()
    expect(canDemote(root.children[0])).toBe(true)
  })

  it('canDemote returns false for last child', () => {
    const root = makeTree()
    expect(canDemote(root.children[1])).toBe(false)
  })

  it('canPromote returns false for root', () => {
    const root = makeTree()
    expect(canPromote(root)).toBe(false)
  })
})
