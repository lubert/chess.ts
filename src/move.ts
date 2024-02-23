import {
  BISHOP,
  BITS,
  BLACK,
  EMPTY,
  FLAGS,
  KING,
  KNIGHT,
  PAWN,
  PAWN_OFFSETS,
  PIECE_OFFSETS,
  QUEEN,
  RANK_1,
  RANK_2,
  RANK_7,
  RANK_8,
  RANKS,
  ROOK,
  ROOKS,
  SQUARES,
  WHITE,
  PAWN_ATTACK_OFFSETS,
  DIRECTIONS,
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
} from './interfaces/types'
import {
  algebraic,
  file,
  isColor,
  isDigit,
  isFlagKey,
  isPieceSymbol,
  isSquare,
  rank,
  swapColor,
  symbol,
  toPieceSymbol,
  toSquare,
} from './utils'
import { REGEXP_MOVE, REGEXP_NAG } from './regex'
import { BoardState } from './models/BoardState'
import { validateFen } from './fen'
import { TreeNode } from 'treenode.ts'

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

export function getFen(state: Readonly<BoardState>): string {
  let empty = 0
  let fen = ''

  for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
    const piece = state.board[i]
    if (!piece) {
      empty++
    } else {
      if (empty > 0) {
        fen += empty
        empty = 0
      }
      const color = piece.color
      const piece_type = piece.type

      fen +=
        color === WHITE ? piece_type.toUpperCase() : piece_type.toLowerCase()
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
  const epflags = state.ep_square === EMPTY ? '-' : algebraic(state.ep_square)

  return [
    fen,
    state.turn,
    cflags,
    epflags,
    state.half_moves,
    state.move_number,
  ].join(' ')
}

export function loadFen(fen: string): BoardState | null {
  const tokens = fen.split(/\s+/)
  const position = tokens[0]
  let square = 0

  if (!validateFen(fen).valid) {
    return null
  }

  let state = new BoardState()

  for (let i = 0; i < position.length; i++) {
    const piece = position.charAt(i)

    if (piece === '/') {
      square += 8
    } else if (isDigit(piece)) {
      square += parseInt(piece, 10)
    } else {
      const color = piece < 'a' ? WHITE : BLACK
      const newState = putPiece(
        state,
        { type: piece.toLowerCase(), color: color },
        algebraic(square),
      )
      if (!newState) {
        return null
      }
      state = newState
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
  square?: string,
): Piece | null {
  if (!square) return null
  square = square.toLowerCase()
  if (!isSquare(square)) return null

  const sq = SQUARES[square]
  const piece = state.board[sq]
  if (piece) {
    return clonePiece(piece)
  }
  return null
}

export function cloneMove(move: Readonly<HexMove>): HexMove {
  return {
    to: move.to,
    from: move.from,
    color: move.color,
    flags: move.flags,
    piece: move.piece,
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
  piece: { type?: string; color?: string },
  square?: string,
): BoardState | null {
  let { type, color } = piece

  /* check for presence */
  if (!type || !color || !square) {
    return null
  }

  type = type.toLowerCase()
  color = color.toLowerCase()
  square = square.toLowerCase()

  /* check for valid params */
  if (!isPieceSymbol(type) || !isColor(color) || !isSquare(square)) {
    return null
  }

  const state = prevState.clone()
  /* don't let the user place more than one king */
  const sq = SQUARES[square]
  if (
    type === KING &&
    state.kings[color] !== EMPTY &&
    state.kings[color] !== sq
  ) {
    return null
  }

  state.board[sq] = { type, color }
  if (type === KING) {
    state.kings[color] = sq
  }

  return state
}

export function removePiece(
  prevState: Readonly<BoardState>,
  square?: string,
): BoardState | null {
  if (!square) return null

  square = square.toLowerCase()
  if (!isSquare(square)) return null

  const sq = SQUARES[square]
  const piece = prevState.board[sq]
  if (!piece) return null

  const state = prevState.clone()
  const { type, color } = piece
  if (type === KING) {
    state.kings[color] = EMPTY
  }
  delete state.board[sq]
  return state
}

export function isLegal(state: BoardState, move: HexMove): boolean {
  const newState = makeMove(state, move)
  return !isKingAttacked(newState, state.turn)
}

/**
 * Return all pseudo-legal moves, which includes moves that allow the king to
 * be captured. Legal moves or single square moves can be further filtered out.
 */
export function generateMoves(
  state: Readonly<BoardState>,
  options: {
    legal?: boolean
    piece?: PieceSymbol
    square?: Square | number
  } = {},
): HexMove[] {
  const { legal = true, piece: forPiece, square: forSquare } = options

  const moves: HexMove[] = []

  const addMove = (
    piece: PieceSymbol,
    from: number,
    to: number,
    flags: number,
    captured?: PieceSymbol,
  ) => {
    // Pawn promotion
    const r = rank(to)
    if (piece === PAWN && (r === RANK_8 || r === RANK_1)) {
      const promotions = [QUEEN, ROOK, BISHOP, KNIGHT]
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

  const them = swapColor(state.turn)
  const second_rank: { [key: string]: number } = { b: RANK_7, w: RANK_2 }

  let firstSq = SQUARES.a8
  let lastSq = SQUARES.h1

  // Single square move generation
  if (forSquare) {
    if (typeof forSquare === 'number') {
      if (forSquare & 0x88) return []
      firstSq = lastSq = forSquare
    } else {
      if (!(forSquare in SQUARES)) return []
      firstSq = lastSq = SQUARES[forSquare]
    }
  }

  for (let fromSq = firstSq; fromSq <= lastSq; fromSq++) {
    // Check if we ran off the end of the board
    if (fromSq & 0x88) {
      fromSq += 7
      continue
    }

    const piece = state.board[fromSq]
    if (piece?.color !== state.turn) continue

    const symbol = piece.type
    if (forPiece && forPiece !== symbol) continue

    let toSq: number
    if (symbol === PAWN) {
      // Single square, non-capturing
      toSq = fromSq + PAWN_OFFSETS[state.turn][0]
      if (!state.board[toSq]) {
        addMove(PAWN, fromSq, toSq, BITS.NORMAL)

        // Double square
        toSq = fromSq + PAWN_OFFSETS[state.turn][1]
        if (second_rank[state.turn] === rank(fromSq) && !state.board[toSq]) {
          addMove(PAWN, fromSq, toSq, BITS.BIG_PAWN)
        }
      }

      // Pawn captures
      for (let j = 2; j < 4; j++) {
        toSq = fromSq + PAWN_OFFSETS[state.turn][j]
        if (toSq & 0x88) continue

        const p = state.board[toSq]
        if (p && p.color === them) {
          addMove(PAWN, fromSq, toSq, BITS.CAPTURE, p.type)
        } else if (toSq === state.ep_square) {
          addMove(PAWN, fromSq, state.ep_square, BITS.EP_CAPTURE, PAWN)
        }
      }
    } else {
      for (let j = 0, len = PIECE_OFFSETS[symbol].length; j < len; j++) {
        const offset = PIECE_OFFSETS[symbol][j]
        toSq = fromSq

        while (true) {
          toSq += offset
          if (toSq & 0x88) break

          const p = state.board[toSq]
          if (!p) {
            addMove(symbol, fromSq, toSq, BITS.NORMAL)
          } else {
            if (p.color === state.turn) break

            addMove(symbol, fromSq, toSq, BITS.CAPTURE, p.type)
            break
          }

          // Break if knight or king
          if (symbol === KNIGHT || symbol === KING) break
        }
      }
    }
  }

  if (forPiece === undefined || forPiece === KING) {
    if (!forSquare || lastSq === state.kings[state.turn]) {
      // King-side castling
      if (state.castling[state.turn] & BITS.KSIDE_CASTLE) {
        const castlingFrom = state.kings[state.turn]
        const castlingTo = castlingFrom + 2

        if (
          !state.board[castlingFrom + 1] &&
          !state.board[castlingTo] &&
          !isAttacked(state, them, state.kings[state.turn]) &&
          !isAttacked(state, them, castlingFrom + 1) &&
          !isAttacked(state, them, castlingTo)
        ) {
          addMove(KING, state.kings[state.turn], castlingTo, BITS.KSIDE_CASTLE)
        }
      }

      // Queen-side castling
      if (state.castling[state.turn] & BITS.QSIDE_CASTLE) {
        const castlingFrom = state.kings[state.turn]
        const castlingTo = castlingFrom - 2

        if (
          !state.board[castlingFrom - 1] &&
          !state.board[castlingFrom - 2] &&
          !state.board[castlingFrom - 3] &&
          !isAttacked(state, them, state.kings[state.turn]) &&
          !isAttacked(state, them, castlingFrom - 1) &&
          !isAttacked(state, them, castlingTo)
        ) {
          addMove(KING, state.kings[state.turn], castlingTo, BITS.QSIDE_CASTLE)
        }
      }
    }
  }

  if (legal) return moves.filter((m) => isLegal(state, m))
  return moves
}

/*
 * Convert a move from 0x88 coordinates to Standard Algebraic Notation (SAN)
 */
export function moveToSan(
  state: Readonly<BoardState>,
  move: Readonly<HexMove>,
  moves: HexMove[] = generateMoves(state, { piece: move.piece }),
  options: { addPromotion?: boolean } = {},
): string {
  const { addPromotion = true } = options

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

  const newState = makeMove(state, move)
  if (inCheck(newState)) {
    if (inCheckmate(newState)) {
      output += '#'
    } else {
      output += '+'
    }
  }

  return output
}

export function extractMove(move: string): ParsedMove {
  const cleaned = move.replace(REGEXP_NAG, '')
  const matches: Partial<RegExpMatchArray> | null = cleaned.match(REGEXP_MOVE)
  if (!matches) return {}
  return {
    san: matches[0]?.replace(/=([qrbn])/, (c) => c.toUpperCase()),
    piece: toPieceSymbol(matches[1]),
    disambiguator:
      matches[2] && matches[2].length === 1 ? matches[2] : undefined,
    from:
      matches[2] && matches[2].length === 2 ? toSquare(matches[2]) : undefined,
    to: toSquare(matches[3]),
    promotion: matches[4] ? toPieceSymbol(matches[4]) : undefined,
    check: matches[5],
  }
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
  state: Readonly<BoardState>,
  move: string,
  options: { strict?: boolean; matchPromotion?: boolean } = {},
): HexMove | null {
  const { strict, matchPromotion = true } = options
  // strip off any move decorations: e.g Nf3+?! becomes Nf3
  const cleanMove = strippedSan(move)
  let pieceType = inferPieceType(cleanMove)
  let moves = generateMoves(state, { piece: pieceType })

  // strict parser
  const strippedMoves = []
  for (let i = 0, len = moves.length; i < len; i++) {
    const san = strippedSan(
      moveToSan(state, moves[i], moves, { addPromotion: matchPromotion }),
    )
    if (cleanMove === san) {
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

  pieceType = inferPieceType(cleanMove)
  moves = generateMoves(state, {
    legal: true,
    piece: piece ? (piece.toLowerCase() as PieceSymbol) : pieceType,
  })

  if (!to) {
    return null
  }

  for (let i = 0, len = moves.length; i < len; i++) {
    if (!from) {
      // if there is no from square, it could be just 'x' missing from a capture
      // or the wrong letter case with the piece or promotion
      if (
        cleanMove.toLowerCase() ===
        strippedMoves[i].replace('x', '').toLowerCase()
      ) {
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
        return moves[i]
      }
    }
  }

  return null
}

export function hexToMove(
  state: Readonly<BoardState>,
  move: Readonly<HexMove>,
): Move {
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
    san: moveToSan(state, move, generateMoves(state, { piece: move.piece })),
    captured: move.captured,
    promotion: move.promotion,
  }
}

export function isAttacked(
  state: Readonly<BoardState>,
  color: Color,
  square: number,
): boolean {
  if (square & 0x88) return false

  // Pawn
  const pawnOffsets = PAWN_ATTACK_OFFSETS[color]
  for (let i = 0; i < pawnOffsets.length; i++) {
    const offset = pawnOffsets[i]
    const p = state.board[square + offset]
    if (p && p.color === color && p.type === PAWN) {
      return true
    }
  }

  // One square
  for (let i = 0; i < DIRECTIONS.length; i++) {
    const offset = DIRECTIONS[i]
    const p = state.board[square + offset]
    if (p && p.color === color) {
      if (i < 4 && (p.type === ROOK || p.type === QUEEN || p.type === KING))
        return true
      if (i >= 4 && (p.type === BISHOP || p.type === QUEEN || p.type === KING))
        return true
    }
  }

  // Knight
  for (let i = 0; i < PIECE_OFFSETS[KNIGHT].length; i++) {
    const offset = PIECE_OFFSETS[KNIGHT][i]
    const p = state.board[square + offset]
    if (p && p.color === color && p.type === KNIGHT) {
      return true
    }
  }

  // Multi square
  for (let i = 0; i < DIRECTIONS.length; i++) {
    const offset = DIRECTIONS[i]
    let sq = square + offset
    while ((sq & 0x88) === 0) {
      const p = state.board[sq]
      if (p) {
        if (p.color === color) {
          if (i < 4 && (p.type === ROOK || p.type === QUEEN)) return true
          if (i >= 4 && (p.type === BISHOP || p.type === QUEEN)) return true
        }
        break
      }
      sq += offset
    }
  }

  return false
}

export function isKingAttacked(
  state: Readonly<BoardState>,
  color: Color,
): boolean {
  return isAttacked(state, swapColor(color), state.kings[color])
}

export function inCheck(state: Readonly<BoardState>): boolean {
  return isKingAttacked(state, state.turn)
}

export function inCheckmate(state: Readonly<BoardState>): boolean {
  return inCheck(state) && generateMoves(state).length === 0
}

export function inStalemate(state: Readonly<BoardState>): boolean {
  return !inCheck(state) && generateMoves(state).length === 0
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

    const piece = state.board[i]
    if (piece) {
      pieces[piece.type] = piece.type in pieces ? pieces[piece.type] + 1 : 1
      if (piece.type === BISHOP) {
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

export function makeMove(
  prevState: Readonly<BoardState>,
  move: Readonly<HexMove>,
): BoardState {
  const state = prevState.clone()
  const us = state.turn
  const them = swapColor(us)

  state.board[move.to] = state.board[move.from]
  delete state.board[move.from]

  // if ep capture, remove the captured pawn
  if (move.flags & BITS.EP_CAPTURE) {
    if (state.turn === BLACK) {
      delete state.board[move.to - 16]
    } else {
      delete state.board[move.to + 16]
    }
  }

  // if pawn promotion, replace with new piece
  if (move.promotion) {
    state.board[move.to] = { type: move.promotion, color: us }
  }

  // if we moved the king
  const piece = state.board[move.to]
  if (piece?.type === KING) {
    state.kings[piece.color] = move.to

    // if we castled, move the rook next to the king
    if (move.flags & BITS.KSIDE_CASTLE) {
      const castling_to = move.to - 1
      const castling_from = move.to + 1
      state.board[castling_to] = state.board[castling_from]
      delete state.board[castling_from]
    } else if (move.flags & BITS.QSIDE_CASTLE) {
      const castling_to = move.to + 1
      const castling_from = move.to - 2
      state.board[castling_to] = state.board[castling_from]
      delete state.board[castling_from]
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
    if (state.turn === BLACK) {
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

  if (state.turn === BLACK) {
    state.move_number++
  }
  state.turn = swapColor(state.turn)
  return state
}

export function buildMove(
  state: Readonly<BoardState>,
  from: number,
  to: number,
  flags: number,
  promotion?: string,
): HexMove | null {
  const piece = state.board[from]
  if (!piece) return null

  const move: HexMove = {
    color: state.turn,
    from: from,
    to: to,
    flags: flags,
    piece: (state.board[from] as Piece).type,
  }

  if (promotion && isPieceSymbol(promotion)) {
    move.flags |= BITS.PROMOTION
    move.promotion = promotion
  }

  if (state.board[to]) {
    move.captured = state.board[to]?.type
  } else if (flags & BITS.EP_CAPTURE) {
    move.captured = PAWN
  }
  return move
}

export function ascii(board: Readonly<Board>, eol = '\n'): string {
  const pieces = RANKS.map((rank) => {
    const rankPieces = board.slice(rank * 16, rank * 16 + 8)
    // Use a loop because `map` skips empty indexes
    const row: string[] = []
    for (const piece of rankPieces) {
      row.push(piece ? ` ${symbol(piece)} ` : ' . ')
    }
    const rankStr = row.join('')

    return '87654321'[rank] + ' |' + rankStr + '|'
  })

  return [
    '  +------------------------+',
    pieces.join(eol),
    '  +------------------------+',
    '    a  b  c  d  e  f  g  h',
  ].join(eol)
}

export function getBoard(board: Readonly<Board>): (Piece | null)[][] {
  const output = []
  let row = []

  for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
    const piece = board[i]
    if (piece == null) {
      row.push(null)
    } else {
      row.push({ type: piece.type, color: piece.color })
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
    const moves = generateMoves(state, { square })
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

export function nodeMove(node: TreeNode<HexState>): Move | null {
  // Need a parent board state to return a valid move
  if (node.model.move && node.parent?.model) {
    return hexToMove(node.parent.model.boardState, node.model.move)
  }
  return null
}

export function hexToGameState(
  node: TreeNode<HexState>,
): Omit<GameState, 'isCurrent'> {
  const move = nodeMove(node)
  return {
    fen: node.model.fen,
    nags: node.model.nags,
    comment: node.model.comment,
    move: move || undefined,
  }
}
