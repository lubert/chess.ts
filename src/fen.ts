import { isDigit } from './utils'

export type FenErrorType =
  | 'ONE_FIELD'
  | 'SIX_FIELDS'
  | 'ROWS_LENGTH'
  | 'CONSECUTIVE'
  | 'INVALID_PIECE'
  | 'ROW_TOO_LARGE'
  | 'ACTIVE_COLOR'
  | 'CASTLING'
  | 'EN_PASSANT'
  | 'HALF_MOVE'
  | 'FULL_MOVE'
  | 'KINGS'
  | 'PAWNS'

export function validateFen(
  fen: string,
  options: { positionOnly?: boolean; legal?: boolean } = {},
): Partial<Record<FenErrorType, string>> {
  const { positionOnly, legal } = options
  const errors: Partial<Record<FenErrorType, string>> = {}

  const tokens = fen.split(/\s+/)
  if (positionOnly && tokens.length !== 1) {
    return {
      ONE_FIELD: 'Must contain only one field for position-only validation',
    }
  }

  if (!positionOnly && tokens.length !== 6) {
    return {
      SIX_FIELDS: 'Must contain six space-delimited fields',
    }
  }

  const position = tokens[0]
  const color = tokens[1]
  const castling = tokens[2]
  const enPassant = tokens[3]
  const halfMove = parseInt(tokens[4], 10)
  const moveNumber = parseInt(tokens[5], 10)

  // 1st field: Piece positions
  const rows = position.split('/')
  if (rows.length !== 8) {
    errors.ROWS_LENGTH = "Piece placement does not contain 8 '/'-delimited rows"
  }

  for (let i = 0; i < rows.length; i++) {
    // Check for right sum of fields AND not two numbers in succession
    let sum_fields = 0
    let previous_was_number = false

    for (let k = 0; k < rows[i].length; k++) {
      if (isDigit(rows[i][k])) {
        if (previous_was_number) {
          errors.CONSECUTIVE =
            'Piece placement is invalid (consecutive numbers)'
        }
        sum_fields += parseInt(rows[i][k], 10)
        previous_was_number = true
      } else {
        if (!/^[prnbqkPRNBQK]$/.test(rows[i][k])) {
          errors.INVALID_PIECE = 'Piece placement invalid (invalid piece)'
        }
        sum_fields += 1
        previous_was_number = false
      }
    }
    if (sum_fields !== 8) {
      errors.ROW_TOO_LARGE =
        'Piece placement is invalid (too many squares in rank)'
    }
  }

  if (legal) {
    if (position.split('K').length !== 2 || position.split('k').length !== 2) {
      errors.KINGS = 'Piece placement must contain two kings'
    }

    if (
      Array.from(rows[0] + rows[7]).some((char) => char.toUpperCase() === 'P')
    ) {
      errors.PAWNS =
        'Piece placement must not contain pawns on the first or last rank'
    }
  }

  if (positionOnly) return errors

  // 2nd field: Side to move
  if (!/^(w|b)$/.test(color)) {
    errors.ACTIVE_COLOR = 'Active color is invalid'
  }

  // 3rd field: Castling availability
  if (!/^(KQ?k?q?|Qk?q?|kq?|q|-)$/.test(castling)) {
    errors.CASTLING = 'Castling availability is invalid'
  }

  // 4th field: En passant square
  if (
    (enPassant[1] === '3' && color === 'w') ||
    (enPassant[1] === '6' && color == 'b') ||
    !/^(-|[abcdefgh][36])$/.test(enPassant)
  ) {
    errors.EN_PASSANT = 'En-passant square is invalid'
  }

  // 5th field: Half move clock
  if (isNaN(halfMove) || halfMove < 0) {
    errors.HALF_MOVE = 'Half move clock must be a non-negative integer'
  }

  // 6th field: Full move number
  if (isNaN(moveNumber) || moveNumber <= 0) {
    errors.FULL_MOVE = 'Full move number must be a positive integer'
  }

  return errors
}
