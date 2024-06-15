import { BLACK, WHITE } from './constants'
import { Color, FlagKey, Piece, PieceSymbol, Square } from './interfaces/types'

/**
 * Extracts the zero-based rank of an 0x88 square.
 * @public
 */
export function rank(i: number): number {
  return i >> 4
}

/**
 * Extracts the zero-based file of an 0x88 square.
 * @public
 */
export function file(i: number): number {
  return i & 15
}

/**
 * Tests if two squares are on the same file.
 * @public
 */
export function sameFile(sq1: number, sq2: number): boolean {
  return rank(sq1) === rank(sq2)
}

/**
 * Tests if two squares are on the same rank.
 * @public
 */
export function sameRank(sq1: number, sq2: number): boolean {
  return file(sq1) === file(sq2)
}

/**
 * Tests if two squares are on the same rank or file.
 * @public
 */
export function sameRankOrFile(sq1: number, sq2: number): boolean {
  return sameRank(sq1, sq2) || sameFile(sq1, sq2)
}

/**
 * Tests if two squares are on the same major diagonal.
 * @public
 */
export function sameMajorDiagonal(sq1: number, sq2: number): boolean {
  return rank(sq1) - file(sq1) === rank(sq2) - file(sq2)
}

/**
 * Tests if two squares are on the same minor diagonal.
 * @public
 */
export function sameMinorDiagonal(sq1: number, sq2: number): boolean {
  return rank(sq1) + file(sq1) === rank(sq2) + file(sq2)
}

/**
 * Tests if two squares are on the same diagonal.
 * @public
 */
export function sameDiagonal(sq1: number, sq2: number): boolean {
  return sameMajorDiagonal(sq1, sq2) || sameMinorDiagonal(sq1, sq2)
}

export function diagonalOffset(
  fromSquare: number,
  toSquare: number,
): number | undefined {
  const fileDiff = file(toSquare) - file(fromSquare)
  const rankDiff = rank(fromSquare) - rank(toSquare)

  if (Math.abs(fileDiff) !== Math.abs(rankDiff)) return
  if (fileDiff === 0) return 0

  return Math.sign(fileDiff) + (rankDiff > 0 ? -16 : 16)
}

export function linearOffset(
  fromSquare: number,
  toSquare: number,
): number | undefined {
  const toFile = file(toSquare)
  const fromFile = file(fromSquare)
  const toRank = rank(toSquare)
  const fromRank = rank(fromSquare)
  if (toRank === fromRank) {
    if (toFile === fromFile) return 0
    return toFile > fromFile ? 1 : -1
  }
  if (toFile === fromFile) {
    if (toRank === fromRank) return 0
    return toRank > fromRank ? 16 : -16
  }
  return
}

/**
 * Converts a 0x88 square to algebraic notation.
 * @public
 */
export function algebraic(i: number): Square | undefined {
  const f = file(i)
  const r = rank(i)
  return toSquare(
    'abcdefgh'.substring(f, f + 1) + '87654321'.substring(r, r + 1),
  )
}

/**
 * Returns the opposite color.
 */
export function swapColor(c: Color): Color {
  return c === WHITE ? BLACK : WHITE
}

/**
 * Checks if a character is a numeric digit.
 */
export function isDigit(c: string): boolean {
  return /^[0-9]$/.test(c)
}

/**
 * Returns the ASCII symbol for each piece.  White pieces are in uppercase,
 * black in lowercase.
 */
export function symbol({ type, color }: Piece): string {
  return color === WHITE ? type.toUpperCase() : type.toLowerCase()
}

/** @public */
export function isColor(color: string): color is Color {
  return color === 'w' || color === 'b'
}

/** @public */
export function isPieceSymbol(symbol: string): symbol is PieceSymbol {
  return /^[pnbrqk]$/.test(symbol)
}

export function toPieceSymbol(obj: unknown): PieceSymbol | undefined {
  if (typeof obj == 'string') {
    const str = obj.toLowerCase()
    if (isPieceSymbol(str)) return str
  }
  return
}

/** @public */
export function isSquare(sq: string): sq is Square {
  return /^[a-h][1-8]$/.test(sq)
}

export function toSquare(obj: unknown): Square | undefined {
  if (typeof obj == 'string') {
    const str = obj.toLowerCase()
    if (isSquare(str)) return str
  }
  return
}

export function bitToSquare(sq: number): number {
  if (sq === -1) return -1
  return (sq & 7) + 16 * (sq >> 3)
}

export function squareToBit(sq: number): number {
  if (sq === -1) return -1
  const row = Math.floor(sq / 16)
  const column = sq % 8
  return row * 8 + column
}

export function getBitIndices(n: bigint, first = false): number[] {
  const indices = []
  let pos = 0
  let cur = n

  while (cur > BigInt(0)) {
    if (cur & BigInt(1)) {
      indices.push(pos)
      if (first) return indices
    }
    cur >>= BigInt(1)
    pos++
  }
  return indices
}

export function isFlagKey(key: string): key is FlagKey {
  const keys = [
    'NORMAL',
    'CAPTURE',
    'BIG_PAWN',
    'EP_CAPTURE',
    'PROMOTION',
    'KSIDE_CASTLE',
    'QSIDE_CASTLE',
  ]
  return keys.indexOf(key) !== -1
}

export function isDefined<T>(value: T | null | undefined): value is T {
  if (value === null || value === undefined) return false
  return true
}

export function splitStr(str: string, char: string): string[] {
  const index = str.indexOf(char)
  if (index === -1) return []
  return [str.slice(0, index), str.slice(index)]
}
