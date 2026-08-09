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
  CC_A,
  CC_a,
  CC_h,
  CC_1,
  CC_8,
  CC_x,
  CC_DASH,
  CC_EQ,
  CC_PLUS,
  CC_HASH,
  CC_BANG,
  CC_QMARK,
  CC_N,
  CC_B,
  CC_R,
  CC_Q,
  CC_K,
  CC_n,
  CC_b,
  CC_r,
  CC_q,
} from './constants'
import {
  Board,
  Color,
  HexMove,
  Piece,
  Move,
  Square,
  PartialMove,
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

/**
 * Encode a piece symbol + color into a single byte for Uint8Array board
 * @public
 */
export function encodePiece(type: PieceSymbol, color: Color): number {
  return COLOR_NUM[color] | PIECE_TYPE_NUM[type]
}

/**
 * Decode an encoded byte to a Piece object
 * @public
 */
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

/* the square holding the pawn that an ep capture would remove */
export function epCapturedPawnSquare(state: BoardState): number {
  return state.ep_square + (state.turn === WHITE ? 16 : -16)
}

/*
 * Is the ep square backed by a pawn that can actually be captured? A stale ep
 * square can arrive from putPiece/removePiece clearing the double-pushed pawn,
 * or straight from a hand-written FEN. Generating the capture anyway lets
 * unmakeMove restore a pawn that was never there, so every ep path gates here.
 */
export function isEpCaptureAvailable(state: BoardState): boolean {
  if (state.ep_square === EMPTY) return false
  /* the landing square must be empty, else we'd capture onto our own piece */
  if (state.board[state.ep_square]) return false
  const encoded = state.board[epCapturedPawnSquare(state)]
  return (
    !!encoded &&
    decodePieceType(encoded) === PT_PAWN &&
    decodePieceColor(encoded) !== COLOR_NUM[state.turn]
  )
}

/*
 * The ep square as it should appear in a position's identity: set only when en
 * passant is genuinely playable (a pawn of ours can capture and doing so does
 * not expose our king), otherwise EMPTY. This is the canonical FEN/EPD rule.
 *
 * getFen and hashBoardState must agree on this or two positions that serialise
 * identically would hash differently, silently breaking repetition detection.
 */
export function legalEpSquare(state: BoardState): number {
  if (!isEpCaptureAvailable(state)) return EMPTY

  const bigPawnSquare = epCapturedPawnSquare(state)
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

      const epLegal = !isKingAttacked(state, color)
      unmakeMove(state, epUndo)
      if (epLegal) return state.ep_square
    }
  }
  return EMPTY
}

/** @public */
export function getFen(state: BoardState): string {
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
    const rookSq = state.castlingRooks.w.k
    cflags +=
      rookSq === SQUARES.h1 ? 'K' : String.fromCharCode(CC_A + (rookSq & 7))
  }
  if (state.castling[WHITE] & BITS.QSIDE_CASTLE) {
    const rookSq = state.castlingRooks.w.q
    cflags +=
      rookSq === SQUARES.a1 ? 'Q' : String.fromCharCode(CC_A + (rookSq & 7))
  }
  if (state.castling[BLACK] & BITS.KSIDE_CASTLE) {
    const rookSq = state.castlingRooks.b.k
    cflags +=
      rookSq === SQUARES.h8 ? 'k' : String.fromCharCode(CC_a + (rookSq & 7))
  }
  if (state.castling[BLACK] & BITS.QSIDE_CASTLE) {
    const rookSq = state.castlingRooks.b.q
    cflags +=
      rookSq === SQUARES.a8 ? 'q' : String.fromCharCode(CC_a + (rookSq & 7))
  }

  /* do we have an empty castling flag? */
  cflags = cflags || '-'

  let epflags = '-'

  /*
   * Set the ep square only if en passant is a valid move (pawn is present
   * and ep capture is not pinned). This is the canonical FEN/EPD rule, so a
   * position is only ever written one way.
   */
  const epSq = legalEpSquare(state)
  if (epSq !== EMPTY) {
    epflags = algebraic(epSq) || '-'
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

/**
 * The rook a `K`/`Q`/`k`/`q` castling flag refers to: the outermost rook of
 * that colour on that side of its king. In standard chess that is h1/a1, but
 * X-FEN reuses the same letters for Chess960, where it is whatever rook sits
 * furthest out. Returns EMPTY when no such rook exists.
 * @internal
 */
function outermostRook(
  state: Readonly<BoardState>,
  color: Color,
  kingSide: boolean,
): number {
  const backRank = color === WHITE ? SQUARES.a1 : SQUARES.a8
  const kingSq = state.kings[color]
  // Off its back rank the king has no side to speak of, and scanning would run
  // past the rank into the rest of the board.
  if (kingSq === EMPTY || (kingSq & 0x70) !== backRank) return EMPTY
  const colorBit = COLOR_NUM[color]
  if (kingSide) {
    for (let sq = backRank + 7; sq > kingSq; sq--) {
      const p = state.board[sq]
      if (p && (p & 7) === PT_ROOK && (p & 8) === colorBit) return sq
    }
  } else {
    for (let sq = backRank; sq < kingSq; sq++) {
      const p = state.board[sq]
      if (p && (p & 7) === PT_ROOK && (p & 8) === colorBit) return sq
    }
  }
  return EMPTY
}

/**
 * Records a castling right, but only when a rook of that colour really sits on
 * `rookSq` beside its king on the back rank. A flag with nothing behind it is
 * invalid FEN, and engines handle it in incompatible ways -- Stockfish crashes
 * or hangs, lc0 keeps analysing the previous position -- so it is dropped here
 * rather than passed on. python-chess and cozy-chess likewise refuse it.
 * @internal
 */
function grantCastle(state: BoardState, color: Color, rookSq: number): void {
  if (rookSq === EMPTY) return
  const backRank = color === WHITE ? SQUARES.a1 : SQUARES.a8
  if ((rookSq & 0x70) !== backRank) return
  const p = state.board[rookSq]
  if (!p || (p & 7) !== PT_ROOK || (p & 8) !== COLOR_NUM[color]) return
  const kingSq = state.kings[color]
  if (kingSq === EMPTY || (kingSq & 0x70) !== backRank || kingSq === rookSq) {
    return
  }
  if (rookSq > kingSq) {
    state.castling[color] |= BITS.KSIDE_CASTLE
    state.castlingRooks[color].k = rookSq
  } else {
    state.castling[color] |= BITS.QSIDE_CASTLE
    state.castlingRooks[color].q = rookSq
  }
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

  // Parse castling field (supports standard KQkq and X-FEN A-Ha-h)
  const castlingField = tokens[2]
  if (castlingField !== '-') {
    for (let ci = 0; ci < castlingField.length; ci++) {
      const ch = castlingField[ci]
      if (ch === 'K') {
        grantCastle(state, WHITE, outermostRook(state, WHITE, true))
      } else if (ch === 'Q') {
        grantCastle(state, WHITE, outermostRook(state, WHITE, false))
      } else if (ch === 'k') {
        grantCastle(state, BLACK, outermostRook(state, BLACK, true))
      } else if (ch === 'q') {
        grantCastle(state, BLACK, outermostRook(state, BLACK, false))
      } else if (ch >= 'A' && ch <= 'H') {
        // X-FEN: uppercase file letter = white rook
        grantCastle(state, WHITE, SQUARES.a1 + (ch.charCodeAt(0) - CC_A))
      } else if (ch >= 'a' && ch <= 'h') {
        // X-FEN: lowercase file letter = black rook
        grantCastle(state, BLACK, SQUARES.a8 + (ch.charCodeAt(0) - CC_a))
      }
    }
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

/**
 * Drops any castling right whose king or rook has been edited off its square.
 * A right names one specific rook, so editing that rook away has to clear it,
 * or the right survives as a "castle" that moves no rook and as an unbacked
 * FEN flag -- see `grantCastle`. Only the editing entry points call this;
 * makeMove maintains rights itself and relies on undo to restore them.
 * @internal
 */
function revokeUnbackedCastling(state: BoardState): void {
  for (const color of [WHITE, BLACK] as const) {
    const colorBit = COLOR_NUM[color]
    const rooks = state.castlingRooks[color]
    const isPiece = (sq: number, type: number): boolean => {
      if (sq === EMPTY) return false
      const p = state.board[sq]
      return !!p && (p & 7) === type && (p & 8) === colorBit
    }

    if (!isPiece(state.kings[color], PT_KING)) {
      state.castling[color] = 0
      rooks.k = EMPTY
      rooks.q = EMPTY
      continue
    }
    if (
      state.castling[color] & BITS.KSIDE_CASTLE &&
      !isPiece(rooks.k, PT_ROOK)
    ) {
      state.castling[color] &= ~BITS.KSIDE_CASTLE
      rooks.k = EMPTY
    }
    if (
      state.castling[color] & BITS.QSIDE_CASTLE &&
      !isPiece(rooks.q, PT_ROOK)
    ) {
      state.castling[color] &= ~BITS.QSIDE_CASTLE
      rooks.q = EMPTY
    }
  }
}

/* drop an ep square the board no longer backs, so it can't leak out through
 * getFen or a serialized BoardState
 */
function revokeUnbackedEnPassant(state: BoardState): void {
  if (state.ep_square !== EMPTY && !isEpCaptureAvailable(state)) {
    state.ep_square = EMPTY
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

  /* if this overwrites a king, drop the stale tracker before it points at a
   * square holding some other piece
   */
  const prevEncoded = state.board[sq]
  if (prevEncoded && decodePieceType(prevEncoded) === PT_KING) {
    state.kings[decodePieceColor(prevEncoded) ? BLACK : WHITE] = EMPTY
  }

  state.board[sq] = encodePiece(piece.type, piece.color)
  if (piece.type === KING) {
    state.kings[piece.color] = sq
  }

  revokeUnbackedCastling(state)
  revokeUnbackedEnPassant(state)
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
  revokeUnbackedCastling(state)
  revokeUnbackedEnPassant(state)
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
 * Check if castling is legal from the given king/rook squares.
 * All squares between king and its destination, and between rook and its
 * destination, must be empty (excluding king and rook themselves).
 * All squares the king traverses (from exclusive, to inclusive) must not be attacked.
 */
function canCastle(
  state: Readonly<BoardState>,
  kingSq: number,
  rookSq: number,
  kingDest: number,
  rookDest: number,
  them: Color,
): boolean {
  // Check emptiness: all squares in the king's travel path and rook's travel
  // path must be empty, excluding the king and rook themselves
  const minSq = Math.min(kingSq, rookSq, kingDest, rookDest)
  const maxSq = Math.max(kingSq, rookSq, kingDest, rookDest)
  for (let sq = minSq; sq <= maxSq; sq++) {
    if (sq === kingSq || sq === rookSq) continue
    if (state.board[sq]) return false
  }

  // Check safety: all squares the king traverses must not be attacked
  if (kingDest !== kingSq) {
    const step = kingDest > kingSq ? 1 : -1
    for (let sq = kingSq + step; ; sq += step) {
      if (isAttacked(state, sq, them, kingSq)) return false
      if (sq === kingDest) break
    }
  }

  return true
}

/**
 * Return all moves for a given board state.
 * @param state - The board state
 * @param options - Move generation options
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

  /* with no king there is nothing to expose, so every pseudo-legal move is
   * legal. Rays traced from EMPTY would wrap onto the board and invent checks.
   */
  if (legal && kingSq !== EMPTY) {
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
          } else if (toSq === state.ep_square && isEpCaptureAvailable(state)) {
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
              const capturedPawnSq = epCapturedPawnSquare(state)
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
          const backRank = kingSq & 0x70
          // King-side castling
          if (state.castling[state.turn] & BITS.KSIDE_CASTLE) {
            const kingDest = backRank + 6
            const rookDest = backRank + 5
            const rookSq = state.castlingRooks[state.turn].k
            if (
              (toSquare === undefined || toSquare === kingDest) &&
              canCastle(state, kingSq, rookSq, kingDest, rookDest, them)
            ) {
              addMove(KING, kingSq, kingDest, BITS.KSIDE_CASTLE)
            }
          }

          // Queen-side castling
          if (state.castling[state.turn] & BITS.QSIDE_CASTLE) {
            const kingDest = backRank + 2
            const rookDest = backRank + 3
            const rookSq = state.castlingRooks[state.turn].q
            if (
              (toSquare === undefined || toSquare === kingDest) &&
              canCastle(state, kingSq, rookSq, kingDest, rookDest, them)
            ) {
              addMove(KING, kingSq, kingDest, BITS.QSIDE_CASTLE)
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

  /* a kingless side is never in check, so any pseudo-legal move will do */
  if (kingSq === EMPTY) return generateMoves(state, { legal: false }).length > 0

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
        } else if (toSq === state.ep_square && isEpCaptureAvailable(state)) {
          const capturedPawnSq = epCapturedPawnSquare(state)
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

  return false
}

/**
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

// Convert file charCode (CC_a–CC_h) and rank charCode (CC_1–CC_8) to 0x88 index
function sqIdx(fc: number, rc: number): number {
  return fc - CC_a + (CC_8 - rc) * 16
}

function isFile(c: number): boolean {
  return c >= CC_a && c <= CC_h
}

function isRank(c: number): boolean {
  return c >= CC_1 && c <= CC_8
}

function isPieceChar(c: number): boolean {
  return c === CC_N || c === CC_B || c === CC_R || c === CC_Q || c === CC_K
}

function isPromotionChar(c: number): boolean {
  return (
    c === CC_q ||
    c === CC_r ||
    c === CC_b ||
    c === CC_n ||
    c === CC_Q ||
    c === CC_R ||
    c === CC_B ||
    c === CC_N
  )
}

type ParsedMove = {
  toIdx?: number // 0x88 index of target square
  fromIdx?: number // 0x88 index of source square
  disambiguator?: number // charCode: file 'a'-'h' (CC_a–CC_h) or rank '1'-'8' (CC_1–CC_8)
  piece?: PieceSymbol
  promotion?: PieceSymbol
  check?: string
}

export function extractMove(move: string): ParsedMove {
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
  if (isPieceChar(c0)) {
    piece = move[0].toLowerCase() as PieceSymbol
    i = 1

    const c1 = move.charCodeAt(1)
    // Check for disambiguator or 'x'
    if (isFile(c1)) {
      const c2 = move.charCodeAt(2)
      if (isRank(c2)) {
        // [1-8]: could be "to" or "from"
        const c3 = move.charCodeAt(3)
        if (c3 === CC_x) {
          // 'x': this is from square, e.g. Re1xd1
          fromIdx = sqIdx(c1, c2)
          i = 4
        } else if (isFile(c3)) {
          // another [a-h]: this is from square, e.g. Rc1c4
          fromIdx = sqIdx(c1, c2)
          i = 3
        } else {
          // Just piece + to, e.g. Nf3
          i = 1
        }
      } else if (c2 === CC_x) {
        // 'x' after file disambiguator, e.g. Nxe5 or Raxd1
        disambiguator = c1
        i = 3
      } else if (isFile(c2)) {
        // file disambiguator + file, e.g. Rae1
        disambiguator = c1
        i = 2
      } else {
        i = 1
      }
    } else if (isRank(c1)) {
      // [1-8] rank disambiguator, e.g. N1e3
      const c2 = move.charCodeAt(2)
      if (c2 === CC_x) {
        disambiguator = c1
        i = 3
      } else {
        disambiguator = c1
        i = 2
      }
    } else if (c1 === CC_x) {
      // 'x' capture, e.g. Nxe5
      i = 2
    }

    // Now parse target square [a-h][1-8]
    const cf = move.charCodeAt(i)
    const cr = move.charCodeAt(i + 1)
    if (isFile(cf) && isRank(cr)) {
      toIdx = sqIdx(cf, cr)
      i += 2
    }
  } else if (isFile(c0)) {
    // Pawn move: starts with [a-h]
    const c1 = move.charCodeAt(1)
    if (isRank(c1)) {
      // [a-h][1-8] — pawn push or could be from-square in long algebraic
      const c2 = move.charCodeAt(2)
      if (c2 === CC_x || c2 === CC_DASH || isFile(c2)) {
        // This is a from-square (e.g. e2-e4, e2e4, e7xd8)
        fromIdx = sqIdx(c0, c1)
        i = c2 === CC_x || c2 === CC_DASH ? 3 : 2
        const cf = move.charCodeAt(i)
        const cr = move.charCodeAt(i + 1)
        if (isFile(cf) && isRank(cr)) {
          toIdx = sqIdx(cf, cr)
          i += 2
        }
      } else {
        // Simple pawn push e.g. e4
        toIdx = sqIdx(c0, c1)
        i = 2
      }
    } else if (c1 === CC_x) {
      // Pawn capture: exd5
      disambiguator = c0
      i = 2
      const cf = move.charCodeAt(i)
      const cr = move.charCodeAt(i + 1)
      if (isFile(cf) && isRank(cr)) {
        toIdx = sqIdx(cf, cr)
        i += 2
      }
    }

    // Promotion: =Q or just Q after to-square
    if (i < len) {
      let pi = i
      if (move.charCodeAt(pi) === CC_EQ) pi++
      const pc = move.charCodeAt(pi)
      if (isPromotionChar(pc)) {
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
      piece: toPieceSymbol(matches[1]),
      disambiguator:
        matches[2] && matches[2].length === 1
          ? matches[2].charCodeAt(0)
          : undefined,
      fromIdx:
        matches[2] && matches[2].length === 2
          ? SQUARES[matches[2] as Square]
          : undefined,
      toIdx: mTo ? SQUARES[mTo] : undefined,
      promotion: matches[4] ? toPieceSymbol(matches[4]) : undefined,
      check: matches[5],
    }
  }

  // Check indicator (+, #) — skip past any NAG chars (!?)
  while (i < len) {
    const c = move.charCodeAt(i)
    if (c === CC_PLUS || c === CC_HASH) {
      check = move[i]
      break
    }
    if (c !== CC_BANG && c !== CC_QMARK) break
    i++
  }

  return { piece, disambiguator, fromIdx, toIdx, promotion, check }
}

function strippedSan(move: string) {
  return (
    move
      .replace(/=/, '')
      .replace(/[+#]?[?!]*$/, '')
      // moveToSan only ever emits letter-O castling, so a '0-0' input could
      // never match the round-trip below without being normalised first.
      .replace(/^0-0(-0)?$/, (m) => m.replace(/0/g, 'O'))
  )
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
  const isCastling = move.startsWith('O-O') || move.startsWith('0-0')
  let pieceType: PieceSymbol | undefined
  let toSq: Square | number | undefined
  if (isCastling) {
    pieceType = KING
    toSq =
      move.startsWith('O-O-O') || move.startsWith('0-0-0')
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
    // otherwise leave undefined for long algebraic like "e2-e4" so
    // generateMoves is unfiltered by piece (fromIdx filter narrows it down)
    pieceType = parsed.fromIdx !== undefined ? undefined : PAWN
    toSq = parsed.toIdx
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
        // File charCode ('a'=97..): extract file from 0x88 index via (& 7)
        // Rank charCode ('1'=49..): extract rank via (>> 4), mapped so '1'→7 '8'→0
        if (
          pDisambig >= CC_a
            ? (m.from & 7) !== pDisambig - CC_a
            : m.from >> 4 !== CC_8 - pDisambig
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

  if (!from) return null

  for (let i = 0, len = moves.length; i < len; i++) {
    if (
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
    castlingRooks_wk: state.castlingRooks.w.k,
    castlingRooks_wq: state.castlingRooks.w.q,
    castlingRooks_bk: state.castlingRooks.b.k,
    castlingRooks_bq: state.castlingRooks.b.q,
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

  // Handle castling specially: clear both sources, place both destinations
  if (move.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
    const kingEncoded = state.board[move.from]
    const isKside = !!(move.flags & BITS.KSIDE_CASTLE)
    const rookFrom = isKside
      ? state.castlingRooks[us].k
      : state.castlingRooks[us].q
    const rookEncoded = state.board[rookFrom]
    const backRank = move.from & 0x70
    const kingDest = isKside ? backRank + 6 : backRank + 2
    const rookDest = isKside ? backRank + 5 : backRank + 3

    // Clear both source squares
    state.board[move.from] = 0
    state.board[rookFrom] = 0
    // Place at destinations
    state.board[kingDest] = kingEncoded
    state.board[rookDest] = rookEncoded

    state.kings[us] = kingDest
    undo.captured_encoded = 0 // no capture on castling
    state.castling[us] = 0
  } else {
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
      state.castling[us] = 0
    }

    // turn off castling if we move a rook
    if (state.castling[us]) {
      if (move.from === state.castlingRooks[us].k) {
        state.castling[us] &= ~BITS.KSIDE_CASTLE
      } else if (move.from === state.castlingRooks[us].q) {
        state.castling[us] &= ~BITS.QSIDE_CASTLE
      }
    }

    // turn off castling if we capture a rook
    if (state.castling[them]) {
      if (move.to === state.castlingRooks[them].k) {
        state.castling[them] &= ~BITS.KSIDE_CASTLE
      } else if (move.to === state.castlingRooks[them].q) {
        state.castling[them] &= ~BITS.QSIDE_CASTLE
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
  state.castlingRooks.w.k = undo.castlingRooks_wk
  state.castlingRooks.w.q = undo.castlingRooks_wq
  state.castlingRooks.b.k = undo.castlingRooks_bk
  state.castlingRooks.b.q = undo.castlingRooks_bq
  state.ep_square = undo.ep_square
  state.half_moves = undo.half_moves
  state.move_number = undo.move_number

  // Undo castling: restore king and rook to original squares
  if (move.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
    const isKside = !!(move.flags & BITS.KSIDE_CASTLE)
    const backRank = move.from & 0x70
    const kingDest = isKside ? backRank + 6 : backRank + 2
    const rookDest = isKside ? backRank + 5 : backRank + 3
    // castlingRooks already restored from undo above
    const rookFrom = isKside
      ? state.castlingRooks[us].k
      : state.castlingRooks[us].q

    const kingEncoded = state.board[kingDest]
    const rookEncoded = state.board[rookDest]

    // Clear destinations
    state.board[kingDest] = 0
    state.board[rookDest] = 0
    // Restore to original squares
    state.board[move.from] = kingEncoded
    state.board[rookFrom] = rookEncoded
    state.kings[us] = move.from
  } else {
    // Move piece back
    if (move.promotion) {
      state.board[move.from] = encodePiece(PAWN, us)
    } else {
      state.board[move.from] = state.board[move.to]
    }

    // Restore captured piece or clear destination
    if (move.flags & BITS.EP_CAPTURE) {
      state.board[move.to] = 0
      const capturedPawnSq = us === WHITE ? move.to + 16 : move.to - 16
      state.board[capturedPawnSq] = encodePiece(PAWN, them)
    } else {
      state.board[move.to] = undo.captured_encoded
    }

    // Restore king position
    if (move.piece === KING) {
      state.kings[us] = move.from
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
    const matches = (m: HexMove): boolean =>
      move.from === algebraic(m.from) &&
      move.to === algebraic(m.to) &&
      (!matchPromotion || !('promotion' in m) || move.promotion === m.promotion)
    const isCastle = (m: HexMove): boolean =>
      !!(m.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE))

    // A Move handed back by generateMoves/moves() carries flags. Honour them,
    // so enumerate-then-play round-trips: in Chess960 a castle and an ordinary
    // king move can share from/to (king on f1 or b1), and without this the
    // castle silently degrades into the king move.
    const f = (move as { flags?: string | number }).flags
    const wantsCastle =
      typeof f === 'number'
        ? !!(f & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE))
        : typeof f === 'string'
          ? /[kq]/.test(f)
          : undefined

    if (wantsCastle !== undefined) {
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i]
        if (isCastle(m) === wantsCastle && matches(m)) return m
      }
    }

    // Otherwise prefer the ordinary move. From/to alone cannot distinguish the
    // two in Chess960; castling is then addressed by king-captures-rook below.
    // Standard chess is unaffected, since e1->g1 is only ever a castle.
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i]
      if (!isCastle(m) && matches(m)) return m
    }

    // Chess960: king-captures-rook notation for castling
    const fromSq = isSquare(move.from) ? SQUARES[move.from] : undefined
    const toSq = isSquare(move.to) ? SQUARES[move.to] : undefined
    if (fromSq !== undefined && toSq !== undefined) {
      const kingSq = state.kings[state.turn]
      if (fromSq === kingSq) {
        const cr = state.castlingRooks[state.turn]
        if (toSq === cr.k && state.castling[state.turn] & BITS.KSIDE_CASTLE) {
          const castleMoves = generateMoves(state, { from: move.from })
          for (let i = 0; i < castleMoves.length; i++) {
            if (castleMoves[i].flags & BITS.KSIDE_CASTLE) return castleMoves[i]
          }
        } else if (
          toSq === cr.q &&
          state.castling[state.turn] & BITS.QSIDE_CASTLE
        ) {
          const castleMoves = generateMoves(state, { from: move.from })
          for (let i = 0; i < castleMoves.length; i++) {
            if (castleMoves[i].flags & BITS.QSIDE_CASTLE) return castleMoves[i]
          }
        }
      }
    }

    // Castling addressed by the king's destination (e1->g1). This is how
    // standard chess names it, so it stays supported; it is only reached when
    // no ordinary move claimed the pair.
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i]
      if (isCastle(m) && matches(m)) return m
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

/** @public */
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

/**
 * Renders a move in UCI long algebraic notation, e.g. `e2e4` or `e7e8q`.
 *
 * @remarks
 * Pass `state` for Chess960: castling is then encoded the way UCI engines
 * expect it, as king-captures-rook (`e1h1`) rather than by the king's
 * destination (`e1g1`). Without `state` the move's own from/to is used, which
 * is correct for standard chess. `state` must be the position the move is
 * played from.
 *
 * @param move - The move to render
 * @param state - Position the move is played from, required for Chess960
 *
 * @public
 */
export function moveToUci(
  move: PartialMove,
  state?: Readonly<BoardState>,
): string {
  // Chess960 UCI: castling is encoded as king-captures-rook
  if (state && typeof move.from === 'string' && typeof move.to === 'string') {
    const fromSq = SQUARES[move.from as Square]
    const toSq = SQUARES[move.to as Square]
    if (fromSq !== undefined && toSq !== undefined) {
      const encoded = state.board[fromSq]
      if (encoded && decodePieceType(encoded) === PT_KING) {
        const color: Color = encoded & 8 ? BLACK : WHITE
        const cr = state.castlingRooks[color]
        const backRank = fromSq & 0x70

        // Use move flags when available (HexMove/Move) for reliable detection;
        // fall back to destination heuristic for bare PartialMove.
        const f = (move as { flags?: string | number }).flags
        let isKside: boolean
        let isQside: boolean
        if (typeof f === 'number') {
          isKside = !!(f & BITS.KSIDE_CASTLE)
          isQside = !!(f & BITS.QSIDE_CASTLE)
        } else if (typeof f === 'string') {
          isKside = f.includes('k')
          isQside = f.includes('q')
        } else {
          isKside = toSq === backRank + 6
          isQside = toSq === backRank + 2
        }

        if (isKside && cr.k !== EMPTY) {
          return move.from + (algebraic(cr.k) || move.to)
        }
        if (isQside && cr.q !== EMPTY) {
          return move.from + (algebraic(cr.q) || move.to)
        }
      }
    }
  }
  return move.from + move.to + (move.promotion || '')
}

// Knight placement lookup for Chess960 position generation.
// Maps index 0-9 to positions of two knights among 5 remaining squares.
// prettier-ignore
const KNIGHT_PLACEMENTS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4],
  [1, 2], [1, 3], [1, 4],
  [2, 3], [2, 4],
  [3, 4],
]

/**
 * Whether a position needs Chess960 rules: it holds a castling right whose
 * king or rook is off the square classic chess puts it on.
 *
 * Positions with classic geometry read as false even if they came from a
 * Chess960 game — the rules coincide there, so nothing depends on the answer.
 * @param state - Board state to inspect
 * @returns True when castling cannot be described by classic rules
 * @public
 */
export function isChess960State(state: BoardState): boolean {
  for (const color of [WHITE, BLACK] as Color[]) {
    const kingSq = state.kings[color]
    if (kingSq === EMPTY) continue
    const homeKing = color === WHITE ? SQUARES.e1 : SQUARES.e8
    const { k, q } = state.castlingRooks[color]
    if (state.castling[color] & BITS.KSIDE_CASTLE) {
      const home = color === WHITE ? SQUARES.h1 : SQUARES.h8
      if (kingSq !== homeKing || k !== home) return true
    }
    if (state.castling[color] & BITS.QSIDE_CASTLE) {
      const home = color === WHITE ? SQUARES.a1 : SQUARES.a8
      if (kingSq !== homeKing || q !== home) return true
    }
  }
  return false
}

/**
 * Whether a FEN describes a position needing Chess960 rules.
 *
 * An unparseable FEN reads as false: classic is the assumption, and a position
 * that cannot be loaded has no castling geometry to judge.
 * @param fen - FEN string to inspect
 * @returns True when castling cannot be described by classic rules
 * @public
 */
export function isChess960Fen(fen: string): boolean {
  const state = loadFen(fen)
  return state ? isChess960State(state) : false
}

/**
 * Generate the FEN for a Chess960 starting position (SP 0–959).
 * @param sp - Starting position index (0–959)
 * @returns FEN string with X-FEN castling rights
 * @public
 */
export function generateChess960Fen(sp: number): string {
  if (sp < 0 || sp > 959 || !Number.isInteger(sp)) {
    throw new Error('Chess960 SP index must be an integer 0–959')
  }

  const rank = new Array<string>(8).fill('')

  // Step 1: Light-squared bishop (files b, d, f, h → indices 1, 3, 5, 7)
  let n = sp
  const b1 = (n % 4) * 2 + 1
  n = Math.floor(n / 4)

  // Step 2: Dark-squared bishop (files a, c, e, g → indices 0, 2, 4, 6)
  const b2 = (n % 4) * 2
  n = Math.floor(n / 4)

  rank[b1] = 'B'
  rank[b2] = 'B'

  // Step 3: Queen placement among 6 remaining squares
  const qIdx = n % 6
  n = Math.floor(n / 6)

  const empty1: number[] = []
  for (let i = 0; i < 8; i++) {
    if (!rank[i]) empty1.push(i)
  }
  rank[empty1[qIdx]] = 'Q'

  // Step 4: Knight placements among 5 remaining squares
  const empty2: number[] = []
  for (let i = 0; i < 8; i++) {
    if (!rank[i]) empty2.push(i)
  }
  const [n1, n2] = KNIGHT_PLACEMENTS[n]
  rank[empty2[n1]] = 'N'
  rank[empty2[n2]] = 'N'

  // Step 5: Place R, K, R in the 3 remaining squares (in order)
  const empty3: number[] = []
  for (let i = 0; i < 8; i++) {
    if (!rank[i]) empty3.push(i)
  }
  rank[empty3[0]] = 'R'
  rank[empty3[1]] = 'K'
  rank[empty3[2]] = 'R'

  const backRank = rank.join('')
  const qRookFile = String.fromCharCode(CC_A + empty3[0])
  const kRookFile = String.fromCharCode(CC_A + empty3[2])

  // Use standard KQkq if rooks are on a/h files, otherwise X-FEN
  const wK = empty3[2] === 7 ? 'K' : kRookFile
  const wQ = empty3[0] === 0 ? 'Q' : qRookFile
  const bK = empty3[2] === 7 ? 'k' : kRookFile.toLowerCase()
  const bQ = empty3[0] === 0 ? 'q' : qRookFile.toLowerCase()
  const castling = wK + wQ + bK + bQ

  return [
    backRank.toLowerCase() + '/pppppppp/8/8/8/8/PPPPPPPP/' + backRank,
    'w',
    castling,
    '-',
    '0',
    '1',
  ].join(' ')
}
