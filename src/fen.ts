/* eslint-disable @typescript-eslint/no-explicit-any */
export type FenErrorType =
  | 'ONE_FIELD'
  | 'SIX_FIELDS'
  | 'ROWS_LENGTH'
  | 'CONSECUTIVE'
  | 'INVALID_PIECE'
  | 'ROW_TOO_LARGE'
  | 'SIDE_TO_MOVE'
  | 'CASTLING'
  | 'EN_PASSANT'
  | 'HALF_MOVE'
  | 'FULL_MOVE'

export function validateFen(
  fen: string,
  positionOnly = false,
): Partial<Record<FenErrorType, string>> {
  const errors: Partial<Record<FenErrorType, string>> = {}

  const tokens = fen.split(/\s+/)
  if (positionOnly && tokens.length !== 1) {
    return {
      ONE_FIELD:
        'FEN must contain exactly one field for position-only validation.',
    }
  }

  if (!positionOnly && tokens.length !== 6) {
    return { SIX_FIELDS: 'FEN must contain six space-delimited fields.' }
  }

  const position = tokens[0]
  const turn = tokens[1]
  const castling = tokens[2]
  const enPassant = tokens[3]
  const halfMove = tokens[4]
  const moveNumber = tokens[5]

  // 1st field: Piece positions
  const rows = position.split('/')
  if (rows.length !== 8) {
    errors.ROWS_LENGTH =
      "1st field (piece positions) must contain 8 '/'-delimited rows."
  }

  for (let i = 0; i < rows.length; i++) {
    // Check for right sum of fields AND not two numbers in succession
    let sum_fields = 0
    let previous_was_number = false

    for (let k = 0; k < rows[i].length; k++) {
      if (!isNaN(rows[i][k] as any)) {
        if (previous_was_number) {
          errors.CONSECUTIVE =
            '1st field (piece positions) is invalid [consecutive numbers].'
        }
        sum_fields += parseInt(rows[i][k], 10)
        previous_was_number = true
      } else {
        if (!/^[prnbqkPRNBQK]$/.test(rows[i][k])) {
          errors.INVALID_PIECE =
            '1st field (piece positions) is invalid [invalid piece].'
        }
        sum_fields += 1
        previous_was_number = false
      }
    }
    if (sum_fields !== 8) {
      errors.ROW_TOO_LARGE =
        '1st field (piece positions) is invalid [row too large].'
    }
  }

  if (positionOnly) return errors

  // 2nd field: Side to move
  if (!/^(w|b)$/.test(turn)) {
    errors.SIDE_TO_MOVE = '2nd field (side to move) is invalid.'
  }

  // 3rd field: Castling availability
  if (!/^(KQ?k?q?|Qk?q?|kq?|q|-)$/.test(castling)) {
    errors.CASTLING = '3rd field (castling availability) is invalid.'
  }

  // 4th field: En passant square
  if (
    (enPassant[1] === '3' && turn === 'w') ||
    (enPassant[1] === '6' && turn == 'b') ||
    !/^(-|[abcdefgh][36])$/.test(enPassant)
  ) {
    errors.EN_PASSANT = '4th field (en-passant square) is invalid.'
  }

  // 5th field: Half move clock
  if (isNaN(halfMove as any) || parseInt(halfMove, 10) < 0) {
    errors.HALF_MOVE =
      '5th field (half move clock) must be a non-negative integer.'
  }

  // 6th field: Full move number
  if (isNaN(moveNumber as any) || parseInt(moveNumber, 10) <= 0) {
    errors.FULL_MOVE =
      '6th field (full move counter) must be a positive integer.'
  }

  return errors
}
