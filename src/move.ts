import {
  ATTACKS,
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
  PIECE_MASKS,
  QUEEN,
  RANK_1,
  RANK_2,
  RANK_7,
  RANK_8,
  RANKS,
  RAYS,
  ROOK,
  ROOKS,
  SQUARES,
  WHITE,
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
  options: { legal?: boolean; piece?: PieceSymbol; square?: Square } = {},
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
    // Invalid square
    if (!(forSquare in SQUARES)) return []
    firstSq = lastSq = SQUARES[forSquare]
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

/* convert a move from 0x88 coordinates to Standard Algebraic Notation
 * (SAN)
 *
 * @param {boolean} sloppy Use the sloppy SAN generator to work around over
 * disambiguation bugs in Fritz and Chessbase.  See below:
 *
 * r1bqkbnr/ppp2ppp/2n5/1B1pP3/4P3/8/PPPP2PP/RNBQK1NR b KQkq - 2 4
 * 4. ... Nge7 is overly disambiguated because the knight on c6 is pinned
 * 4. ... Ne7 is technically the valid SAN
 */
export function moveToSan(
  state: Readonly<BoardState>,
  move: Readonly<HexMove>,
  moves: HexMove[],
): string {
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

    if (move.promotion) {
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

export function sanToMove(
  state: Readonly<BoardState>,
  moveStr: string,
  options: { matchCheck?: boolean; matchPromotion?: boolean } = {},
): HexMove | null {
  const { matchCheck = true, matchPromotion = true } = options

  const parsedMove = extractMove(moveStr)
  const { san, piece, from, to, promotion } = parsedMove
  if (!san) return null

  const moves = generateMoves(state, { square: from })
  // Strict
  const strictOptions = { addCheck: matchCheck, addPromotion: matchPromotion }
  for (let i = 0, len = moves.length; i < len; i++) {
    const strictSan = moveToSan(state, moves[i], strictOptions)
    if (san === strictSan) {
      return moves[i]
    }
    if (
      from &&
      SQUARES[from] === moves[i].from &&
      to &&
      SQUARES[to] === moves[i].to &&
      (!piece || piece === moves[i].piece) &&
      (!matchPromotion || !promotion || promotion === moves[i].promotion)
    ) {
      return moves[i]
    }
  }
  // Sloppy
  for (let i = 0, len = moves.length; i < len; i++) {
    const sloppySan = moveToSan(state, moves[i], {
      ...strictOptions,
      sloppy: true,
    })
    if (san === sloppySan) return moves[i]
  }
  return null
}

export function hexToMove(
  state: Readonly<BoardState>,
  hexMove: Readonly<HexMove>,
): Move {
  let flags = ''
  for (const flag in BITS) {
    if (isFlagKey(flag) && BITS[flag] & hexMove.flags) {
      flags += FLAGS[flag]
    }
  }

  return {
    to: algebraic(hexMove.to) as Square,
    from: algebraic(hexMove.from) as Square,
    color: hexMove.color,
    flags,
    piece: hexMove.piece,
    san: moveToSan(state, hexMove),
    captured: hexMove.captured,
    promotion: hexMove.promotion,
  }
}

export function isAttacked(
  state: Readonly<BoardState>,
  color: Color,
  square: number,
): boolean {
  for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
    // did we run off the end of the board
    if (i & 0x88) {
      i += 7
      continue
    }

    // if empty square or wrong color
    if (state.board[i] === undefined || state.board[i]?.color !== color)
      continue

    const piece = state.board[i]
    const difference = i - square

    // skip if to/from square are the same
    if (difference === 0) continue

    const index = difference + 119

    if (piece && ATTACKS[index] & PIECE_MASKS[piece.type]) {
      if (piece.type === PAWN) {
        if (difference > 0) {
          if (piece.color === WHITE) return true
        } else {
          if (piece.color === BLACK) return true
        }
        continue
      }

      // if the piece is a knight or a king
      if (piece.type === 'n' || piece.type === 'k') return true

      const offset = RAYS[index]
      let j = i + offset

      let blocked = false
      while (j !== square) {
        if (state.board[j]) {
          blocked = true
          break
        }
        j += offset
      }

      if (!blocked) return true
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
    if (state.turn === 'b') {
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
  options: { matchPromotion?: boolean } = {},
): HexMove | null {
  // Allow the user to specify the sloppy move parser to work around over
  // disambiguation bugs in Fritz and Chessbase
  const { matchPromotion = true } = options

  if (typeof move === 'string') {
    return sanToMove(state, move, options)
  } else if (typeof move === 'object') {
    const square = isSquare(move.from) ? move.from : undefined
    const moves = generateMoves(state, { square })
    // Find a matching move
    for (const moveObj of moves) {
      if (
        move.from === algebraic(moveObj.from) &&
        move.to === algebraic(moveObj.to) &&
        (!matchPromotion ||
          !('promotion' in moveObj) ||
          move.promotion === moveObj.promotion)
      ) {
        return moveObj
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
