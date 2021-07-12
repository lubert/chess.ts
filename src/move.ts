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
  QUEEN,
  RANK_1,
  RANK_2,
  RANK_7,
  RANK_8,
  RANKS,
  RAYS,
  ROOK,
  ROOKS,
  SHIFTS,
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

/* this function is used to uniquely identify ambiguous moves */
export function getDisambiguator(state: Readonly<BoardState>, move: Readonly<HexMove>, sloppy: boolean): string {
  const moves = generateMoves(state, { legal: !sloppy })

  const from = move.from
  const to = move.to
  const piece = move.piece

  let ambiguities = 0
  let same_rank = 0
  let same_file = 0

  for (let i = 0, len = moves.length; i < len; i++) {
    const ambig_from = moves[i].from
    const ambig_to = moves[i].to
    const ambig_piece = moves[i].piece

    /* if a move of the same piece type ends on the same to square, we'll
     * need to add a disambiguator to the algebraic notation
     */
    if (piece === ambig_piece && from !== ambig_from && to === ambig_to) {
      ambiguities++

      if (rank(from) === rank(ambig_from)) {
        same_rank++
      }

      if (file(from) === file(ambig_from)) {
        same_file++
      }
    }
  }

  if (ambiguities > 0) {
    /* if there exists a similar moving piece on the same rank and file as
     * the move in question, use the square as the disambiguator
     */
    if (same_rank > 0 && same_file > 0) {
      return algebraic(from) || ''
    } else if (same_file > 0) {
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

      fen += color === WHITE ? piece_type.toUpperCase() : piece_type.toLowerCase()
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

  return [fen, state.turn, cflags, epflags, state.half_moves, state.move_number].join(' ')
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
        algebraic(square)
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

export function getPiece(state: Readonly<BoardState>, square?: string): Piece | null {
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
  piece: { type?: string, color?: string }, square?: string
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
  if (type === KING &&
    state.kings[color] !== EMPTY &&
    state.kings[color] !== sq) {
    return null
  }

  state.board[sq] = { type, color }
  if (type === KING) {
    state.kings[color] = sq
  }

  return state
}

export function removePiece(prevState: Readonly<BoardState>, square?: string): BoardState | null {
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

export function generateMoves(
  state: Readonly<BoardState>,
  options: { legal?: boolean, square?: string } = {}
): HexMove[] {
  const { legal = true } = options
  const add_move = (board: Board, moves: HexMove[], from: number, to: number, flags: number) => {
    /* if pawn promotion */
    const piece = board[from]
    if (
      piece &&
        piece.type === PAWN &&
        (rank(to) === RANK_8 || rank(to) === RANK_1)
    ) {
      const pieces = [QUEEN, ROOK, BISHOP, KNIGHT]
      pieces.forEach((piece) => {
        const move = buildMove(state, from, to, flags, piece)
        if (move) moves.push(move)
      })
    } else {
      const move = buildMove(state, from, to, flags)
      if (move) moves.push(move)
    }
  }

  const moves: HexMove[] = []
  const us = state.turn
  const them = swapColor(us)
  const second_rank: { [key: string]: number } = { b: RANK_7, w: RANK_2 }

  let first_sq = SQUARES.a8
  let last_sq = SQUARES.h1
  let single_square = false

  /* are we generating moves for a single square? */
  const { square } = options
  if (square) {
    if (!isSquare(square)) return []
    first_sq = last_sq = SQUARES[square]
    single_square = true
  }

  for (let i = first_sq; i <= last_sq; i++) {
    /* did we run off the end of the board */
    if (i & 0x88) {
      i += 7
      continue
    }

    const piece = state.board[i]
    if (!piece || piece.color !== us) {
      continue
    }

    if (piece.type === PAWN) {
      /* single square, non-capturing */
      const square1 = i + PAWN_OFFSETS[us][0]
      if (!state.board[square1]) {
        add_move(state.board, moves, i, square1, BITS.NORMAL)

        /* double square */
        const square2 = i + PAWN_OFFSETS[us][1]
        if (second_rank[us] === rank(i) && !state.board[square2]) {
          add_move(state.board, moves, i, square2, BITS.BIG_PAWN)
        }
      }

      /* pawn captures */
      for (let j = 2; j < 4; j++) {
        const square = i + PAWN_OFFSETS[us][j]
        if (square & 0x88) continue

        if (state.board[square] && state.board[square]?.color === them) {
          add_move(state.board, moves, i, square, BITS.CAPTURE)
        } else if (square === state.ep_square) {
          add_move(state.board, moves, i, state.ep_square, BITS.EP_CAPTURE)
        }
      }
    } else {
      for (let j = 0, len = PIECE_OFFSETS[piece.type].length; j < len; j++) {
        const offset = PIECE_OFFSETS[piece.type][j]
        let square = i

        while (true) {
          square += offset
          if (square & 0x88) break

          if (!state.board[square]) {
            add_move(state.board, moves, i, square, BITS.NORMAL)
          } else {
            if (state.board[square]?.color === us) break
            add_move(state.board, moves, i, square, BITS.CAPTURE)
            break
          }

          /* break, if knight or king */
          if (piece.type === 'n' || piece.type === 'k') break
        }
      }
    }
  }

  /* check for castling if: a) we're generating all moves, or b) we're doing
   * single square move generation on the king's square
   */
  if (!single_square || last_sq === state.kings[us]) {
    /* king-side castling */
    if (state.castling[us] & BITS.KSIDE_CASTLE) {
      const castling_from = state.kings[us]
      const castling_to = castling_from + 2

      if (
        !state.board[castling_from + 1] &&
          !state.board[castling_to] &&
          !isAttacked(state, them, state.kings[us]) &&
          !isAttacked(state, them, castling_from + 1) &&
          !isAttacked(state, them, castling_to)
      ) {
        add_move(state.board, moves, state.kings[us], castling_to, BITS.KSIDE_CASTLE)
      }
    }

    /* queen-side castling */
    if (state.castling[us] & BITS.QSIDE_CASTLE) {
      const castling_from = state.kings[us]
      const castling_to = castling_from - 2

      if (
        !state.board[castling_from - 1] &&
          !state.board[castling_from - 2] &&
          !state.board[castling_from - 3] &&
          !isAttacked(state, them, state.kings[us]) &&
          !isAttacked(state, them, castling_from - 1) &&
          !isAttacked(state, them, castling_to)
      ) {
        add_move(state.board, moves, state.kings[us], castling_to, BITS.QSIDE_CASTLE)
      }
    }
  }

  /* return all pseudo-legal moves (this includes moves that allow the king
   * to be captured)
   */
  if (!legal) {
    return moves
  }

  /* filter out illegal moves */
  const legal_moves = []
  for (let i = 0, len = moves.length; i < len; i++) {
    const newState = makeMove(state, moves[i])
    if (!isKingAttacked(newState, us)) {
      legal_moves.push(moves[i])
    }
  }

  return legal_moves
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
  options: { sloppy?: boolean, addCheck?: boolean, addPromotion?: boolean } = {}
): string {
  const { sloppy = false, addCheck = true, addPromotion = true } = options
  let output = ''

  if (move.flags & BITS.KSIDE_CASTLE) {
    output = 'O-O'
  } else if (move.flags & BITS.QSIDE_CASTLE) {
    output = 'O-O-O'
  } else {
    const disambiguator = getDisambiguator(state, move, sloppy)

    if (move.piece !== PAWN) {
      output += move.piece.toUpperCase() + disambiguator
    }

    if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
      if (move.piece === PAWN) {
        output += algebraic(move.from)?.[0] || ''
      }
      output += 'x'
    }

    output += algebraic(move.to)

    if (addPromotion && move.flags & BITS.PROMOTION) {
      output += '=' + move.promotion?.toUpperCase()
    }
  }

  const newState = makeMove(state, move)
  if (addCheck && inCheck(newState)) {
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
    disambiguator: matches[2] && matches[2].length === 1 ? matches[2] : undefined,
    from: matches[2] && matches[2].length === 2 ? toSquare(matches[2]) : undefined,
    to: toSquare(matches[3]),
    promotion: matches[4] ? toPieceSymbol(matches[4]) : undefined,
    check: matches[5],
  }
}

export function sanToMove(
  state: Readonly<BoardState>,
  moveStr: string,
  options: { matchCheck?: boolean, matchPromotion?: boolean } = {}
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
    if (from && SQUARES[from] === moves[i].from &&
      to && SQUARES[to] === moves[i].to &&
      (!piece || piece === moves[i].piece) &&
      (!matchPromotion || !promotion || promotion === moves[i].promotion)
    ) {
      return moves[i]
    }
  }
  // Sloppy
  for (let i = 0, len = moves.length; i < len; i++) {
    const sloppySan = moveToSan(state, moves[i], { ...strictOptions, sloppy: true })
    if (san === sloppySan) return moves[i]
  }
  return null
}

export function makePretty(state: Readonly<BoardState>, ugly_move: Readonly<HexMove>): Move {
  const move: HexMove = cloneMove(ugly_move)

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
    san: moveToSan(state, move),
    captured: move.captured,
    promotion: move.promotion,
  }
}

export function isAttacked(state: Readonly<BoardState>, color: string, square: number): boolean {
  for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
    /* did we run off the end of the board */
    if (i & 0x88) {
      i += 7
      continue
    }

    /* if empty square or wrong color */
    if (state.board[i] == null || state.board[i]?.color !== color) continue

    const piece = state.board[i]
    const difference = i - square
    const index = difference + 119

    if (piece && ATTACKS[index] & (1 << SHIFTS[piece.type])) {
      if (piece.type === PAWN) {
        if (difference > 0) {
          if (piece.color === WHITE) return true
        } else {
          if (piece.color === BLACK) return true
        }
        continue
      }

      /* if the piece is a knight or a king */
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

export function isKingAttacked(state: Readonly<BoardState>, color: Color): boolean {
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
  const pieces: {[key: string]: number} = {}
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

export function makeMove(prevState: Readonly<BoardState>, move: Readonly<HexMove>): BoardState {
  const state = prevState.clone()
  const us = state.turn
  const them = swapColor(us)
  // this.push(move)

  state.board[move.to] = state.board[move.from]
  delete state.board[move.from]

  /* if ep capture, remove the captured pawn */
  if (move.flags & BITS.EP_CAPTURE) {
    if (state.turn === BLACK) {
      delete state.board[move.to - 16]
    } else {
      delete state.board[move.to + 16]
    }
  }

  /* if pawn promotion, replace with new piece */
  if (move.flags & BITS.PROMOTION && move.promotion && isPieceSymbol(move.promotion)) {
    state.board[move.to] = { type: move.promotion, color: us }
  }

  /* if we moved the king */
  const piece = state.board[move.to]
  if (piece && piece.type === KING) {
    state.kings[piece.color] = move.to

    /* if we castled, move the rook next to the king */
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

    /* turn off castling */
    state.castling[us] = 0
  }

  /* turn off castling if we move a rook */
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

  /* turn off castling if we capture a rook */
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

  /* if big pawn move, update the en passant square */
  if (move.flags & BITS.BIG_PAWN) {
    if (state.turn === 'b') {
      state.ep_square = move.to - 16
    } else {
      state.ep_square = move.to + 16
    }
  } else {
    state.ep_square = EMPTY
  }

  /* reset the 50 move counter if a pawn is moved or a piece is captured */
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

export function buildMove(state: Readonly<BoardState>, from: number, to: number, flags: number, promotion?: string): HexMove | null {
  const piece = state.board[from]
  if (!piece) return null

  const move: HexMove = {
    color: state.turn,
    from: from,
    to: to,
    flags: flags,
    piece: (state.board[from] as Piece).type
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
  const pieces = RANKS.map(rank => {
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
  options: { matchPromotion?: boolean } = {}
): HexMove | null {
  // Allow the user to specify the sloppy move parser to work around over
  // disambiguation bugs in Fritz and Chessbase
  const { matchPromotion = true } = options

  if (typeof move === 'string') {
    return sanToMove(state, move, options)
  } else if (typeof move === 'object') {
    const square = isSquare(move.from)? move.from : undefined
    const moves = generateMoves(state, { square })
    // Find a matching move
    for (const moveObj of moves) {
      if (
        move.from === algebraic(moveObj.from) &&
          move.to === algebraic(moveObj.to) &&
          (!matchPromotion || !('promotion' in moveObj) ||
            move.promotion === moveObj.promotion)
      ) {
        return moveObj
      }
    }
  }

  return null
}
