import { WHITE, BLACK } from "./constants"

/**
 * Extracts the zero-based rank of an 0x88 square.
 */
export function rank(i: number): number {
  return i >> 4
}

/**
 * Extracts the zero-based file of an 0x88 square.
 */
export function file(i: number): number {
  return i & 15
}

/**
 * Converts a 0x88 square to algebraic notation.
 */
export function algebraic(i: number): string {
  const f = file(i)
  const r = rank(i)
  return 'abcdefgh'.substring(f, f + 1) + '87654321'.substring(r, r + 1)
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
 * Deep clones an object
 */
export function clone(obj: any): any {
  const dupe = new (obj.constructor as any);

  for (let property in obj) {
    if (typeof obj[property] === 'object') {
      dupe[property] = clone(obj[property])
    } else {
      dupe[property] = obj[property]
    }
  }
  return dupe
}

/**
 * Returns the ASCII symbol for each piece.  White pieces are in uppercase,
 * black in lowercase.
 */
export function symbol({ type, color }: Piece): string {
  return color === WHITE ? type.toUpperCase() : type.toLowerCase()
}

export function isColor(color: string): color is Color {
  return color === 'w' || color === 'b'
}

export function isPieceSymbol(symbol: string): symbol is PieceSymbol {
  return /^[pnbrqk]$/.test(symbol)
}

export function isSquare(sq: string): sq is Square {
  return /^[a-h][1-8]$/.test(sq)
}

export function isFlagKey(key: string): key is FlagKey {
  const keys = ['NORMAL', 'CAPTURE', 'BIG_PAWN', 'EP_CAPTURE', 'PROMOTION', 'KSIDE_CASTLE', 'QSIDE_CASTLE']
  return keys.indexOf(key) !== -1
}
