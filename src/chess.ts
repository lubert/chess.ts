/*
 * Copyright (c) 2020, Jeff Hlywa (jhlywa@gmail.com)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 *----------------------------------------------------------------------------*/

import {
  algebraic,
  clone,
  file,
  isDigit,
  isColor,
  isFlagKey,
  isPieceSymbol,
  isSquare,
  rank,
  swapColor,
  symbol,
} from "./utils";
import {
  ATTACKS,
  BISHOP,
  BITS,
  BLACK,
  DEFAULT_POSITION,
  EMPTY,
  FLAGS,
  KING,
  KNIGHT,
  PAWN,
  PAWN_OFFSETS,
  PIECE_OFFSETS,
  POSSIBLE_RESULTS,
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
} from "./constants";

export class Chess {
  protected _state: State;
  protected _history: HistoryState[];
  protected _header: Header;
  protected _comments: Comments;

  constructor(fen: string = DEFAULT_POSITION) {
    this._state = {
      board: new Array(128),
      kings: { w: EMPTY, b: EMPTY },
      turn: WHITE,
      castling: { w: 0, b: 0 },
      ep_square: EMPTY,
      half_moves: 0,
      move_number: 1
    }
    this._history = []
    this._header = {}
    this._comments = {}

    if (!this.load(fen)) {
      throw new Error('Invalid FEN')
    }
  }

  /**
   * Clears the board and loads the Forsyth–Edwards Notation (FEN) string.
   *
   * @param fen
   * @param keep_headers Flag to keep headers
   * @return True if the position was successfully loaded, otherwise false.
   */
  public load(fen: string, keep_headers = false): boolean {
    const tokens = fen.split(/\s+/)
    const position = tokens[0]
    let square = 0

    if (!this.validateFen(fen).valid) {
      return false
    }

    this.clear(keep_headers)

    for (let i = 0; i < position.length; i++) {
      const piece = position.charAt(i)

      if (piece === '/') {
        square += 8
      } else if (isDigit(piece)) {
        square += parseInt(piece, 10)
      } else {
        const color = piece < 'a' ? WHITE : BLACK
        if (!this.put({ type: piece.toLowerCase(), color: color }, algebraic(square))) {
          return false
        }
        square++
      }
    }

    this._state.turn = tokens[1] === BLACK ? BLACK : WHITE

    if (tokens[2].indexOf('K') > -1) {
      this._state.castling.w |= BITS.KSIDE_CASTLE
    }
    if (tokens[2].indexOf('Q') > -1) {
      this._state.castling.w |= BITS.QSIDE_CASTLE
    }
    if (tokens[2].indexOf('k') > -1) {
      this._state.castling.b |= BITS.KSIDE_CASTLE
    }
    if (tokens[2].indexOf('q') > -1) {
      this._state.castling.b |= BITS.QSIDE_CASTLE
    }

    this._state.ep_square = tokens[3] === '-' ? EMPTY : SQUARES[tokens[3] as Square]
    this._state.half_moves = parseInt(tokens[4], 10)
    this._state.move_number = parseInt(tokens[5], 10)

    this.updateSetup(this.fen())

    return true
  }

  /**
   * Clears the board
   *
   * @param keep_headers Flag to keep headers
   */
  public clear(keep_headers = false): void {
    this._state = {
      board: new Array(128),
      kings: { w: EMPTY, b: EMPTY },
      turn: WHITE,
      castling: { w: 0, b: 0 },
      ep_square: EMPTY,
      half_moves: 0,
      move_number: 1
    }
    this._history = []
    if (!keep_headers) this._header = {}
    this._comments = {}
    this.updateSetup(this.fen())
  }

  /**
   * Reset the board to the initial starting position.
   */
  public reset() {
    this.load(DEFAULT_POSITION)
  }

  /**
   * Returns the piece on the square.
   *
   * @param square e.g. 'e4'
   * @return Copy of the piece or null
   */
  public get(square?: string): Piece | null {
    if (!square) return null
    square = square.toLowerCase()
    if (!isSquare(square)) return null

    const sq = SQUARES[square]
    if (this._state.board[sq]) {
      return clone(this._state.board[sq])
    }
    return null
  }


  /**
   * Place a piece on a square. Fails when passed an invalid piece or square,
   * or when two or more kings of the same color are placed.
   *
   * @param piece Object of the form { type: ..., color: ... }
   * @param square e.g. 'e4'
   * @return True if placed successfully, otherwise false
   */
  public put(piece: { type?: string, color?: string }, square?: string): boolean {
    let { type, color } = piece

    /* check for presence */
    if (!type || !color || !square) {
      return false
    }

    type = type.toLowerCase()
    color = color.toLowerCase()
    square = square.toLowerCase()

    /* check for valid params */
    if (!isPieceSymbol(type) || !isColor(color) || !isSquare(square)) {
      return false
    }

    /* don't let the user place more than one king */
    const sq = SQUARES[square]
    if (type === KING &&
        this._state.kings[color] !== EMPTY &&
        this._state.kings[color] !== sq) {
      return false
    }

    this._state.board[sq] = { type, color }
    if (type === KING) {
      this._state.kings[color] = sq
    }

    this.updateSetup(this.fen())

    return true
  }

  /**
   * Removes and returns the piece on a square.
   *
   * @param square e.g. 'e4'
   * @return Piece or null
   */
  public remove(square?: string): Piece | null {
    if (!square) return null

    square = square.toLowerCase()
    if (!isSquare(square)) return null

    const sq = SQUARES[square]
    const piece = this._state.board[sq]
    if (!piece) return null

    const { type, color } = piece
    if (type === KING) {
      this._state.kings[color] = EMPTY
    }

    delete this._state.board[sq]
    return piece
  }


  /**
   * Returns a list of legal moves from the current position.
   *
   * @param square e.g. 'e4'
   * @return Piece or null
   */
  public moves(options: { square?: string, verbose?: boolean} = {}) {
    // The internal representation of a chess move is in 0x88 format, and
    // not meant to be human-readable.  The code below converts the 0x88
    // square coordinates to algebraic coordinates.  It also prunes an
    // unnecessary move keys resulting from a verbose call.
    let { square, verbose = false } = options
    const ugly_moves = this.generateMoves({ square })
    const moves = []

    for (let i = 0, len = ugly_moves.length; i < len; i++) {
      if (verbose) {
        moves.push(this.makePretty(ugly_moves[i]))
      } else {
        moves.push(this.moveToSan(ugly_moves[i], false))
      }
    }

    return moves
  }

  /**
   * Returns the FEN string for the current position.
   */
  public fen(): string {
    let empty = 0
    let fen = ''

    for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
      const piece = this._state.board[i]
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
    if (this._state.castling[WHITE] & BITS.KSIDE_CASTLE) {
      cflags += 'K'
    }
    if (this._state.castling[WHITE] & BITS.QSIDE_CASTLE) {
      cflags += 'Q'
    }
    if (this._state.castling[BLACK] & BITS.KSIDE_CASTLE) {
      cflags += 'k'
    }
    if (this._state.castling[BLACK] & BITS.QSIDE_CASTLE) {
      cflags += 'q'
    }

    /* do we have an empty castling flag? */
    cflags = cflags || '-'
    const epflags = this._state.ep_square === EMPTY ? '-' : algebraic(this._state.ep_square)

    return [fen, this._state.turn, cflags, epflags, this._state.half_moves, this._state.move_number].join(' ')
  }

  /**
   * Returns true or false if the side to move is in check.
   */
  public inCheck() {
    return this.kingAttacked(this._state.turn)
  }

  /**
   * Returns true or false if the side to move has been checkmated.
   */
  public inCheckmate() {
    return this.inCheck() && this.generateMoves().length === 0
  }

  /**
   * Returns true or false if the side to move has been stalemated.
   */
  public inStalemate() {
    return !this.inCheck() && this.generateMoves().length === 0
  }

  /**
   * Returns true if the game is drawn due to insufficient material, i.e.
   * K vs. K, K vs. KB, or K vs. KN.
   */
  public insufficientMaterial(): boolean {
    const pieces: {[key: string]: number} = {}
    const bishops = []
    let num_pieces = 0
    let sq_color = 0

    for (var i = SQUARES.a8; i <= SQUARES.h1; i++) {
      sq_color = (sq_color + 1) % 2
      if (i & 0x88) {
        i += 7
        continue
      }

      const piece = this._state.board[i]
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
      for (var i = 0; i < len; i++) {
        sum += bishops[i]
      }
      if (sum === 0 || sum === len) {
        return true
      }
    }

    return false
  }

  /**
   * Returns true or false if the current board position has occurred three or
   * more times.
   */
  public inThreefoldRepetition() {
    /* TODO: while this function is fine for casual use, a better
     * implementation would use a Zobrist key (instead of FEN). the
     * Zobrist key would be maintained in the make_move/undo_move functions,
     * avoiding the costly that we do below.
     */
    const moves: Move[] = []
    const positions: { [key: string]: number } = {}
    let repetition = false

    while (true) {
      const move = this.undoMove()
      if (!move) break
      moves.push(move)
    }

    while (true) {
      /* remove the last two fields in the FEN string, they're not needed
       * when checking for draw by rep */
      const fen = this.fen()
        .split(' ')
        .slice(0, 4)
        .join(' ')

      /* has the position occurred three or move times */
      positions[fen] = fen in positions ? positions[fen] + 1 : 1
      if (positions[fen] >= 3) {
        repetition = true
      }

      if (!moves.length) {
        break
      }
      this.makeMove(moves.pop() as Move)
    }

    return repetition
  }

  /**
   * Returns true or false if the game is drawn, checking the 50-move rule and
   * insufficient material.
   */
  public inDraw() {
    return (
      this._state.half_moves >= 100 ||
        this.inStalemate() ||
        this.insufficientMaterial() ||
        this.inThreefoldRepetition()
    )
  }

  /**
   * Returns true if the game has ended via checkmate, stalemate, draw,
   * threefold repetition, or insufficient material.
   */
  public gameOver() {
    return this.inCheckmate() || this.inDraw()
  }

  /**
   * Returns an 2D array representation of the current position. Empty squares
   * are represented by null.
   */
  public board() {
    const output = []
    let row = []

    for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
      const piece = this._state.board[i]
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

  /**
   * Returns the game in PGN format
   * @param options.newline_char
   * @param options.max_width
   * @return PGN
   */
  public pgn(options: { newline_char?: string, max_width?: number } = {}): string {
    /* using the specification from http://www.chessclub.com/help/PGN-spec
     * example for html usage: .pgn({ max_width: 72, newline_char: "<br />" })
     */
    const {
      newline_char: newline = '\n',
      max_width = 0
    } = options

    const result: string[] = []
    let header_exists = false

    /* add the PGN header headerrmation */
    for (const i in this._header) {
      /* TODO: order of enumerated properties in header object is not
       * guaranteed, see ECMA-262 spec (section 12.6.4)
       */
      result.push('[' + i + ' "' + this._header[i] + '"]' + newline)
      header_exists = true
    }

    if (header_exists && this._history.length) {
      result.push(newline)
    }

    const append_comment = (move_string: string): string => {
      const comment = this._comments[this.fen()]
      if (typeof comment !== 'undefined') {
        const delimiter = move_string.length > 0 ? ' ' : '';
        move_string = `${move_string}${delimiter}{${comment}}`
      }
      return move_string
    }

    /* pop all of history onto reversed_history */
    const reversed_history = []
    while (this._history.length > 0) {
      reversed_history.push(this.undoMove())
    }

    var moves = []
    var move_string = ''

    /* special case of a commented starting position with no moves */
    if (reversed_history.length === 0) {
      moves.push(append_comment(''))
    }

    /* build the list of moves.  a move_string looks like: "3. e3 e6" */
    while (reversed_history.length > 0) {
      move_string = append_comment(move_string)
      var move = reversed_history.pop()

      /* if the position started with black to move, start PGN with 1. ... */
      if (!this._history.length && move?.color === 'b') {
        move_string = this._state.move_number + '. ...'
      } else if (move?.color === 'w') {
        /* store the previous generated move_string if we have one */
        if (move_string.length) {
          moves.push(move_string)
        }
        move_string = this._state.move_number + '.'
      }

      if (move) {
        move_string = move_string + ' ' + this.moveToSan(move, false)
        this.makeMove(move)
      }
    }

    /* are there any other leftover moves? */
    if (move_string.length) {
      moves.push(append_comment(move_string))
    }

    /* is there a result? */
    if (typeof this._header.Result !== 'undefined') {
      moves.push(this._header.Result)
    }

    /* history should be back to what it was before we started generating PGN,
     * so join together moves
     */
    if (max_width === 0) {
      return result.join('') + moves.join(' ')
    }

    var strip = function() {
      if (result.length > 0 && result[result.length - 1] === ' ') {
        result.pop();
        return true;
      }
      return false;
    };

    /* NB: this does not preserve comment whitespace. */
    const wrap_comment = (width: number, move: string): number => {
      for (var token of move.split(' ')) {
        if (!token) {
          continue;
        }
        if (width + token.length > max_width) {
          while (strip()) {
            width--;
          }
          result.push(newline);
          width = 0;
        }
        result.push(token);
        width += token.length;
        result.push(' ');
        width++;
      }
      if (strip()) {
        width--;
      }
      return width;
    };

    /* wrap the PGN output at max_width */
    let current_width = 0
    for (let i = 0; i < moves.length; i++) {
      if (current_width + moves[i].length > max_width) {
        if (moves[i].includes('{')) {
          current_width = wrap_comment(current_width, moves[i]);
          continue;
        }
      }
      /* if the current move will push past max_width */
      if (current_width + moves[i].length > max_width && i !== 0) {
        /* don't end the line with whitespace */
        if (result[result.length - 1] === ' ') {
          result.pop()
        }

        result.push(newline)
        current_width = 0
      } else if (i !== 0) {
        result.push(' ')
        current_width++
      }
      result.push(moves[i])
      current_width += moves[i].length
    }

    return result.join('')
  }

  /**
   * Load the moves of a game stored in Portable Game Notation (PGN).
   *
   * @param options.newline_char String representation of a valid RegExp fragment
   * @param options.sloppy Flag to allow parsing non-standard notations
   * @return PGN
   */
  public loadPgn(
    pgn: string,
    options: { newline_char?: string, sloppy?: boolean } = {}
  ): boolean {
    const {
      newline_char = '\r?\n',
      // allow the user to specify the sloppy move parser to work around over
      // disambiguation bugs in Fritz and Chessbase
      sloppy = false
    } = options

    const mask = (str: string): string => {
      return str.replace(/\\/g, '\\')
    }

    const has_keys = (object: Object): boolean => {
      for (const key in object) {
        return true
      }
      return false
    }

    const parse_pgn_header = (
      header: string,
      options: { newline_char: string, sloppy: boolean }
    ): Header => {
      const newline_char = options.newline_char
      const header_obj: { [key: string]: string } = {}
      const headers = header.split(new RegExp(mask(newline_char)))
      let key = ''
      let value = ''

      for (let i = 0; i < headers.length; i++) {
        key = headers[i].replace(/^\[([A-Z][A-Za-z]*)\s.*\]$/, '$1')
        value = headers[i].replace(/^\[[A-Za-z]+\s"(.*)"\ *\]$/, '$1')
        if (key.trim().length > 0) {
          header_obj[key.trim()] = value
        }
      }

      return header_obj
    }

    // RegExp to split header. Takes advantage of the fact that header and movetext
    // will always have a blank line between them (ie, two newline_char's).
    // With default newline_char, will equal: /^(\[((?:\r?\n)|.)*\])(?:\r?\n){2}/
    const header_regex = new RegExp(
      '^(\\[((?:' +
        mask(newline_char) +
        ')|.)*\\])' +
        '(?:' +
        mask(newline_char) +
        '){2}'
    )

    // If no header given, begin with moves.
    const header_string = header_regex.test(pgn) ? (header_regex.exec(pgn) as string[])[1] : ''

    // Put the board in the starting position
    this.reset()

    /* parse PGN header */
    const headers = parse_pgn_header(header_string, { newline_char, sloppy })
    for (const key in headers) {
      this.header([key, headers[key] as string])
    }

    /* load the starting position indicated by [Setup '1'] and
     * [FEN position] */
    if (headers['SetUp'] === '1') {
      if (!('FEN' in headers && this.load(headers['FEN'] as string, true))) {
        // second argument to load: don't clear the headers
        return false
      }
    }

    /* NB: the regexes below that delete move numbers, recursive
     * annotations, and numeric annotation glyphs may also match
     * text in comments. To prevent this, we transform comments
     * by hex-encoding them in place and decoding them again after
     * the other tokens have been deleted.
     *
     * While the spec states that PGN files should be ASCII encoded,
     * we use {en,de}codeURIComponent here to support arbitrary UTF8
     * as a convenience for modern users */

    const to_hex = (str: string): string => {
      return Array
        .from(str)
        .map(function(c) {
          /* encodeURI doesn't transform most ASCII characters,
           * so we handle these ourselves */
          return c.charCodeAt(0) < 128
            ? c.charCodeAt(0).toString(16)
            : encodeURIComponent(c).replace(/\%/g, '').toLowerCase()
        })
        .join('')
    }

    const from_hex = (str: string): string => {
      return str.length == 0
        ? ''
        : decodeURIComponent('%' + str?.match(/.{1,2}/g)?.join('%'))
    }

    const encode_comment = function(str: string) {
      str = str.replace(new RegExp(mask(newline_char), 'g'), ' ')
      return `{${to_hex(str.slice(1, str.length - 1))}}`
    }

    const decode_comment = function(str: string) {
      if (str.startsWith('{') && str.endsWith('}')) {
        return from_hex(str.slice(1, str.length - 1))
      }
    }

    /* delete header to get the moves */
    let ms = pgn
      .replace(header_string, '')
      .replace(
        /* encode comments so they don't get deleted below */
        new RegExp(`(\{[^}]*\})+?|;([^${mask(newline_char)}]*)`, 'g'),
        (match, bracket, semicolon) => {
          return bracket !== undefined
            ? encode_comment(bracket)
            : ' ' + encode_comment(`{${semicolon.slice(1)}}`)
        }
      )
      .replace(new RegExp(mask(newline_char), 'g'), ' ')

    /* delete recursive annotation variations */
    const rav_regex = /(\([^\(\)]+\))+?/g
    while (rav_regex.test(ms)) {
      ms = ms.replace(rav_regex, '')
    }

    /* delete move numbers */
    ms = ms.replace(/\d+\.(\.\.)?/g, '')

    /* delete ... indicating black to move */
    ms = ms.replace(/\.\.\./g, '')

    /* delete numeric annotation glyphs */
    ms = ms.replace(/\$\d+/g, '')

    /* trim and get array of moves */
    let moves = ms.trim().split(new RegExp(/\s+/))

    /* delete empty entries */
    moves = moves
      .join(',')
      .replace(/,,+/g, ',')
      .split(',')

    for (let half_move = 0; half_move < moves.length - 1; half_move++) {
      const comment = decode_comment(moves[half_move])
      if (comment !== undefined) {
        this._comments[this.fen()] = comment
        continue
      }
      const move = this.sanToMove(moves[half_move], sloppy)

      /* move not possible! (don't clear the board to examine to show the
       * latest valid position)
       */
      if (move == null) {
        return false
      } else {
        this.makeMove(move)
      }
    }

    const comment = decode_comment(moves[moves.length - 1])
    if (comment !== undefined) {
      this._comments[this.fen()] = comment
      moves.pop()
    }

    /* examine last move */
    const move_str = moves[moves.length - 1]
    if (POSSIBLE_RESULTS.indexOf(move_str) > -1) {
      if (has_keys(this._header) && typeof this._header.Result === 'undefined') {
        this.header(['Result', move_str])
      }
    } else {
      const move = this.sanToMove(move_str, sloppy)
      if (move == null) {
        return false
      } else {
        this.makeMove(move)
      }
    }
    return true
  }

  /**
   * Adds header information to the PGN output. Calling without any arguments
   * returns the header information as an object.
   *
   * @param args List of strings
   * @return Key/value pairs
   */
  public header(args: string[]): Header {
    for (let i = 0; i < args.length; i += 2) {
      if (typeof args[i] === 'string' && typeof args[i + 1] === 'string') {
        this._header[args[i]] = args[i + 1]
      }
    }
    return this._header
  }

  public ascii(eol = '\n'): string {
    const pieces = RANKS.map(rank => {
      const rankPieces = this._state.board
        .slice(rank * 16, rank * 16 + 8)
        .map(piece => {
          if (piece) {
            return ` ${symbol(piece)} `
          } else {
            return ' . '
          }
        })
        .join('')

      return '87654321'[rank] + ' |' + rankPieces + '|'
    })

    return [
      '  +------------------------+',
      pieces.join(eol),
      '  +------------------------+',
      '    a  b  c  d  e  f  g  h',
    ].join(eol)
  }

  public turn() {
    return this._state.turn
  }

  public move(
    move: string | PrettyMove,
    options: { sloppy: boolean } = { sloppy: false }
  ): PrettyMove | null {
    /* The move function can be called with in the following parameters:
     *
     * .move('Nxb7')      <- where 'move' is a case-sensitive SAN string
     *
     * .move({ from: 'h7', <- where the 'move' is a move object (additional
     *         to :'h8',      fields are ignored)
     *         promotion: 'q',
     *      })
     */

    // allow the user to specify the sloppy move parser to work around over
    // disambiguation bugs in Fritz and Chessbase
    const sloppy = options.sloppy

    let move_obj = null

    if (typeof move === 'string') {
      move_obj = this.sanToMove(move, sloppy)
    } else if (typeof move === 'object') {
      const moves = this.generateMoves()

      /* convert the pretty move object to an ugly move object */
      for (let i = 0, len = moves.length; i < len; i++) {
        if (
          move.from === algebraic(moves[i].from) &&
            move.to === algebraic(moves[i].to) &&
            (!('promotion' in moves[i]) ||
              move.promotion === moves[i].promotion)
        ) {
          move_obj = moves[i]
          break
        }
      }
    }

    /* failed to find move */
    if (!move_obj) {
      return null
    }

    /* need to make a copy of move because we can't generate SAN after the
     * move is made
     */
    const pretty_move = this.makePretty(move_obj)

    this.makeMove(move_obj)

    return pretty_move
  }

  public undo(): PrettyMove | null {
    const move = this.undoMove()
    return move ? this.makePretty(move) : null
  }

  public squareColor(square: string): string | null {
    if (isSquare(square)) {
      const sq_0x88 = SQUARES[square]
      return (rank(sq_0x88) + file(sq_0x88)) % 2 === 0 ? 'light' : 'dark'
    }

    return null
  }

  public history(options: { verbose: boolean } = { verbose: false }) {
    const reversed_history: Array<Move | null> = []
    const move_history: Array<string | PrettyMove> = []
    const verbose = options.verbose;

    while (this._history.length > 0) {
      reversed_history.push(this.undoMove())
    }

    while (reversed_history.length > 0) {
      let move = reversed_history.pop() as Move
      if (verbose) {
        move_history.push(this.makePretty(move))
      } else {
        move_history.push(this.moveToSan(move))
      }
      this.makeMove(move)
    }

    return move_history
  }

  public getComment(): string {
    return this._comments[this.fen()];
  }

  public setComment(comment: string): void {
    this._comments[this.fen()] = comment.replace('{', '[').replace('}', ']');
  }

  public deleteComment(): string {
    const comment = this._comments[this.fen()];
    delete this._comments[this.fen()];
    return comment;
  }

  public getComments() {
    this.pruneComments();
    return Object.keys(this._comments).map((fen) => {
      return {fen: fen, comment: this._comments[fen]};
    });
  }

  public deleteComments() {
    this.pruneComments();
    return Object.keys(this._comments)
      .map((fen) => {
        var comment = this._comments[fen];
        delete this._comments[fen];
        return {fen: fen, comment: comment};
      });
  }

  public perft(depth: number): number {
    const moves = this.generateMoves({ legal: false })
    let nodes = 0
    const color = this._state.turn

    for (var i = 0, len = moves.length; i < len; i++) {
      this.makeMove(moves[i])
      if (!this.kingAttacked(color)) {
        if (depth - 1 > 0) {
          var child_nodes = this.perft(depth - 1)
          nodes += child_nodes
        } else {
          nodes++
        }
      }
      this.undoMove()
    }

    return nodes
  }

  /* TODO: this function is pretty much crap - it validates structure but
   * completely ignores content (e.g. doesn't verify that each side has a king)
   * ... we should rewrite this, and ditch the silly error_number field while
   * we're at it
   */
  protected validateFen(fen: string): Validation {
    const errors: { [key: number]: string } = {
      0: 'No errors.',
      1: 'FEN string must contain six space-delimited fields.',
      2: '6th field (move number) must be a positive integer.',
      3: '5th field (half move counter) must be a non-negative integer.',
      4: '4th field (en-passant square) is invalid.',
      5: '3rd field (castling availability) is invalid.',
      6: '2nd field (side to move) is invalid.',
      7: "1st field (piece positions) does not contain 8 '/'-delimited rows.",
      8: '1st field (piece positions) is invalid [consecutive numbers].',
      9: '1st field (piece positions) is invalid [invalid piece].',
      10: '1st field (piece positions) is invalid [row too large].',
      11: 'Illegal en-passant square'
    }

    /* 1st criterion: 6 space-seperated fields? */
    const tokens = fen.split(/\s+/)
    if (tokens.length !== 6) {
      return { valid: false, error_number: 1, error: errors[1] }
    }

    /* 2nd criterion: move number field is a integer value > 0? */
    if (isNaN(tokens[5] as any) || parseInt(tokens[5], 10) <= 0) {
      return { valid: false, error_number: 2, error: errors[2] }
    }

    /* 3rd criterion: half move counter is an integer >= 0? */
    if (isNaN(tokens[4] as any) || parseInt(tokens[4], 10) < 0) {
      return { valid: false, error_number: 3, error: errors[3] }
    }

    /* 4th criterion: 4th field is a valid e.p.-string? */
    if (!/^(-|[abcdefgh][36])$/.test(tokens[3])) {
      return { valid: false, error_number: 4, error: errors[4] }
    }

    /* 5th criterion: 3th field is a valid castle-string? */
    if (!/^(KQ?k?q?|Qk?q?|kq?|q|-)$/.test(tokens[2])) {
      return { valid: false, error_number: 5, error: errors[5] }
    }

    /* 6th criterion: 2nd field is "w" (white) or "b" (black)? */
    if (!/^(w|b)$/.test(tokens[1])) {
      return { valid: false, error_number: 6, error: errors[6] }
    }

    /* 7th criterion: 1st field contains 8 rows? */
    const rows = tokens[0].split('/')
    if (rows.length !== 8) {
      return { valid: false, error_number: 7, error: errors[7] }
    }

    /* 8th criterion: every row is valid? */
    for (let i = 0; i < rows.length; i++) {
      /* check for right sum of fields AND not two numbers in succession */
      let sum_fields = 0
      let previous_was_number = false

      for (var k = 0; k < rows[i].length; k++) {
        if (!isNaN(rows[i][k] as any)) {
          if (previous_was_number) {
            return { valid: false, error_number: 8, error: errors[8] }
          }
          sum_fields += parseInt(rows[i][k], 10)
          previous_was_number = true
        } else {
          if (!/^[prnbqkPRNBQK]$/.test(rows[i][k])) {
            return { valid: false, error_number: 9, error: errors[9] }
          }
          sum_fields += 1
          previous_was_number = false
        }
      }
      if (sum_fields !== 8) {
        return { valid: false, error_number: 10, error: errors[10] }
      }
    }

    if (
      (tokens[3][1] == '3' && tokens[1] == 'w') ||
      (tokens[3][1] == '6' && tokens[1] == 'b')
    ) {
      return { valid: false, error_number: 11, error: errors[11] }
    }

    /* everything's okay! */
    return { valid: true, error_number: 0, error: errors[0] }
  }

  protected makePretty(ugly_move: Move): PrettyMove {
    const move: Move = clone(ugly_move)

    let flags = ''
    for (const flag in BITS) {
      if (isFlagKey(flag) && BITS[flag] & move.flags) {
        flags += FLAGS[flag]
      }
    }

    return {
      to: algebraic(move.to),
      from: algebraic(move.from),
      color: move.color,
      flags,
      piece: move.piece,
      san: this.moveToSan(move, false),
      captured: move.captured,
      promotion: move.promotion,
    }
  }

  /* called when the initial board setup is changed with put() or remove().
   * modifies the SetUp and FEN properties of the header object.  if the FEN is
   * equal to the default position, the SetUp and FEN are deleted
   * the setup is only updated if history.length is zero, ie moves haven't been
   * made.
   */
  protected updateSetup(fen: string) {
    if (this._history.length > 0) return

    if (fen !== DEFAULT_POSITION) {
      this._header['SetUp'] = '1'
      this._header['FEN'] = fen
    } else {
      delete this._header['SetUp']
      delete this._header['FEN']
    }
  }

  protected generateMoves(options: { legal?: boolean, square?: string } = {}) {
    let { legal = true, square } = options
    const add_move = (board: Board, moves: Move[], from: number, to: number, flags: number) => {
      /* if pawn promotion */
      const piece = board[from]
      if (
        piece &&
          piece.type === PAWN &&
          (rank(to) === RANK_8 || rank(to) === RANK_1)
      ) {
        var pieces = [QUEEN, ROOK, BISHOP, KNIGHT]
        for (var i = 0, len = pieces.length; i < len; i++) {
          moves.push(this.buildMove(board, from, to, flags, pieces[i]))
        }
      } else {
        moves.push(this.buildMove(board, from, to, flags))
      }
    }

    let moves: Move[] = []
    let us = this._state.turn
    let them = swapColor(us)
    let second_rank: { [key: string]: number } = { b: RANK_7, w: RANK_2 }

    let first_sq = SQUARES.a8
    let last_sq = SQUARES.h1
    let single_square = false

    /* are we generating moves for a single square? */
    if (square) {
      square = square.toLowerCase()
      if (isSquare(square)) {
        first_sq = last_sq = SQUARES[square]
        single_square = true
      } else {
        /* invalid square */
        return []
      }
    }

    for (let i = first_sq; i <= last_sq; i++) {
      /* did we run off the end of the board */
      if (i & 0x88) {
        i += 7
        continue
      }

      const piece = this._state.board[i]
      if (!piece || piece.color !== us) {
        continue
      }

      if (piece.type === PAWN) {
        /* single square, non-capturing */
        let square1 = i + PAWN_OFFSETS[us][0]
        if (!this._state.board[square1]) {
          add_move(this._state.board, moves, i, square1, BITS.NORMAL)

          /* double square */
          let square2 = i + PAWN_OFFSETS[us][1]
          if (second_rank[us] === rank(i) && !this._state.board[square2]) {
            add_move(this._state.board, moves, i, square2, BITS.BIG_PAWN)
          }
        }

        /* pawn captures */
        for (let j = 2; j < 4; j++) {
          let square = i + PAWN_OFFSETS[us][j]
          if (square & 0x88) continue

          if (this._state.board[square] && this._state.board[square]?.color === them) {
            add_move(this._state.board, moves, i, square, BITS.CAPTURE)
          } else if (square === this._state.ep_square) {
            add_move(this._state.board, moves, i, this._state.ep_square, BITS.EP_CAPTURE)
          }
        }
      } else {
        for (let j = 0, len = PIECE_OFFSETS[piece.type].length; j < len; j++) {
          const offset = PIECE_OFFSETS[piece.type][j]
          let square = i

          while (true) {
            square += offset
            if (square & 0x88) break

            if (!this._state.board[square]) {
              add_move(this._state.board, moves, i, square, BITS.NORMAL)
            } else {
              if (this._state.board[square]?.color === us) break
              add_move(this._state.board, moves, i, square, BITS.CAPTURE)
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
    if (!single_square || last_sq === this._state.kings[us]) {
      /* king-side castling */
      if (this._state.castling[us] & BITS.KSIDE_CASTLE) {
        const castling_from = this._state.kings[us]
        const castling_to = castling_from + 2

        if (
          !this._state.board[castling_from + 1] &&
          !this._state.board[castling_to] &&
          !this.attacked(them, this._state.kings[us]) &&
          !this.attacked(them, castling_from + 1) &&
          !this.attacked(them, castling_to)
        ) {
          add_move(this._state.board, moves, this._state.kings[us], castling_to, BITS.KSIDE_CASTLE)
        }
      }

      /* queen-side castling */
      if (this._state.castling[us] & BITS.QSIDE_CASTLE) {
        const castling_from = this._state.kings[us]
        const castling_to = castling_from - 2

        if (
          !this._state.board[castling_from - 1] &&
          !this._state.board[castling_from - 2] &&
          !this._state.board[castling_from - 3] &&
          !this.attacked(them, this._state.kings[us]) &&
          !this.attacked(them, castling_from - 1) &&
          !this.attacked(them, castling_to)
        ) {
          add_move(this._state.board, moves, this._state.kings[us], castling_to, BITS.QSIDE_CASTLE)
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
    for (var i = 0, len = moves.length; i < len; i++) {
      this.makeMove(moves[i])
      if (!this.kingAttacked(us)) {
        legal_moves.push(moves[i])
      }
      this.undoMove()
    }

    return legal_moves
  }

  /* this function is used to uniquely identify ambiguous moves */
  protected getDisambiguator(move: Move, sloppy: boolean) {
    var moves = this.generateMoves({ legal: !sloppy })

    var from = move.from
    var to = move.to
    var piece = move.piece

    var ambiguities = 0
    var same_rank = 0
    var same_file = 0

    for (var i = 0, len = moves.length; i < len; i++) {
      var ambig_from = moves[i].from
      var ambig_to = moves[i].to
      var ambig_piece = moves[i].piece

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
        return algebraic(from)
      } else if (same_file > 0) {
        /* if the moving piece rests on the same file, use the rank symbol as the
         * disambiguator
         */
        return algebraic(from).charAt(1)
      } else {
        /* else use the file symbol */
        return algebraic(from).charAt(0)
      }
    }

    return ''
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
  protected moveToSan(move: Move, sloppy = false): string {
    let output = ''

    if (move.flags & BITS.KSIDE_CASTLE) {
      output = 'O-O'
    } else if (move.flags & BITS.QSIDE_CASTLE) {
      output = 'O-O-O'
    } else {
      var disambiguator = this.getDisambiguator(move, sloppy)

      if (move.piece !== PAWN) {
        output += move.piece.toUpperCase() + disambiguator
      }

      if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
        if (move.piece === PAWN) {
          output += algebraic(move.from)[0]
        }
        output += 'x'
      }

      output += algebraic(move.to)

      if (move.flags & BITS.PROMOTION) {
        output += '=' + move.promotion?.toUpperCase()
      }
    }

    this.makeMove(move)
    if (this.inCheck()) {
      if (this.inCheckmate()) {
        output += '#'
      } else {
        output += '+'
      }
    }
    this.undoMove()

    return output
  }

  protected pruneComments(): void {
    const reversed_history: Move[] = [];
    const current_comments: Comments = {};
    const copy_comment = (fen: string) => {
      if (fen in this._comments) {
        current_comments[fen] = this._comments[fen];
      }
    };
    while (this._history.length > 0) {
      reversed_history.push(this.undoMove() as Move);
    }
    copy_comment(this.fen());
    while (reversed_history.length > 0) {
      this.makeMove(reversed_history.pop() as Move);
      copy_comment(this.fen());
    }
    this._comments = current_comments;
  }

  protected buildMove(board: Board, from: number, to: number, flags: any, promotion?: string): Move {
    const move: Move = {
      color: this._state.turn,
      from: from,
      to: to,
      flags: flags,
      piece: (board[from] as Piece).type
    }

    if (promotion && isPieceSymbol(promotion)) {
      move.flags |= BITS.PROMOTION
      move.promotion = promotion
    }

    if (board[to]) {
      move.captured = board[to]?.type
    } else if (flags & BITS.EP_CAPTURE) {
      move.captured = PAWN
    }
    return move
  }

  // parses all of the decorators out of a SAN string
  protected strippedSan(move: string): string {
    return move.replace(/=/, '').replace(/[+#]?[?!]*$/, '')
  }

  protected attacked(color: string, square: number): boolean {
    for (let i = SQUARES.a8; i <= SQUARES.h1; i++) {
      /* did we run off the end of the board */
      if (i & 0x88) {
        i += 7
        continue
      }

      /* if empty square or wrong color */
      if (this._state.board[i] == null || this._state.board[i]?.color !== color) continue

      const piece = this._state.board[i]
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

        var offset = RAYS[index]
        var j = i + offset

        var blocked = false
        while (j !== square) {
          if (this._state.board[j]) {
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

  protected kingAttacked(color: Color) {
    return this.attacked(swapColor(color), this._state.kings[color])
  }

  protected push(move: Move): void {
    this._history.push({
      move: move,
      kings: { b: this._state.kings.b, w: this._state.kings.w },
      turn: this._state.turn,
      castling: { b: this._state.castling.b, w: this._state.castling.w },
      ep_square: this._state.ep_square,
      half_moves: this._state.half_moves,
      move_number: this._state.move_number
    })
  }

  protected makeMove(move: Move) {
    var us = this._state.turn
    var them = swapColor(us)
    this.push(move)

    this._state.board[move.to] = this._state.board[move.from]
    delete this._state.board[move.from]

    /* if ep capture, remove the captured pawn */
    if (move.flags & BITS.EP_CAPTURE) {
      if (this._state.turn === BLACK) {
        delete this._state.board[move.to - 16]
      } else {
        delete this._state.board[move.to + 16]
      }
    }

    /* if pawn promotion, replace with new piece */
    if (move.flags & BITS.PROMOTION && move.promotion && isPieceSymbol(move.promotion)) {
      this._state.board[move.to] = { type: move.promotion, color: us }
    }

    /* if we moved the king */
    const piece = this._state.board[move.to]
    if (piece && piece.type === KING) {
      this._state.kings[piece.color] = move.to

      /* if we castled, move the rook next to the king */
      if (move.flags & BITS.KSIDE_CASTLE) {
        var castling_to = move.to - 1
        var castling_from = move.to + 1
        this._state.board[castling_to] = this._state.board[castling_from]
        delete this._state.board[castling_from]
      } else if (move.flags & BITS.QSIDE_CASTLE) {
        var castling_to = move.to + 1
        var castling_from = move.to - 2
        this._state.board[castling_to] = this._state.board[castling_from]
        delete this._state.board[castling_from]
      }

      /* turn off castling */
      this._state.castling[us] = 0
    }

    /* turn off castling if we move a rook */
    if (this._state.castling[us]) {
      for (var i = 0, len = ROOKS[us].length; i < len; i++) {
        if (
          move.from === ROOKS[us][i].square &&
          this._state.castling[us] & ROOKS[us][i].flag
        ) {
          this._state.castling[us] ^= ROOKS[us][i].flag
          break
        }
      }
    }

    /* turn off castling if we capture a rook */
    if (this._state.castling[them]) {
      for (var i = 0, len = ROOKS[them].length; i < len; i++) {
        if (
          move.to === ROOKS[them][i].square &&
          this._state.castling[them] & ROOKS[them][i].flag
        ) {
          this._state.castling[them] ^= ROOKS[them][i].flag
          break
        }
      }
    }

    /* if big pawn move, update the en passant square */
    if (move.flags & BITS.BIG_PAWN) {
      if (this._state.turn === 'b') {
        this._state.ep_square = move.to - 16
      } else {
        this._state.ep_square = move.to + 16
      }
    } else {
      this._state.ep_square = EMPTY
    }

    /* reset the 50 move counter if a pawn is moved or a piece is captured */
    if (move.piece === PAWN) {
      this._state.half_moves = 0
    } else if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
      this._state.half_moves = 0
    } else {
      this._state.half_moves++
    }

    if (this._state.turn === BLACK) {
      this._state.move_number++
    }
    this._state.turn = swapColor(this._state.turn)
  }


  protected undoMove() {
    const old = this._history.pop()
    if (old == null) {
      return null
    }

    const move = old.move
    this._state.kings = old.kings
    this._state.turn = old.turn
    this._state.castling = old.castling
    this._state.ep_square = old.ep_square
    this._state.half_moves = old.half_moves
    this._state.move_number = old.move_number

    const us = this._state.turn
    const them = swapColor(this._state.turn)

    const board = this._state.board
    board[move.from] = board[move.to]
    const fromPiece = board[move.from]
    if (fromPiece !== undefined && isPieceSymbol(move.piece)) {
      fromPiece.type = move.piece // to undo any promotions
    }
    delete board[move.to]

    if (move.flags & BITS.CAPTURE && move.captured && isPieceSymbol(move.captured)) {
      board[move.to] = { type: move.captured, color: them }
    } else if (move.flags & BITS.EP_CAPTURE) {
      var index
      if (us === BLACK) {
        index = move.to - 16
      } else {
        index = move.to + 16
      }
      board[index] = { type: PAWN, color: them }
    }

    if (move.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
      let castling_to = null
      let castling_from = null
      if (move.flags & BITS.KSIDE_CASTLE) {
        castling_to = move.to + 1
        castling_from = move.to - 1
      } else if (move.flags & BITS.QSIDE_CASTLE) {
        castling_to = move.to - 2
        castling_from = move.to + 1
      }

      if (castling_to !== null && castling_from !== null) {
        board[castling_to] = board[castling_from]
        delete board[castling_from]
      }
    }

    return move
  }

  // convert a move from Standard Algebraic Notation (SAN) to 0x88 coordinates
  protected sanToMove(move: string, sloppy: boolean): Move | null {
    // strip off any move decorations: e.g Nf3+?!
    let clean_move = this.strippedSan(move)

    let matches, piece, from, to, promotion;

    // if we're using the sloppy parser run a regex to grab piece, to, and from
    // this should parse invalid SAN like: Pe2-e4, Rc1c4, Qf3xf7
    if (sloppy) {
      matches = clean_move.match(
        /([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/
      )
      if (matches) {
        piece = matches[1]
        from = matches[2]
        to = matches[3]
        promotion = matches[4]
      }
    }

    const moves = this.generateMoves()
    for (let i = 0, len = moves.length; i < len; i++) {
      // try the strict parser first, then the sloppy parser if requested
      // by the user
      if (
        clean_move === this.strippedSan(this.moveToSan(moves[i])) ||
        (sloppy && clean_move === this.strippedSan(this.moveToSan(moves[i], true)))
      ) {
        return moves[i]
      }
      if (
        from &&
          to &&
          isSquare(from) &&
          isSquare(to) &&
          matches &&
          (!piece || piece.toLowerCase() == moves[i].piece) &&
          SQUARES[from] == moves[i].from &&
          SQUARES[to] == moves[i].to &&
          (!promotion || promotion.toLowerCase() == moves[i].promotion)
      ) {
        return moves[i]
      }
    }

    return null
  }
}
