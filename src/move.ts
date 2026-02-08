import { TreeNode } from 'treenode.ts'
import {
  BISHOP,
  BITS,
  BLACK,
  EMPTY,
  FLAGS,
  KING,
  KNIGHT,
  NULL_MOVES,
  PAWN,
  PAWN_OFFSETS,
  PIECE_OFFSETS,
  QUEEN,
  RANK_1,
  RANK_2,
  RANK_7,
  RANK_8,
  ROOK,
  ROOKS,
  SQUARES,
  WHITE,
  PAWN_ATTACK_OFFSETS,
  DIRECTIONS,
  RAYS,
  PIECE_TYPE_NUM,
  NUM_PIECE_TYPE,
  COLOR_NUM,
  PT_PAWN,
  PT_KNIGHT,
  PT_BISHOP,
  PT_ROOK,
  PT_QUEEN,
  PT_KING,
} from './constants'
import {
  Board,
  Color,
  HexMove,
  Piece,
  Move,
  Square,
  PartialMove,
  ParsedMove,
  HexState,
  GameState,
  PieceSymbol,
  BoardState,
  UndoInfo,
} from './interfaces/types'
import {
  algebraic,
  diagonalSquaresBetween,
  file,
  isDigit,
  isFlagKey,
  isPieceSymbol,
  isSquare,
  linearSquaresBetween,
  rank,
  squaresBetween,
  swapColor,
  toPieceSymbol,
  toSquare,
} from './utils'
import { REGEXP_MOVE, REGEXP_NAG } from './regex'
import { validateFen } from './fen'
import { cloneBoardState, defaultBoardState } from './state'

// Scratch buffers to avoid per-call allocations
const _pinBuf = new Int8Array(128)
const _checkMaskBuf = new Uint8Array(128)

const SECOND_RANK: Record<string, number> = { b: RANK_7, w: RANK_2 }
const PROMOTION_PIECES: PieceSymbol[] = [QUEEN, ROOK, BISHOP, KNIGHT]

/** Encode a piece symbol + color into a single byte for Uint8Array board */
export function encodePiece(type: PieceSymbol, color: Color): number {
  return COLOR_NUM[color] | PIECE_TYPE_NUM[type]
}

/** Decode an encoded byte to a Piece object */
export function decodePiece(encoded: number): Piece {
  return {
    type: NUM_PIECE_TYPE[encoded & 7]!,
    color: encoded & 8 ? BLACK : WHITE,
  }
}

/** Extract piece type number from encoded byte (bits 0-2) */
function decodePieceType(encoded: number): number {
  return encoded & 7
}

/** Extract color bit from encoded byte (bit 3) */
function decodePieceColor(encoded: number): number {
  return encoded & 8
}

/* this function is used to uniquely identify ambiguous moves */
export function getDisambiguator(
  move: Readonly<HexMove>,
  moves: HexMove[],
): string {
  const { from, to, piece } = move

  let ambiguities = 0
  let sameRank = 0
  let sameFile = 0

  for (let i = 0, len = moves.length; i < len; i++) {
    const ambigFrom = moves[i].from
    const ambigTo = moves[i].to
    const ambigPiece = moves[i].piece

    /* if a move of the same piece type ends on the same to square, we'll
     * need to add a disambiguator to the algebraic notation
     */
    if (piece === ambigPiece && from !== ambigFrom && to === ambigTo) {
      ambiguities++

      if (rank(from) === rank(ambigFrom)) {
        sameRank++
      }

      if (file(from) === file(ambigFrom)) {
        sameFile++
      }
    }
  }

  if (ambiguities > 0) {
    /* if there exists a similar moving piece on the same rank and file as
     * the move in question, use the square as the disambiguator
     */
    if (sameRank > 0 && sameFile > 0) {
      return algebraic(from) || ''
    } else if (sameFile > 0) {
      /* if the moving piece rests on the same file, use the rank symbol as the
       * disambiguator
       */
      return algebraic(from)?.charAt(1) || ''
    } else {
      /* else use the file symbol */
      return algebraic(from)?.charAt(0) || ''
    }
  }

  return ''
}

export function getFen(state: BoardState, strict = false): string {
  let empty = 0
  let fen = ''

  for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
    const encoded = state.board[i]
    if (!encoded) {
      empty++
    } else {
      if (empty > 0) {
        fen += empty
        empty = 0
      }
      const piece_type = NUM_PIECE_TYPE[encoded & 7]!
      fen += encoded & 8 ? piece_type.toLowerCase() : piece_type.toUpperCase()
    }

    if ((i + 1) & 0x88) {
      if (empty > 0) {
        fen += empty
      }

      if (i !== SQUARES.h1) {
        fen += '/'
      }

      empty = 0
      i += 8
    }
  }

  let cflags = ''
  if (state.castling[WHITE] & BITS.KSIDE_CASTLE) {
    cflags += 'K'
  }
  if (state.castling[WHITE] & BITS.QSIDE_CASTLE) {
    cflags += 'Q'
  }
  if (state.castling[BLACK] & BITS.KSIDE_CASTLE) {
    cflags += 'k'
  }
  if (state.castling[BLACK] & BITS.QSIDE_CASTLE) {
    cflags += 'q'
  }

  /* do we have an empty castling flag? */
  cflags = cflags || '-'

  let epflags = '-'

  if (state.ep_square !== EMPTY) {
    if (strict) {
      /*
       * Set the ep square only if en passant is a valid move (pawn is present
       * and ep capture is not pinned)
       */
      const bigPawnSquare = state.ep_square + (state.turn === WHITE ? 16 : -16)
      const squares = [bigPawnSquare + 1, bigPawnSquare - 1]
      const color = state.turn
      const colorBit = COLOR_NUM[color]

      for (const square of squares) {
        if (square & 0x88) continue
        const sq_encoded = state.board[square]
        // is there a pawn that can capture the epSquare?
        if (
          sq_encoded &&
          decodePieceColor(sq_encoded) === colorBit &&
          decodePieceType(sq_encoded) === PT_PAWN
        ) {
          // if the pawn makes an ep capture, does it leave it's king in check?
          const epUndo = makeMove(state, {
            color,
            from: square,
            to: state.ep_square,
            piece: PAWN,
            captured: PAWN,
            flags: BITS.EP_CAPTURE,
          })

          // if ep is legal, break and set the ep square in the FEN output
          const epLegal = !isKingAttacked(state, color)
          unmakeMove(state, epUndo)
          if (epLegal) {
            epflags = algebraic(state.ep_square) || '-'
            break
          }
        }
      }
    } else {
      //
      epflags = algebraic(state.ep_square) || '-'
    }
  }

  return [
    fen,
    state.turn,
    cflags,
    epflags,
    state.half_moves,
    state.move_number,
  ].join(' ')
}

export function loadFen(
  fen: string,
  options?: { positionOnly?: boolean; legal?: boolean },
): BoardState | null {
  const tokens = fen.split(/\s+/)
  const position = tokens[0]
  let square = 0

  if (Object.keys(validateFen(fen, options)).length) {
    return null
  }

  const state = defaultBoardState()

  for (let i = 0; i < position.length; i++) {
    let piece = position.charAt(i)

    if (piece === '/') {
      square += 8
    } else if (isDigit(piece)) {
      square += parseInt(piece, 10)
    } else {
      const color = piece < 'a' ? WHITE : BLACK
      piece = piece.toLowerCase()
      if (!isPieceSymbol(piece)) return null

      state.board[square] = encodePiece(piece, color)
      if (piece === KING) {
        state.kings[color] = square
      }
      square++
    }
  }

  state.turn = tokens[1] === BLACK ? BLACK : WHITE

  if (tokens[2].indexOf('K') > -1) {
    state.castling.w |= BITS.KSIDE_CASTLE
  }
  if (tokens[2].indexOf('Q') > -1) {
    state.castling.w |= BITS.QSIDE_CASTLE
  }
  if (tokens[2].indexOf('k') > -1) {
    state.castling.b |= BITS.KSIDE_CASTLE
  }
  if (tokens[2].indexOf('q') > -1) {
    state.castling.b |= BITS.QSIDE_CASTLE
  }

  state.ep_square = tokens[3] === '-' ? EMPTY : SQUARES[tokens[3] as Square]
  state.half_moves = parseInt(tokens[4], 10)
  state.move_number = parseInt(tokens[5], 10)

  return state
}

export function getPiece(
  state: Readonly<BoardState>,
  square: Square | number,
): Piece | null {
  if (typeof square === 'string') {
    square = SQUARES[square]
  }
  const encoded = state.board[square]
  if (encoded) return decodePiece(encoded)
  return null
}

export function cloneMove(move: Readonly<HexMove>): HexMove {
  return {
    to: move.to,
    from: move.from,
    color: move.color,
    flags: move.flags,
    piece: move.piece,
    san: move.san,
    captured: move.captured,
    promotion: move.promotion,
  }
}

export function clonePiece(piece: Readonly<Piece>): Piece {
  return {
    color: piece.color,
    type: piece.type,
  }
}

export function putPiece(
  prevState: Readonly<BoardState>,
  piece: Piece,
  square: Square,
): BoardState | null {
  const state = cloneBoardState(prevState)
  // Don't allow placing more than one king
  const sq = SQUARES[square]
  if (
    piece.type === KING &&
    state.kings[piece.color] !== EMPTY &&
    state.kings[piece.color] !== sq
  ) {
    return null
  }

  state.board[sq] = encodePiece(piece.type, piece.color)
  if (piece.type === KING) {
    state.kings[piece.color] = sq
  }

  return state
}

export function removePiece(
  prevState: Readonly<BoardState>,
  square: Square | number,
): BoardState | null {
  if (typeof square === 'string') {
    square = SQUARES[square]
  }
  const encoded = prevState.board[square]
  if (!encoded) return null

  const state = cloneBoardState(prevState)
  const type = NUM_PIECE_TYPE[encoded & 7]!
  const color: Color = encoded & 8 ? BLACK : WHITE
  if (type === KING) {
    state.kings[color] = EMPTY
  }
  state.board[square] = 0
  return state
}

export function isLegal(state: BoardState, move: HexMove): boolean {
  const us = state.turn
  const undo = makeMove(state, move)
  const legal = !isKingAttacked(state, us)
  unmakeMove(state, undo)
  return legal
}

type PositionInfo = {
  pins: Int8Array // 128-element array: 0 = unpinned, nonzero = pin direction offset
  checkerCount: number // 0, 1, or 2
  checkerSq: number // square of first checker (-1 if none)
  checkerRay: number // direction from king to checker (0 if knight/pawn)
}

/**
 * Compute pin and check information in one pass from the king.
 * @internal
 */
function computePositionInfo(state: Readonly<BoardState>): PositionInfo {
  const us = state.turn
  const usBit = COLOR_NUM[us]
  const themBit = usBit ^ 8
  const kingSq = state.kings[us]
  const pins = _pinBuf
  pins.fill(0)
  let checkerCount = 0
  let checkerSq = -1
  let checkerRay = 0

  // Walk each of 8 ray directions from king square
  for (let i = 0; i < 8; i++) {
    const dir = DIRECTIONS[i]
    let friendlySq = -1
    let sq = kingSq + dir

    while ((sq & 0x88) === 0) {
      const p = state.board[sq]
      if (p) {
        if (decodePieceColor(p) === usBit) {
          if (friendlySq === -1) {
            // First friendly piece on this ray
            friendlySq = sq
          } else {
            // Second friendly piece — no pin possible on this ray
            break
          }
        } else {
          // Enemy piece — check if it's a slider matching this ray direction
          const pt = decodePieceType(p)
          const isRookLike = pt === PT_ROOK || pt === PT_QUEEN
          const isBishopLike = pt === PT_BISHOP || pt === PT_QUEEN
          const matchesRay = i < 4 ? isRookLike : isBishopLike

          if (matchesRay) {
            if (friendlySq !== -1) {
              // Friendly piece in between → it's pinned along this direction
              pins[friendlySq] = dir
            } else {
              // No piece in between → this is a checker
              checkerCount++
              if (checkerCount === 1) {
                checkerSq = sq
                checkerRay = dir
              }
            }
          }
          break
        }
      }
      sq += dir
    }
  }

  // Check for knight attacks
  if (checkerCount < 2) {
    const knightOffsets = PIECE_OFFSETS[KNIGHT]
    for (let i = 0; i < knightOffsets.length; i++) {
      const sq = kingSq + knightOffsets[i]
      if (sq & 0x88) continue
      const p = state.board[sq]
      if (
        p &&
        decodePieceColor(p) === themBit &&
        decodePieceType(p) === PT_KNIGHT
      ) {
        checkerCount++
        if (checkerCount === 1) {
          checkerSq = sq
          checkerRay = 0 // knight, no ray
        }
        break // at most one knight can check from a given square
      }
    }
  }

  // Check for pawn attacks (use them's offsets to find enemy pawns attacking our king)
  if (checkerCount < 2) {
    const them = swapColor(us)
    const pawnOffsets = PAWN_ATTACK_OFFSETS[them]
    for (let i = 0; i < pawnOffsets.length; i++) {
      const sq = kingSq + pawnOffsets[i]
      if (sq & 0x88) continue
      const p = state.board[sq]
      if (
        p &&
        decodePieceColor(p) === themBit &&
        decodePieceType(p) === PT_PAWN
      ) {
        checkerCount++
        if (checkerCount === 1) {
          checkerSq = sq
          checkerRay = 0 // pawn, no ray
        }
        break // at most one pawn can check per offset
      }
    }
  }

  return { pins, checkerCount, checkerSq, checkerRay }
}

/**
 * Check if a move stays along the pin ray.
 * A pinned piece can move toward or away from the pinner.
 * Uses the RAYS lookup table: RAYS[to - from + 119] gives the direction
 * offset from `from` to `to` (or 0 if they are not on the same line).
 * @internal
 */
function canMoveAlongPin(pinDir: number, from: number, to: number): boolean {
  const ray = RAYS[to - from + 119]
  return ray === pinDir || ray === -pinDir
}

/**
 * When in single check, compute a mask of valid destination squares.
 * A non-king piece can either capture the checker or interpose on the ray.
 * @internal
 */
function computeCheckMask(
  checkerSq: number,
  checkerRay: number,
  kingSq: number,
): Uint8Array {
  const mask = _checkMaskBuf
  mask.fill(0)
  // Can always capture the checker
  mask[checkerSq] = 1

  // If sliding check, interposition squares are valid
  if (checkerRay !== 0) {
    let sq = kingSq + checkerRay
    while (sq !== checkerSq) {
      mask[sq] = 1
      sq += checkerRay
    }
  }

  return mask
}

/**
 * Return all moves for a given board state.
 * @param options.legal[=true] - Filter by legal moves
 * @param options.piece - Filter by piece type
 * @param options.from - Filter by initial square
 * @param options.to - Filter by target square
 * @public
 */
export function generateMoves(
  state: BoardState,
  options: {
    legal?: boolean
    piece?: PieceSymbol
    from?: Square | number
    to?: Square | number
  } = {},
): HexMove[] {
  const { legal = true, piece: forPiece, from, to } = options

  const moves: HexMove[] = []

  const them = swapColor(state.turn)
  const usBit = COLOR_NUM[state.turn]
  const themBit = usBit ^ 8
  const second_rank = SECOND_RANK
  const kingSq = state.kings[state.turn]

  // Parse from/to filters early so the double-check path can use them
  let firstSq = SQUARES.a8
  let lastSq = SQUARES.h1

  let forSquare: number | undefined
  if (from) {
    if (typeof from === 'number') {
      forSquare = from
      if (forSquare & 0x88) return []
    } else {
      forSquare = SQUARES[from]
    }
    firstSq = lastSq = forSquare
  }

  let toSquare: number | undefined
  if (to) {
    if (typeof to === 'number') {
      toSquare = to
    } else {
      toSquare = SQUARES[to]
    }
  }

  // Compute pin/check info upfront for legal move generation
  let posInfo: PositionInfo | null = null
  let checkMask: Uint8Array | null = null
  let doubleCheck = false

  if (legal) {
    posInfo = computePositionInfo(state)

    // Double check: only king moves are legal
    if (posInfo.checkerCount >= 2) {
      if (forPiece !== undefined && forPiece !== KING) return []
      if (forSquare !== undefined && forSquare !== kingSq) return []
      doubleCheck = true
    }

    // Single check: compute check mask for non-king pieces
    if (posInfo.checkerCount === 1) {
      checkMask = computeCheckMask(
        posInfo.checkerSq,
        posInfo.checkerRay,
        kingSq,
      )
    }
  }

  const addMove = (
    piece: PieceSymbol,
    from: number,
    to: number,
    flags: number,
    captured?: PieceSymbol,
  ) => {
    // Check for illegal moves
    if (from & 0x88 || to & 0x88) return
    // Pawn promotion
    const r = rank(to)
    if (piece === PAWN && (r === RANK_8 || r === RANK_1)) {
      const promotions = PROMOTION_PIECES
      promotions.forEach((promotion) => {
        moves.push({
          piece,
          color: state.turn,
          from,
          to,
          captured,
          promotion,
          flags: flags | BITS.PROMOTION,
        })
      })
    } else {
      moves.push({
        piece,
        color: state.turn,
        from,
        to,
        captured,
        flags,
      })
    }
  }

  // Returns true if a non-king move to toSq is legal given the current
  // check mask and pin direction. When posInfo is null (legal: false),
  // always returns true.
  const isLegalDest = (toSq: number, pinDir: number, fromSq: number) =>
    !posInfo ||
    ((!checkMask || checkMask[toSq]) &&
      (!pinDir || canMoveAlongPin(pinDir, fromSq, toSq)))

  // In double check, skip non-king piece generation entirely
  if (!doubleCheck) {
    for (let fromSq = firstSq; fromSq <= lastSq; fromSq++) {
      // Check if we ran off the end of the board
      if (fromSq & 0x88) {
        fromSq += 7
        continue
      }

      const encoded = state.board[fromSq]
      if (!encoded || decodePieceColor(encoded) !== usBit) continue

      const pt = decodePieceType(encoded)
      const symbol = NUM_PIECE_TYPE[pt]!
      if (forPiece && forPiece !== symbol) continue

      // King moves handled separately below
      if (pt === PT_KING) continue

      // For non-king pieces with legal filtering
      const pinDir = posInfo ? posInfo.pins[fromSq] : 0

      let toSq: number
      if (pt === PT_PAWN) {
        // Single square, non-capturing
        toSq = fromSq + PAWN_OFFSETS[state.turn][0]
        if (!state.board[toSq]) {
          if (toSquare === undefined || toSquare === toSq) {
            if (isLegalDest(toSq, pinDir, fromSq)) {
              addMove(PAWN, fromSq, toSq, BITS.NORMAL)
            }
          }

          // Double square
          toSq = fromSq + PAWN_OFFSETS[state.turn][1]
          if (
            second_rank[state.turn] === rank(fromSq) &&
            !state.board[toSq] &&
            (toSquare === undefined || toSquare === toSq)
          ) {
            if (isLegalDest(toSq, pinDir, fromSq)) {
              addMove(PAWN, fromSq, toSq, BITS.BIG_PAWN)
            }
          }
        }

        // Pawn captures
        for (let j = 2; j < 4; j++) {
          toSq = fromSq + PAWN_OFFSETS[state.turn][j]
          if (toSq & 0x88) continue
          if (toSquare !== undefined && toSq !== toSquare) continue

          const p = state.board[toSq]
          if (p && decodePieceColor(p) === themBit) {
            if (isLegalDest(toSq, pinDir, fromSq)) {
              addMove(PAWN, fromSq, toSq, BITS.CAPTURE, NUM_PIECE_TYPE[p & 7]!)
            }
          } else if (toSq === state.ep_square) {
            // En passant — special case: pin detection alone can miss
            // horizontal discovered checks when both pawns leave the same rank.
            // Fall back to isLegal for en passant moves.
            if (!posInfo) {
              addMove(PAWN, fromSq, state.ep_square, BITS.EP_CAPTURE, PAWN)
            } else {
              // In single check, EP can resolve by either:
              //   1. Landing on an interposition square (toSq in checkMask), or
              //   2. Capturing the checking pawn (capturedPawnSq in checkMask).
              // Skip only if neither square resolves the check.
              const capturedPawnSq =
                state.ep_square + (state.turn === WHITE ? 16 : -16)
              if (checkMask && !checkMask[toSq] && !checkMask[capturedPawnSq]) {
                continue
              }
              if (pinDir && !canMoveAlongPin(pinDir, fromSq, toSq)) {
                continue
              }
              // Fall back to make/unmake check for en passant
              // to catch horizontal discovered checks
              const epMove: HexMove = {
                piece: PAWN,
                color: state.turn,
                from: fromSq,
                to: state.ep_square,
                captured: PAWN,
                flags: BITS.EP_CAPTURE,
              }
              if (isLegal(state, epMove)) {
                addMove(PAWN, fromSq, state.ep_square, BITS.EP_CAPTURE, PAWN)
              }
            }
          }
        }
      } else {
        // Non-king, non-pawn pieces
        // Pinned knight can never move
        if (posInfo && pinDir && pt === PT_KNIGHT) continue

        for (let j = 0, len = PIECE_OFFSETS[symbol].length; j < len; j++) {
          const offset = PIECE_OFFSETS[symbol][j]
          toSq = fromSq

          while (true) {
            toSq += offset
            if (toSq & 0x88) break

            const p = state.board[toSq]
            if (!p) {
              if (toSquare === undefined || toSquare === toSq) {
                if (isLegalDest(toSq, pinDir, fromSq)) {
                  addMove(symbol, fromSq, toSq, BITS.NORMAL)
                }
              }
            } else {
              if (decodePieceColor(p) === usBit) break
              if (toSquare === undefined || toSquare === toSq) {
                if (isLegalDest(toSq, pinDir, fromSq)) {
                  addMove(
                    symbol,
                    fromSq,
                    toSq,
                    BITS.CAPTURE,
                    NUM_PIECE_TYPE[p & 7]!,
                  )
                }
              }
              break
            }

            // Break if knight (king is handled separately)
            if (pt === PT_KNIGHT) break
          }
        }
      }
    }
  }

  // Generate king moves (including castling)
  if (forPiece === undefined || forPiece === KING) {
    if (forSquare === undefined || forSquare === kingSq) {
      // Normal king moves
      for (let j = 0; j < PIECE_OFFSETS[KING].length; j++) {
        const offset = PIECE_OFFSETS[KING][j]
        const toSq = kingSq + offset
        if (toSq & 0x88) continue
        if (toSquare !== undefined && toSq !== toSquare) continue

        const p = state.board[toSq]
        if (p && decodePieceColor(p) === usBit) continue

        if (posInfo ? !isAttacked(state, toSq, them, kingSq) : true) {
          if (p) {
            addMove(KING, kingSq, toSq, BITS.CAPTURE, NUM_PIECE_TYPE[p & 7]!)
          } else {
            addMove(KING, kingSq, toSq, BITS.NORMAL)
          }
        }
      }

      // Castling — skip entirely if in check
      // When posInfo is set, checkerCount === 0 is already guaranteed by the
      // guard, so we can skip the redundant isAttacked(kingSq) call.
      if (!posInfo || posInfo.checkerCount === 0) {
        const notInCheck = posInfo ? true : !isAttacked(state, kingSq)

        if (notInCheck) {
          // King-side castling
          if (state.castling[state.turn] & BITS.KSIDE_CASTLE) {
            const castlingTo = kingSq + 2

            if (
              (toSquare === undefined || toSquare === castlingTo) &&
              !state.board[kingSq + 1] &&
              !state.board[castlingTo] &&
              !isAttacked(state, kingSq + 1) &&
              !isAttacked(state, castlingTo)
            ) {
              addMove(KING, kingSq, castlingTo, BITS.KSIDE_CASTLE)
            }
          }

          // Queen-side castling
          if (state.castling[state.turn] & BITS.QSIDE_CASTLE) {
            const castlingTo = kingSq - 2

            if (
              (toSquare === undefined || toSquare === castlingTo) &&
              !state.board[kingSq - 1] &&
              !state.board[kingSq - 2] &&
              !state.board[kingSq - 3] &&
              !isAttacked(state, kingSq - 1) &&
              !isAttacked(state, castlingTo)
            ) {
              addMove(KING, kingSq, castlingTo, BITS.QSIDE_CASTLE)
            }
          }
        }
      }
    }
  }

  return moves
}

/**
 * Returns true if the side to move has at least one legal move.
 * @internal
 */
function hasLegalMove(state: Readonly<BoardState>): boolean {
  const usBit = COLOR_NUM[state.turn]
  const themBit = usBit ^ 8
  const them = swapColor(state.turn)
  const kingSq = state.kings[state.turn]

  const posInfo = computePositionInfo(state)

  // Double check: only king moves are legal
  if (posInfo.checkerCount >= 2) {
    for (let j = 0; j < PIECE_OFFSETS[KING].length; j++) {
      const toSq = kingSq + PIECE_OFFSETS[KING][j]
      if (toSq & 0x88) continue
      const p = state.board[toSq]
      if (p && decodePieceColor(p) === usBit) continue
      if (!isAttacked(state, toSq, them, kingSq)) return true
    }
    return false
  }

  const checkMask =
    posInfo.checkerCount === 1
      ? computeCheckMask(posInfo.checkerSq, posInfo.checkerRay, kingSq)
      : null

  // Non-king pieces
  for (let fromSq = SQUARES.a8; fromSq <= SQUARES.h1; fromSq++) {
    if (fromSq & 0x88) {
      fromSq += 7
      continue
    }

    const encoded = state.board[fromSq]
    if (!encoded || decodePieceColor(encoded) !== usBit) continue

    const pt = decodePieceType(encoded)
    if (pt === PT_KING) continue

    const pinDir = posInfo.pins[fromSq]

    if (pt === PT_PAWN) {
      // Single push
      const toSq1 = fromSq + PAWN_OFFSETS[state.turn][0]
      if (!state.board[toSq1]) {
        if (!checkMask || checkMask[toSq1]) {
          if (!pinDir || canMoveAlongPin(pinDir, fromSq, toSq1)) return true
        }
        // Double push
        if (SECOND_RANK[state.turn] === rank(fromSq)) {
          const toSq2 = fromSq + PAWN_OFFSETS[state.turn][1]
          if (!state.board[toSq2]) {
            if (!checkMask || checkMask[toSq2]) {
              if (!pinDir || canMoveAlongPin(pinDir, fromSq, toSq2)) return true
            }
          }
        }
      }
      // Pawn captures
      for (let j = 2; j < 4; j++) {
        const toSq = fromSq + PAWN_OFFSETS[state.turn][j]
        if (toSq & 0x88) continue
        const p = state.board[toSq]
        if (p && decodePieceColor(p) === themBit) {
          if (!checkMask || checkMask[toSq]) {
            if (!pinDir || canMoveAlongPin(pinDir, fromSq, toSq)) return true
          }
        } else if (toSq === state.ep_square) {
          const capturedPawnSq =
            state.ep_square + (state.turn === WHITE ? 16 : -16)
          if (checkMask && !checkMask[toSq] && !checkMask[capturedPawnSq])
            continue
          if (pinDir && !canMoveAlongPin(pinDir, fromSq, toSq)) continue
          const epMove: HexMove = {
            piece: PAWN,
            color: state.turn,
            from: fromSq,
            to: state.ep_square,
            captured: PAWN,
            flags: BITS.EP_CAPTURE,
          }
          if (isLegal(state, epMove)) return true
        }
      }
    } else {
      // Non-king, non-pawn
      if (pinDir && pt === PT_KNIGHT) continue
      const symbol = NUM_PIECE_TYPE[pt]!
      for (let j = 0, len = PIECE_OFFSETS[symbol].length; j < len; j++) {
        const offset = PIECE_OFFSETS[symbol][j]
        let toSq = fromSq + offset
        while (!(toSq & 0x88)) {
          const p = state.board[toSq]
          if (!p) {
            if (!checkMask || checkMask[toSq]) {
              if (!pinDir || canMoveAlongPin(pinDir, fromSq, toSq)) return true
            }
          } else {
            if (decodePieceColor(p) !== usBit) {
              if (!checkMask || checkMask[toSq]) {
                if (!pinDir || canMoveAlongPin(pinDir, fromSq, toSq))
                  return true
              }
            }
            break
          }
          if (pt === PT_KNIGHT) break
          toSq += offset
        }
      }
    }
  }

  // King moves
  for (let j = 0; j < PIECE_OFFSETS[KING].length; j++) {
    const toSq = kingSq + PIECE_OFFSETS[KING][j]
    if (toSq & 0x88) continue
    const p = state.board[toSq]
    if (p && decodePieceColor(p) === usBit) continue
    if (!isAttacked(state, toSq, them, kingSq)) return true
  }

  // Castling (only if not in check)
  if (posInfo.checkerCount === 0) {
    if (state.castling[state.turn] & BITS.KSIDE_CASTLE) {
      if (
        !state.board[kingSq + 1] &&
        !state.board[kingSq + 2] &&
        !isAttacked(state, kingSq + 1) &&
        !isAttacked(state, kingSq + 2)
      )
        return true
    }
    if (state.castling[state.turn] & BITS.QSIDE_CASTLE) {
      if (
        !state.board[kingSq - 1] &&
        !state.board[kingSq - 2] &&
        !state.board[kingSq - 3] &&
        !isAttacked(state, kingSq - 1) &&
        !isAttacked(state, kingSq - 2)
      )
        return true
    }
  }

  return false
}

/*
 * Convert a move from 0x88 coordinates to Standard Algebraic Notation (SAN)
 * @public
 */
export function moveToSan(
  state: BoardState,
  move: HexMove,
  moves: HexMove[] = generateMoves(state, { piece: move.piece }),
  options: { addPromotion?: boolean } = {},
): string {
  const { addPromotion = true } = options

  // Handle null moves
  if (move.flags & BITS.NULL_MOVE) {
    return '--'
  }

  let output = ''

  if (move.flags & BITS.KSIDE_CASTLE) {
    output = 'O-O'
  } else if (move.flags & BITS.QSIDE_CASTLE) {
    output = 'O-O-O'
  } else {
    if (move.piece !== PAWN) {
      output += move.piece.toUpperCase() + getDisambiguator(move, moves)
    }

    if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
      if (move.piece === PAWN) {
        output += algebraic(move.from)?.[0] || ''
      }
      output += 'x'
    }

    output += algebraic(move.to)

    if (move.promotion && addPromotion) {
      output += '=' + move.promotion.toUpperCase()
    }
  }

  const undo = makeMove(state, move)
  if (inCheck(state)) {
    if (inCheckmate(state)) {
      move.flags |= BITS.CHECKMATE
      output += '#'
    } else {
      move.flags |= BITS.CHECK
      output += '+'
    }
  }
  unmakeMove(state, undo)

  return output
}

// Convert file charCode (97-104) and rank charCode (49-56) to 0x88 index
function sqIdx(fc: number, rc: number): number {
  return fc - 97 + (56 - rc) * 16
}

function extractMove(move: string): ParsedMove {
  const len = move.length
  if (len < 2) return {}

  let i = 0
  let piece: PieceSymbol | undefined
  let disambiguator: number | undefined // charCode of disambiguator char
  let fromIdx: number | undefined
  let toIdx: number | undefined
  let promotion: PieceSymbol | undefined
  let check: string | undefined

  const c0 = move.charCodeAt(0)

  // Piece letter: NBRQK (not P — pawn has no prefix in SAN)
  if (
    c0 === 78 ||
    c0 === 66 ||
    c0 === 82 ||
    c0 === 81 ||
    c0 === 75 // N,B,R,Q,K
  ) {
    piece = move[0].toLowerCase() as PieceSymbol
    i = 1

    const c1 = move.charCodeAt(1)
    // Check for disambiguator or 'x'
    if (c1 >= 97 && c1 <= 104) {
      // [a-h]
      const c2 = move.charCodeAt(2)
      if (c2 >= 49 && c2 <= 56) {
        // [1-8]: could be "to" or "from"
        const c3 = move.charCodeAt(3)
        if (c3 === 120) {
          // 'x': this is from square, e.g. Re1xd1
          fromIdx = sqIdx(c1, c2)
          i = 4
        } else if (c3 >= 97 && c3 <= 104) {
          // another [a-h]: this is from square, e.g. Rc1c4
          fromIdx = sqIdx(c1, c2)
          i = 3
        } else {
          // Just piece + to, e.g. Nf3
          i = 1
        }
      } else if (c2 === 120) {
        // 'x' after file disambiguator, e.g. Nxe5 or Raxd1
        disambiguator = c1
        i = 3
      } else if (c2 >= 97 && c2 <= 104) {
        // file disambiguator + file, e.g. Rae1
        disambiguator = c1
        i = 2
      } else {
        i = 1
      }
    } else if (c1 >= 49 && c1 <= 56) {
      // [1-8] rank disambiguator, e.g. N1e3
      const c2 = move.charCodeAt(2)
      if (c2 === 120) {
        disambiguator = c1
        i = 3
      } else {
        disambiguator = c1
        i = 2
      }
    } else if (c1 === 120) {
      // 'x' capture, e.g. Nxe5
      i = 2
    }

    // Now parse target square [a-h][1-8]
    const cf = move.charCodeAt(i)
    const cr = move.charCodeAt(i + 1)
    if (cf >= 97 && cf <= 104 && cr >= 49 && cr <= 56) {
      toIdx = sqIdx(cf, cr)
      i += 2
    }
  } else if (c0 >= 97 && c0 <= 104) {
    // Pawn move: starts with [a-h]
    const c1 = move.charCodeAt(1)
    if (c1 >= 49 && c1 <= 56) {
      // [a-h][1-8] — pawn push or could be from-square in long algebraic
      const c2 = move.charCodeAt(2)
      if (
        c2 === 120 ||
        c2 === 45 || // 'x' or '-'
        (c2 >= 97 && c2 <= 104) // another file (long algebraic without separator)
      ) {
        // This is a from-square (e.g. e2-e4, e2e4, e7xd8)
        fromIdx = sqIdx(c0, c1)
        i = c2 === 120 || c2 === 45 ? 3 : 2
        const cf = move.charCodeAt(i)
        const cr = move.charCodeAt(i + 1)
        if (cf >= 97 && cf <= 104 && cr >= 49 && cr <= 56) {
          toIdx = sqIdx(cf, cr)
          i += 2
        }
      } else {
        // Simple pawn push e.g. e4
        toIdx = sqIdx(c0, c1)
        i = 2
      }
    } else if (c1 === 120) {
      // Pawn capture: exd5
      disambiguator = c0
      i = 2
      const cf = move.charCodeAt(i)
      const cr = move.charCodeAt(i + 1)
      if (cf >= 97 && cf <= 104 && cr >= 49 && cr <= 56) {
        toIdx = sqIdx(cf, cr)
        i += 2
      }
    }

    // Promotion: =Q or just Q after to-square
    if (i < len) {
      let pi = i
      if (move.charCodeAt(pi) === 61) pi++ // '='
      const pc = move.charCodeAt(pi)
      if (
        pc === 113 ||
        pc === 114 ||
        pc === 98 ||
        pc === 110 || // q,r,b,n
        pc === 81 ||
        pc === 82 ||
        pc === 66 ||
        pc === 78 // Q,R,B,N
      ) {
        promotion = move[pi].toLowerCase() as PieceSymbol
        i = pi + 1
      }
    }
  } else {
    // Castling or unparseable — fall back to regex
    const cleaned = move.replace(REGEXP_NAG, '')
    const matches: Partial<RegExpMatchArray> | null = cleaned.match(REGEXP_MOVE)
    if (!matches) return {}
    const mTo = toSquare(matches[3])
    return {
      san: matches[0]?.replace(/=([qrbn])/, (c) => c.toUpperCase()),
      piece: toPieceSymbol(matches[1]),
      disambiguator:
        matches[2] && matches[2].length === 1
          ? matches[2].charCodeAt(0)
          : undefined,
      from:
        matches[2] && matches[2].length === 2
          ? toSquare(matches[2])
          : undefined,
      fromIdx:
        matches[2] && matches[2].length === 2
          ? SQUARES[matches[2] as Square]
          : undefined,
      to: mTo,
      toIdx: mTo ? SQUARES[mTo] : undefined,
      promotion: matches[4] ? toPieceSymbol(matches[4]) : undefined,
      check: matches[5],
    }
  }

  // Check indicator (+, #) — skip past any NAG chars (!?)
  while (i < len) {
    const c = move.charCodeAt(i)
    if (c === 43 || c === 35) {
      // '+' or '#'
      check = move[i]
      break
    }
    if (c !== 33 && c !== 63) break // not '!' or '?'
    i++
  }

  return { piece, disambiguator, fromIdx, toIdx, promotion, check }
}

function inferSquare(
  san: string,
  state: Readonly<BoardState>,
): Square | undefined {
  const matches = san.match(/[a-h][1-8]/g)
  if (matches && matches.length) {
    const square = matches[matches.length - 1]
    if (square in SQUARES) return square as Square
  }
  if (san === 'O-O') return state.turn === WHITE ? 'g1' : 'g8'
  if (san === 'O-O-O') return state.turn === WHITE ? 'c1' : 'c8'
}

function inferPieceType(san: string) {
  let pieceType = san.charAt(0)
  if (pieceType >= 'a' && pieceType <= 'h') {
    const matches = san.match(/[a-h]\d.*[a-h]\d/)
    if (matches) {
      return undefined
    }
    return PAWN
  }
  pieceType = pieceType.toLowerCase()
  if (pieceType === 'o') {
    return KING
  }
  return pieceType as PieceSymbol
}

function strippedSan(move: string) {
  return move.replace(/=/, '').replace(/[+#]?[?!]*$/, '')
}

export function sanToMove(
  state: BoardState,
  move: string,
  options: {
    strict?: boolean
    matchPromotion?: boolean
    skipSan?: boolean
  } = {},
): HexMove | null {
  const { strict, matchPromotion = true, skipSan } = options

  // Handle null moves (pass)
  if (NULL_MOVES.includes(move)) {
    // Null moves not allowed when in check
    if (inCheck(state)) {
      return null
    }
    // Return a null move - king "passes" (from/to are the king's current square)
    const kingSquare = state.kings[state.turn]
    return {
      from: kingSquare,
      to: kingSquare,
      color: state.turn,
      piece: KING,
      flags: BITS.NULL_MOVE,
      san: '--',
    }
  }

  // Parse the SAN into structured components (one regex pass)
  const parsed = extractMove(move)

  // Derive piece type and target square from parsed result
  const isCastling = move[0] === 'O' || move[0] === '0'
  let pieceType: PieceSymbol | undefined
  let toSq: Square | number | undefined
  if (isCastling) {
    pieceType = KING
    toSq =
      move.includes('O-O-O') || move.includes('0-0-0')
        ? state.turn === WHITE
          ? SQUARES.c1
          : SQUARES.c8
        : state.turn === WHITE
          ? SQUARES.g1
          : SQUARES.g8
  } else if (parsed.piece) {
    pieceType = parsed.piece
    toSq = parsed.toIdx
  } else if (parsed.toIdx !== undefined) {
    // No piece specified: pawn if no full from-square (e.g. "e4", "exd5"),
    // otherwise leave undefined for long algebraic like "e2-e4"
    pieceType = parsed.fromIdx !== undefined ? undefined : PAWN
    toSq = parsed.toIdx
  } else {
    // extractMove couldn't parse — fall through to legacy path
    pieceType = inferPieceType(strippedSan(move))
    toSq = inferSquare(strippedSan(move), state)
  }
  let moves = generateMoves(state, { piece: pieceType, to: toSq })

  // Structural matching: match against candidate moves
  // without converting back to SAN via moveToSan.
  // Skip for castling moves — extractMove doesn't parse them usefully.
  if (moves.length > 0 && !isCastling) {
    const pToIdx = parsed.toIdx
    const pFromIdx = parsed.fromIdx
    const pDisambig = parsed.disambiguator
    let candidates: HexMove[] = []

    // Single-pass filter instead of chained .filter() calls
    for (let i = 0, len = moves.length; i < len; i++) {
      const m = moves[i]
      if (
        matchPromotion &&
        parsed.promotion &&
        m.promotion !== parsed.promotion
      )
        continue
      if (pToIdx !== undefined && m.to !== pToIdx) continue
      if (pFromIdx !== undefined) {
        if (m.from !== pFromIdx) continue
      } else if (pDisambig !== undefined) {
        // File disambiguator: 'a'-'h' (97-104), rank: '1'-'8' (49-56)
        if (
          pDisambig >= 97
            ? (m.from & 7) !== pDisambig - 97
            : m.from >> 4 !== 56 - pDisambig
        )
          continue
      }
      candidates.push(m)
    }

    // Validate check indicator if present — reject if PGN says check but move doesn't give check
    if (candidates.length === 1 && parsed.check) {
      const checkUndo = makeMove(state, candidates[0])
      const givesCheck = inCheck(state)
      unmakeMove(state, checkUndo)
      if (!givesCheck) candidates = []
    }

    if (candidates.length === 1) {
      if (!skipSan) candidates[0].san = moveToSan(state, candidates[0], moves)
      return candidates[0]
    }
  }

  // Fall back to SAN round-trip for edge cases
  const cleanMove = strippedSan(move)
  let strippedMoves = []
  for (let i = 0, len = moves.length; i < len; i++) {
    const fullSan = moveToSan(state, moves[i], moves, {
      addPromotion: matchPromotion,
    })
    const san = strippedSan(fullSan)
    if (cleanMove === san) {
      moves[i].san = fullSan
      return moves[i]
    }
    strippedMoves.push(san)
  }

  // the strict parser failed
  if (strict) return null

  let piece
  let matches
  let from: Square | undefined
  let to: Square | undefined
  let promotion

  /*
   * The default permissive (non-strict) parser allows the user to parse
   * non-standard chess notations. This parser is only run after the strict
   * Standard Algebraic Notation (SAN) parser has failed.
   *
   * When running the permissive parser, we'll run a regex to grab the piece, the
   * to/from square, and an optional promotion piece. This regex will
   * parse common non-standard notation like: Pe2-e4, Rc1c4, Qf3xf7,
   * f7f8q, b1c3
   *
   * NOTE: Some positions and moves may be ambiguous when using the permissive
   * parser. For example, in this position: 6k1/8/8/B7/8/8/8/BN4K1 w - - 0 1,
   * the move b1c3 may be interpreted as Nc3 or B1c3 (a disambiguated bishop
   * move). In these cases, the permissive parser will default to the most
   * basic interpretation (which is b1c3 parsing to Nc3).
   */

  let overlyDisambiguated = false

  matches = cleanMove.match(
    /([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/,
    //     piece         from              to       promotion
  )

  if (matches) {
    piece = matches[1]
    from = matches[2] as Square
    to = matches[3] as Square
    promotion = matches[4]

    if (from.length == 1) {
      overlyDisambiguated = true
    }
  } else {
    /*
     * The [a-h]?[1-8]? portion of the regex below handles moves that may be
     * overly disambiguated (e.g. Nge7 is unnecessary and non-standard when
     * there is one legal knight move to e7). In this case, the value of
     * 'from' variable will be a rank or file, not a square.
     */

    matches = cleanMove.match(
      /([pnbrqkPNBRQK])?([a-h]?[1-8]?)x?-?([a-h][1-8])([qrbnQRBN])?/,
    )

    if (matches) {
      piece = matches[1]
      from = matches[2] as Square
      to = matches[3] as Square
      promotion = matches[4]

      if (from.length == 1) {
        overlyDisambiguated = true
      }
    }
  }

  if (!to) return null

  // Regenerate the moves if the arguments don't match
  const toSqStr = typeof toSq === 'number' ? algebraic(toSq) : toSq
  if (piece?.toLowerCase() !== pieceType || toSqStr !== to) {
    moves = generateMoves(state, {
      piece: piece ? (piece.toLowerCase() as PieceSymbol) : pieceType,
      to,
    })
    strippedMoves = []
    for (let i = 0, len = moves.length; i < len; i++) {
      const san = strippedSan(
        moveToSan(state, moves[i], moves, { addPromotion: matchPromotion }),
      )
      strippedMoves.push(san)
    }
  }

  for (let i = 0, len = moves.length; i < len; i++) {
    if (!from) {
      // if there is no from square, it could be just 'x' missing from a capture
      // or the wrong letter case with the piece or promotion
      if (
        cleanMove.toLowerCase() ===
        strippedMoves[i].replace('x', '').toLowerCase()
      ) {
        moves[i].san = moveToSan(state, moves[i], moves)
        return moves[i]
      }
      // hand-compare move properties with the results from our permissive regex
    } else if (
      (!piece || piece.toLowerCase() == moves[i].piece) &&
      SQUARES[from] == moves[i].from &&
      SQUARES[to] == moves[i].to &&
      (!matchPromotion ||
        !promotion ||
        promotion.toLowerCase() == moves[i].promotion)
    ) {
      moves[i].san = moveToSan(state, moves[i], moves)
      return moves[i]
    } else if (overlyDisambiguated) {
      /*
       * SPECIAL CASE: we parsed a move string that may have an unneeded
       * rank/file disambiguator (e.g. Nge7).  The 'from' variable will
       */

      const square = algebraic(moves[i].from)
      if (
        (!piece || piece.toLowerCase() == moves[i].piece) &&
        SQUARES[to] == moves[i].to &&
        (from == square?.[0] || from == square?.[1]) &&
        (!promotion || promotion.toLowerCase() == moves[i].promotion)
      ) {
        moves[i].san = moveToSan(state, moves[i], moves)
        return moves[i]
      }
    }
  }

  return null
}

/**
 * Converts a HexMove to a Move.
 * @public
 */
export function hexToMove(state: Readonly<BoardState>, move: HexMove): Move {
  if (!move.san) {
    move.san = moveToSan(state, move)
  }

  let flags = ''
  for (const flag in BITS) {
    if (isFlagKey(flag) && BITS[flag] & move.flags) {
      flags += FLAGS[flag]
    }
  }

  return {
    to: algebraic(move.to) as Square,
    from: algebraic(move.from) as Square,
    color: move.color,
    flags,
    piece: move.piece,
    san: move.san,
    captured: move.captured,
    promotion: move.promotion,
  }
}

/**
 * Checks if a square is attacking a target square.
 * @param state - Board state
 * @param square - Attacking square
 * @param targetSquare - Target square
 * @public
 */
export function isAttacking(
  state: Readonly<BoardState>,
  square: number,
  targetSquare: number,
): boolean {
  const moves = generateMoves(state, {
    from: square,
    to: targetSquare,
  })
  return !!moves.length
}

/**
 * Checks if a square is threatening a target square.
 * @param state - Board state
 * @param square - Attacking square
 * @param targetSquare - Target square
 * @public
 */
export function isThreatening(
  board: Readonly<Board>,
  square: number,
  targetSquare: number,
): boolean {
  if (targetSquare & 0x88 || square & 0x88) {
    return false
  }

  // Check if there is an attacking piece
  const byEncoded = board[square]
  if (!byEncoded) {
    return false
  }

  // Check if the target square is occupied by the same color
  const targetEncoded = board[targetSquare]
  if (
    targetEncoded &&
    decodePieceColor(targetEncoded) === decodePieceColor(byEncoded)
  ) {
    return false
  }

  const byType = decodePieceType(byEncoded)
  const byColor: Color = byEncoded & 8 ? BLACK : WHITE
  const bySymbol = NUM_PIECE_TYPE[byType]!
  switch (byType) {
    case PT_PAWN:
      return PAWN_ATTACK_OFFSETS[byColor]
        .map((offset) => targetSquare + offset)
        .includes(square)
    case PT_KNIGHT:
    case PT_KING:
      return PIECE_OFFSETS[bySymbol]
        .map((offset) => targetSquare + offset)
        .includes(square)
    case PT_BISHOP: {
      const squares = diagonalSquaresBetween(square, targetSquare)
      return !!squares.length && squares.every((sq) => !board[sq])
    }
    case PT_ROOK: {
      const squares = linearSquaresBetween(square, targetSquare)
      return !!squares.length && squares.every((sq) => !board[sq])
    }
    case PT_QUEEN: {
      const squares = squaresBetween(square, targetSquare)
      return !!squares.length && squares.every((sq) => !board[sq])
    }
  }

  return false
}

/**
 * Checks if a square is attacked. If an attacking color is not provided, the opposite color of the piece on the square or the current turn is used. This function does not check if the attacking piece is pinned.
 *
 * @param state - Board state
 * @param square - Square to check
 * @param color - Color of the attacking side
 * @param skipSq - Optional square to skip in slider rays (used for king move
 *   validation so sliders "see through" the king's current square)
 * @public
 */
export function isAttacked(
  state: Readonly<BoardState>,
  square: number,
  color?: Color,
  skipSq: number = -1,
): boolean {
  if (square & 0x88) return false

  // Determine attacking color
  if (color === undefined) {
    const encoded = state.board[square]
    if (encoded) {
      color = encoded & 8 ? WHITE : BLACK // swap color of piece on square
    } else {
      color = swapColor(state.turn)
    }
  }
  const colorBit = COLOR_NUM[color]

  // Pawn
  const pawnOffsets = PAWN_ATTACK_OFFSETS[color]
  for (let i = 0; i < pawnOffsets.length; i++) {
    const offset = pawnOffsets[i]
    const p = state.board[square + offset]
    if (
      p &&
      decodePieceColor(p) === colorBit &&
      decodePieceType(p) === PT_PAWN
    ) {
      return true
    }
  }

  // Knight
  for (let i = 0; i < PIECE_OFFSETS[KNIGHT].length; i++) {
    const offset = PIECE_OFFSETS[KNIGHT][i]
    const p = state.board[square + offset]
    if (
      p &&
      decodePieceColor(p) === colorBit &&
      decodePieceType(p) === PT_KNIGHT
    ) {
      return true
    }
  }

  // Sliding + one-square (king) in a single pass per direction
  for (let i = 0; i < 8; i++) {
    const offset = DIRECTIONS[i]
    let sq = square + offset
    let dist = 0
    while ((sq & 0x88) === 0) {
      if (sq === skipSq) {
        sq += offset
        dist++
        continue
      }
      const p = state.board[sq]
      if (p) {
        if (decodePieceColor(p) === colorBit) {
          const pt = decodePieceType(p)
          if (dist === 0 && pt === PT_KING) return true
          if (i < 4 && (pt === PT_ROOK || pt === PT_QUEEN)) return true
          if (i >= 4 && (pt === PT_BISHOP || pt === PT_QUEEN)) return true
        }
        break
      }
      sq += offset
      dist++
    }
  }

  return false
}

export function isKingAttacked(
  state: Readonly<BoardState>,
  color: Color,
): boolean {
  return isAttacked(state, state.kings[color])
}

export function inCheck(state: Readonly<BoardState>): boolean {
  return isKingAttacked(state, state.turn)
}

export function inCheckmate(state: Readonly<BoardState>): boolean {
  return inCheck(state) && !hasLegalMove(state)
}

export function inStalemate(state: Readonly<BoardState>): boolean {
  return !inCheck(state) && !hasLegalMove(state)
}

export function insufficientMaterial(state: Readonly<BoardState>): boolean {
  const pieces: { [key: string]: number } = {}
  const bishops = []
  let num_pieces = 0
  let sq_color = 0

  for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
    sq_color = (sq_color + 1) % 2
    if (i & 0x88) {
      i += 7
      continue
    }

    const encoded = state.board[i]
    if (encoded) {
      const pt = NUM_PIECE_TYPE[encoded & 7]!
      pieces[pt] = pt in pieces ? pieces[pt] + 1 : 1
      if ((encoded & 7) === PT_BISHOP) {
        bishops.push(sq_color)
      }
      num_pieces++
    }
  }

  /* k vs. k */
  if (num_pieces === 2) {
    return true
  } else if (
    /* k vs. kn .... or .... k vs. kb */
    num_pieces === 3 &&
    (pieces[BISHOP] === 1 || pieces[KNIGHT] === 1)
  ) {
    return true
  } else if (num_pieces === pieces[BISHOP] + 2) {
    /* kb vs. kb where any number of bishops are all on the same color */
    let sum = 0
    const len = bishops.length
    for (let i = 0; i < len; i++) {
      sum += bishops[i]
    }
    if (sum === 0 || sum === len) {
      return true
    }
  }

  return false
}

export function makeMove(state: BoardState, move: Readonly<HexMove>): UndoInfo {
  const undo: UndoInfo = {
    move,
    castling_w: state.castling.w,
    castling_b: state.castling.b,
    ep_square: state.ep_square,
    half_moves: state.half_moves,
    move_number: state.move_number,
    captured_encoded: state.board[move.to],
  }

  const us = state.turn
  const them = swapColor(us)

  // Handle null moves (pass)
  if (move.flags & BITS.NULL_MOVE) {
    state.ep_square = -1
    state.half_moves++
    state.turn = them
    if (state.turn === WHITE) {
      state.move_number++
    }
    return undo
  }

  state.board[move.to] = state.board[move.from]
  state.board[move.from] = 0

  // if ep capture, remove the captured pawn
  if (move.flags & BITS.EP_CAPTURE) {
    if (us === BLACK) {
      state.board[move.to - 16] = 0
    } else {
      state.board[move.to + 16] = 0
    }
  }

  // if pawn promotion, replace with new piece
  if (move.promotion) {
    state.board[move.to] = encodePiece(move.promotion, us)
  }

  // if we moved the king
  if (move.piece === KING) {
    state.kings[us] = move.to

    // if we castled, move the rook next to the king
    if (move.flags & BITS.KSIDE_CASTLE) {
      const castling_to = move.to - 1
      const castling_from = move.to + 1
      state.board[castling_to] = state.board[castling_from]
      state.board[castling_from] = 0
    } else if (move.flags & BITS.QSIDE_CASTLE) {
      const castling_to = move.to + 1
      const castling_from = move.to - 2
      state.board[castling_to] = state.board[castling_from]
      state.board[castling_from] = 0
    }

    // turn off castling
    state.castling[us] = 0
  }

  // turn off castling if we move a rook
  if (state.castling[us]) {
    for (let i = 0, len = ROOKS[us].length; i < len; i++) {
      if (
        move.from === ROOKS[us][i].square &&
        state.castling[us] & ROOKS[us][i].flag
      ) {
        state.castling[us] ^= ROOKS[us][i].flag
        break
      }
    }
  }

  // turn off castling if we capture a rook
  if (state.castling[them]) {
    for (let i = 0, len = ROOKS[them].length; i < len; i++) {
      if (
        move.to === ROOKS[them][i].square &&
        state.castling[them] & ROOKS[them][i].flag
      ) {
        state.castling[them] ^= ROOKS[them][i].flag
        break
      }
    }
  }

  // if big pawn move, update the en passant square
  if (move.flags & BITS.BIG_PAWN) {
    if (us === BLACK) {
      state.ep_square = move.to - 16
    } else {
      state.ep_square = move.to + 16
    }
  } else {
    state.ep_square = EMPTY
  }

  // reset the 50 move counter if a pawn is moved or a piece is captured
  if (move.piece === PAWN) {
    state.half_moves = 0
  } else if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
    state.half_moves = 0
  } else {
    state.half_moves++
  }

  if (us === BLACK) {
    state.move_number++
  }
  state.turn = them
  return undo
}

export function unmakeMove(state: BoardState, undo: UndoInfo): void {
  const move = undo.move
  const us = move.color
  const them = swapColor(us)

  // Handle null moves (pass)
  if (move.flags & BITS.NULL_MOVE) {
    state.turn = us
    state.ep_square = undo.ep_square
    state.half_moves = undo.half_moves
    state.move_number = undo.move_number
    return
  }

  state.turn = us
  state.castling.w = undo.castling_w
  state.castling.b = undo.castling_b
  state.ep_square = undo.ep_square
  state.half_moves = undo.half_moves
  state.move_number = undo.move_number

  // Move piece back
  if (move.promotion) {
    // Undo promotion: put the original pawn back
    state.board[move.from] = encodePiece(PAWN, us)
  } else {
    state.board[move.from] = state.board[move.to]
  }

  // Restore captured piece or clear destination
  if (move.flags & BITS.EP_CAPTURE) {
    // Clear the to square and restore the captured pawn
    state.board[move.to] = 0
    const capturedPawnSq = us === WHITE ? move.to + 16 : move.to - 16
    state.board[capturedPawnSq] = encodePiece(PAWN, them)
  } else {
    // Restore captured piece (or 0 if no capture)
    state.board[move.to] = undo.captured_encoded
  }

  // Restore king position
  if (move.piece === KING) {
    state.kings[us] = move.from

    // Undo castling rook move
    if (move.flags & BITS.KSIDE_CASTLE) {
      const castling_to = move.to - 1
      const castling_from = move.to + 1
      state.board[castling_from] = state.board[castling_to]
      state.board[castling_to] = 0
    } else if (move.flags & BITS.QSIDE_CASTLE) {
      const castling_to = move.to + 1
      const castling_from = move.to - 2
      state.board[castling_from] = state.board[castling_to]
      state.board[castling_to] = 0
    }
  }
}

export function perft(state: BoardState, depth: number): number {
  const moves = generateMoves(state, { legal: false })
  let nodes = 0
  const color = state.turn

  for (let i = 0, len = moves.length; i < len; i++) {
    const undo = makeMove(state, moves[i])
    if (!isKingAttacked(state, color)) {
      if (depth - 1 > 0) {
        nodes += perft(state, depth - 1)
      } else {
        nodes++
      }
    }
    unmakeMove(state, undo)
  }

  return nodes
}

export function buildMove(
  state: Readonly<BoardState>,
  from: number,
  to: number,
  flags: number,
  promotion?: string,
): HexMove | null {
  const encoded = state.board[from]
  if (!encoded) return null

  const move: HexMove = {
    color: state.turn,
    from: from,
    to: to,
    flags: flags,
    piece: NUM_PIECE_TYPE[encoded & 7]!,
  }

  if (promotion && isPieceSymbol(promotion)) {
    move.flags |= BITS.PROMOTION
    move.promotion = promotion
  }

  const toEncoded = state.board[to]
  if (toEncoded) {
    move.captured = NUM_PIECE_TYPE[toEncoded & 7]!
  } else if (flags & BITS.EP_CAPTURE) {
    move.captured = PAWN
  }
  return move
}

export function getBoard(board: Readonly<Board>): (Piece | null)[][] {
  const output = []
  let row = []

  for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
    const encoded = board[i]
    if (!encoded) {
      row.push(null)
    } else {
      row.push(decodePiece(encoded))
    }
    if ((i + 1) & 0x88) {
      output.push(row)
      row = []
      i += 8
    }
  }

  return output
}

export function validateMove(
  state: Readonly<BoardState>,
  move: string | Readonly<PartialMove>,
  options: { strict?: boolean; matchPromotion?: boolean } = {},
): HexMove | null {
  const { matchPromotion = true } = options
  if (typeof move === 'string') {
    return sanToMove(state, move, options)
  } else if (typeof move === 'object') {
    const square = isSquare(move.from) ? move.from : undefined
    const moves = generateMoves(state, { from: square, to: move.to })
    // Find a matching move
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i]
      if (
        move.from === algebraic(m.from) &&
        move.to === algebraic(m.to) &&
        (!matchPromotion ||
          !('promotion' in m) ||
          move.promotion === m.promotion)
      ) {
        return m
      }
    }
  }

  return null
}

export function nodeMove(node: Readonly<TreeNode<HexState>>): Move | null {
  // Need a parent board state to return a valid move
  if (node.model.move && node.parent?.model) {
    return hexToMove(node.parent.model.boardState, node.model.move)
  }
  return null
}

export function hexToGameState(
  node: Readonly<TreeNode<HexState>>,
): Omit<GameState, 'isCurrent'> {
  const move = nodeMove(node)
  return {
    fen: getFen(node.model.boardState),
    nags: node.model.nags,
    comment: node.model.comment,
    startingComment: node.model.startingComment,
    move: move || undefined,
  }
}
export function moveToUci(move: PartialMove) {
  return move.from + move.to + move.promotion
}
