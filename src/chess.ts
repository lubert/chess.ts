import { TreeNode } from 'treenode.ts'
import {
  isAttacked,
  makeMove,
  moveToSan,
  putPiece,
  loadFen,
  hexToMove,
  getPiece,
  generateMoves,
  removePiece,
  inCheck,
  inCheckmate,
  inStalemate,
  insufficientMaterial,
  ascii,
  getBoard,
  validateMove,
  getFen,
  nodeMove,
  hexToGameState,
} from './move'
import { Nag } from './interfaces/nag'
import { loadPgn, getPgn } from './pgn'
import {
  Color,
  HexState,
  HexMove,
  Move,
  Piece,
  Validation,
  PartialMove,
  HeaderMap,
  CommentMap,
  Square,
  GameState,
} from './interfaces/types'
import { file, isSquare, isDefined, rank, swapColor } from './utils'
import { DEFAULT_POSITION, SQUARES, BITS } from './constants'
import { BoardState } from './models/BoardState'
import { validateFen } from './fen'

/** @public */
export class Chess {
  /** @internal */
  protected _tree!: TreeNode<HexState>

  /** @internal */
  protected _currentNode!: TreeNode<HexState>

  /** @public */
  public header: HeaderMap = {}

  /**
   * The Chess() constructor takes an optional parameter which specifies the board configuration
   * in [Forsyth-Edwards Notation](http://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation).
   *
   * @example
   * ```js
   * // board defaults to the starting position when called with no parameters
   * const chess = new Chess()
   *
   * // pass in a FEN string to load a particular position
   * const chess = new Chess(
   *     'r1k4r/p2nb1p1/2b4p/1p1n1p2/2PP4/3Q1NB1/1P3PPP/R5K1 b - c3 0 19'
   * )
   * ```
   */
  constructor(fen: string = DEFAULT_POSITION) {
    if (!this.load(fen)) {
      throw new Error('Error loading fen')
    }
  }

  /** @public */
  public get state(): Readonly<BoardState> {
    return this.boardState
  }

  /** @public */
  public get tree(): Readonly<TreeNode<GameState>> {
    return this._tree.map((node) => hexToGameState(node))
  }

  /** @public */
  public get currentNode(): Readonly<TreeNode<GameState>> {
    return this.tree.fetch(this._currentNode.indices) as TreeNode<GameState>
  }

  /** @public */
  public setCurrentNode(newNode: TreeNode<GameState>): Move | null {
    const jsonPath = JSON.stringify(newNode.path().map((n) => n.model))
    const node = this.tree.breadth(
      (treeNode) =>
        JSON.stringify(treeNode.path().map((n) => n.model)) === jsonPath,
    )
    if (node) {
      const hexNode = this._tree.fetch(node.indices)
      if (!hexNode) return null
      this._currentNode = hexNode
      return nodeMove(this._currentNode)
    }
    return null
  }

  /** @internal */
  protected get boardState(): Readonly<BoardState> {
    return this._currentNode.model.boardState
  }

  /** @internal **/
  protected set boardState(state: Readonly<BoardState>) {
    this._currentNode.model.boardState = state
  }

  /** @internal **/
  protected get boardStates(): Readonly<BoardState>[] {
    return this.path.map((node) => node.model.boardState)
  }

  /** @internal **/
  protected get path(): Readonly<TreeNode<HexState>>[] {
    return this._currentNode.path()
  }

  /**
   * Clears the board and loads the Forsyth–Edwards Notation (FEN) string.
   *
   * @param fen - FEN string
   * @returns True if the position was successfully loaded, otherwise false.
   */
  public load(fen: string): boolean {
    const boardState = loadFen(fen)
    if (!boardState) {
      return false
    }

    this._tree = new TreeNode<HexState>({ boardState, fen })
    this._currentNode = this._tree
    this.updateSetup()
    return true
  }

  /**
   * Clears the board.
   *
   * @example
   * ```js
   * chess.clear()
   * chess.fen()
   * // -> '8/8/8/8/8/8/8/8 w - - 0 1' <- empty board
   * ```
   */
  public clear(keepHeaders = false): void {
    this._tree = new TreeNode<HexState>({
      boardState: new BoardState(),
      fen: DEFAULT_POSITION,
    })
    if (!keepHeaders) this.header = {}
    this._currentNode = this._tree
    this.updateSetup()
  }

  /**
   * Reset the board to the initial starting position.
   */
  public reset(): void {
    this.load(DEFAULT_POSITION)
  }

  /**
   * Returns the piece on the square.
   *
   * @example
   * ```js
   * chess.clear()
   * chess.put({ type: chess.PAWN, color: chess.BLACK }, 'a5') // put a black pawn on a5
   *
   * chess.get('a5')
   * // -> { type: 'p', color: 'b' },
   * chess.get('a6')
   * // -> null
   * ```
   *
   * @param square - e.g. 'e4'
   * @returns Copy of the piece or null
   */
  public getPiece(square: string): Piece | null {
    return getPiece(this.boardState, square)
  }

  /**
   * Returns a map of squares to pieces.
   *
   * @example
   * ```js
   * chess.clear()
   * chess.put({ type: chess.PAWN, color: chess.BLACK }, 'a5') // put a black pawn on a5
   *
   * chess.get('a5')
   * // -> { type: 'p', color: 'b' },
   * chess.get('a6')
   * // -> null
   * ```
   *
   * @param square - e.g. 'e4'
   * @returns Copy of the piece or null
   */
  public getPieces(): Record<string, Piece> {
    const pieces: Record<string, Piece> = {}
    const squares = Object.keys(SQUARES) as Square[]
    squares.forEach((square) => {
      const piece = this.getPiece(square)
      if (piece) pieces[square] = piece
    })
    return pieces
  }

  /**
   * Place a piece on the square where piece is an object with the form
   * `{ type: ..., color: ... }`. Returns true if the piece was successfully
   * placed, otherwise, the board remains unchanged and false is returned.
   * `put()` will fail when passed an invalid piece or square, or when two or
   * more kings of the same color are placed.
   *
   * @example
   * ```js
   * chess.clear()
   *
   * chess.put({ type: chess.PAWN, color: chess.BLACK }, 'a5') // put a black pawn on a5
   * // -> true
   * chess.put({ type: 'k', color: 'w' }, 'h1') // shorthand
   * // -> true
   *
   * chess.fen()
   * // -> '8/8/8/p7/8/8/8/7K w - - 0 0'
   *
   * chess.put({ type: 'z', color: 'w' }, 'a1') // invalid piece
   * // -> false
   *
   * chess.clear()
   *
   * chess.put({ type: 'k', color: 'w' }, 'a1')
   * // -> true
   *
   * chess.put({ type: 'k', color: 'w' }, 'h1') // fail - two kings
   * // -> false
   * ```
   *
   * @param piece - Object of the form `{ type: 'p', color: 'w' }`
   * @param square - e.g. `'e4'`
   * @returns True if placed successfully, otherwise false
   */
  public putPiece(
    piece: { type: string; color: string },
    square: string,
  ): boolean {
    const newState = putPiece(this.boardState, piece, square)
    if (newState) {
      this.boardState = newState
      this.updateSetup()
      return true
    }
    return false
  }

  /**
   * Remove and return the piece on `square`.
   *
   * @example
   * ```js
   * chess.clear()
   * chess.put({ type: chess.PAWN, color: chess.BLACK }, 'a5') // put a black pawn on a5
   * chess.put({ type: chess.KING, color: chess.WHITE }, 'h1') // put a white king on h1
   *
   * chess.remove('a5')
   * // -> { type: 'p', color: 'b' },
   * chess.remove('h1')
   * // -> { type: 'k', color: 'w' },
   * chess.remove('e1')
   * // -> null
   * ```
   *
   * @param square - e.g. 'e4'
   * @returns Piece or null
   */
  public removePiece(square: string): Piece | null {
    const piece = getPiece(this.boardState, square)
    if (!piece) {
      return null
    }

    const newState = removePiece(this.boardState, square)
    if (!newState) {
      return null
    }
    this.boardState = newState
    return piece
  }

  /**
   * Returns a list of legal moves from the current position. The function
   * takes an optional parameter which controls the single-square move
   * generation and verbosity.
   *
   * @example
   * ```js
   * const chess = new Chess()
   * chess.moves()
   * // -> ['a3', 'a4', 'b3', 'b4', 'c3', 'c4', 'd3', 'd4', 'e3', 'e4',
   * //     'f3', 'f4', 'g3', 'g4', 'h3', 'h4', 'Na3', 'Nc3', 'Nf3', 'Nh3']
   *
   * chess.moves({ square: 'e2' })
   * // -> ['e3', 'e4']
   *
   * chess.moves({ square: 'e9' }) // invalid square
   * // -> []
   * ```
   */
  public moves(options?: { square?: Square; verbose?: false }): string[]

  /**
   * Returns a list of legal moves from the current position. The function
   * takes an optional parameter which controls the single-square move
   * generation and verbosity.
   *
   * @example
   * ```js
   * const chess = new Chess()
   * chess.moves({ verbose: true })
   * // -> [{ color: 'w', from: 'a2', to: 'a3',
   * //       flags: 'n', piece: 'p', san 'a3'
   * //       # a captured: key is included when the move is a capture
   * //       # a promotion: key is included when the move is a promotion
   * //     },
   * //     ...
   * //     ]
   * ```
   * {@link Move}
   */
  public moves(options: { square?: Square; verbose: true }): Move[]

  public moves(
    options: { square?: Square; verbose?: boolean } = {},
  ): string[] | Move[] {
    // The internal representation of a chess move is in 0x88 format, and
    // not meant to be human-readable.  The code below converts the 0x88
    // square coordinates to algebraic coordinates.  It also prunes an
    // unnecessary move keys resulting from a verbose call.
    const { square, verbose = false } = options
    const uglyMoves = generateMoves(this.boardState, { square })

    if (verbose) {
      return uglyMoves.map((uglyMove) => hexToMove(this.boardState, uglyMove))
    }
    return uglyMoves.map((uglyMove) => moveToSan(this.boardState, uglyMove))
  }

  /**
   * Returns the FEN string for the current position.
   *
   * @example
   * ```js
   * const chess = new Chess()
   *
   * // make some moves
   * chess.move('e4')
   * chess.move('e5')
   * chess.move('f4')
   *
   * chess.fen()
   * // -> 'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq f3 0 2'
   * ```
   */
  public fen(): string {
    return this.boardState.fen
  }

  /**
   * Returns true or false if the side to move is in check.
   *
   * @example
   * ```js
   * const chess = new Chess(
   *     'rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3'
   * )
   * chess.inCheck()
   * // -> true
   * ```
   */
  public inCheck(): boolean {
    return inCheck(this.boardState)
  }

  /**
   * Returns true or false if the side to move has been checkmated.
   *
   * @example
   * ```js
   * const chess = new Chess(
   *     'rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3'
   * )
   * chess.inCheckmate()
   * // -> true
   * ```
   */
  public inCheckmate(): boolean {
    return inCheckmate(this.boardState)
  }

  /**
   * Returns true or false if the side to move has been stalemated.
   *
   * @example
   * ```js
   * const chess = new Chess('4k3/4P3/4K3/8/8/8/8/8 b - - 0 78')
   * chess.inStalemate()
   * // -> true
   * ```
   */
  public inStalemate(): boolean {
    return inStalemate(this.boardState)
  }

  /**
   * Returns true if the game is drawn due to insufficient material (K vs. K,
   * K vs. KB, or K vs. KN) otherwise false.
   *
   * @example
   * ```js
   * const chess = new Chess('k7/8/n7/8/8/8/8/7K b - - 0 1')
   * chess.insufficientMaterial()
   * // -> true
   * ```
   */
  public insufficientMaterial(): boolean {
    return insufficientMaterial(this.boardState)
  }

  /**
   * Returns true or false if the current board position has occurred three or more
   * times.
   *
   * @example
   * ```js
   * const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
   * // -> true
   * // rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq occurs 1st time
   * chess.inThreefoldRepetition()
   * // -> false
   *
   * chess.move('Nf3') chess.move('Nf6') chess.move('Ng1') chess.move('Ng8')
   * // rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq occurs 2nd time
   * chess.inThreefoldRepetition()
   * // -> false
   *
   * chess.move('Nf3') chess.move('Nf6') chess.move('Ng1') chess.move('Ng8')
   * // rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq occurs 3rd time
   * chess.inThreefoldRepetition()
   * // -> true
   * ```
   */
  public inThreefoldRepetition(): boolean {
    const positions: Record<string, number> = {}

    const checkState = (state: Readonly<BoardState>): boolean => {
      const key = state.fen.split(' ').slice(0, 4).join(' ')

      // Has the position occurred three or move times?
      positions[key] = key in positions ? positions[key] + 1 : 1
      if (positions[key] >= 3) {
        return true
      }
      return false
    }

    const { boardStates } = this
    for (let i = 0; i < boardStates.length; i++) {
      if (checkState(boardStates[i])) {
        return true
      }
    }
    return false
  }

  /**
   * Returns true or false if the game is drawn (50-move rule or insufficient material).
   * @example
   * ```js
   * const chess = new Chess('4k3/4P3/4K3/8/8/8/8/8 b - - 0 78')
   * chess.inDraw()
   * // -> true
   * ```
   */
  public inDraw(): boolean {
    return (
      this.boardState.half_moves >= 100 ||
      this.inStalemate() ||
      this.insufficientMaterial() ||
      this.inThreefoldRepetition()
    )
  }

  /**
   * Returns true if the game has ended via checkmate, stalemate, draw,
   * threefold repetition, or insufficient material. Otherwise, returns false.
   * @example
   * ```js
   * const chess = new Chess()
   * chess.gameOver()
   * // -> false
   *
   * // stalemate
   * chess.load('4k3/4P3/4K3/8/8/8/8/8 b - - 0 78')
   * chess.gameOver()
   * // -> true
   *
   * // checkmate
   * chess.load('rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3')
   * chess.gameOver()
   * // -> true
   * ```
   */
  public gameOver(): boolean {
    return this.inCheckmate() || this.inDraw()
  }

  /**
   * Returns an 2D array representation of the current position. Empty squares
   * are represented by `null`.
   * @example
   * ```js
   * const chess = new Chess()
   *
   * chess.board()
   * // -> [[{type: 'r', color: 'b'},
   *         {type: 'n', color: 'b'},
   *         {type: 'b', color: 'b'},
   *         {type: 'q', color: 'b'},
   *         {type: 'k', color: 'b'},
   *         {type: 'b', color: 'b'},
   *         {type: 'n', color: 'b'},
   *         {type: 'r', color: 'b'}],
   *         [...],
   *         [...],
   *         [...],
   *         [...],
   *         [...],
   *         [{type: 'r', color: 'w'},
   *          {type: 'n', color: 'w'},
   *          {type: 'b', color: 'w'},
   *          {type: 'q', color: 'w'},
   *          {type: 'k', color: 'w'},
   *          {type: 'b', color: 'w'},
   *          {type: 'n', color: 'w'},
   *          {type: 'r', color: 'w'}]]
   * ```
   */
  public board(): (Piece | null)[][] {
    return getBoard(this.boardState.board)
  }

  /**
   * Returns the game in PGN format. Options is an optional parameter which may include
   * max width and/or a newline character settings.
   *
   * @example
   * ```js
   * const chess = new Chess()
   * chess.header('White', 'Plunky', 'Black', 'Plinkie')
   * chess.move('e4')
   * chess.move('e5')
   * chess.move('Nc3')
   * chess.move('Nc6')
   *
   * chess.pgn({ width: 5, newline: '<br />' })
   * // -> '[White "Plunky"]<br />[Black "Plinkie"]<br /><br />1. e4 e5<br />2. Nc3 Nc6'
   * ```
   */
  public pgn(options: { newline?: string; width?: number } = {}): string {
    return getPgn(this._tree, this.header, options)
  }

  /**
   * Load the moves of a game stored in
   * [Portable Game Notation](http://en.wikipedia.org/wiki/Portable_Game_Notation).
   * `pgn` should be a string. Options is an optional `object` which may
   * contain a string `newline`.
   *
   * The `newline` is a string representation of a valid RegExp fragment and is
   * used to process the PGN. It defaults to `\r?\n`. Special characters should
   * not be pre-escaped, but any literal special characters should be escaped
   * as is normal for a RegExp. Keep in mind that backslashes in JavaScript
   * strings must themselves be escaped. Avoid using a `newline` that may occur
   * elsewhere in a PGN, such as `.` or `x`, as this will result in
   * behavior.
   *
   * The method will throw an error if the PGN was not parsed successfully.
   *
   * @example
   * ```js
   * const chess = new Chess()
   * const pgn = [
   *     '[Event "Casual Game"]',
   *     '[Site "Berlin GER"]',
   *     '[Date "1852.??.??"]',
   *     '[EventDate "?"]',
   *     '[Round "?"]',
   *     '[Result "1-0"]',
   *     '[White "Adolf Anderssen"]',
   *     '[Black "Jean Dufresne"]',
   *     '[ECO "C52"]',
   *     '[WhiteElo "?"]',
   *     '[BlackElo "?"]',
   *     '[PlyCount "47"]',
   *     '',
   *     '1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O',
   *     'd3 8.Qb3 Qf6 9.e5 Qg6 10.Re1 Nge7 11.Ba3 b5 12.Qxb5 Rb8 13.Qa4',
   *     'Bb6 14.Nbd2 Bb7 15.Ne4 Qf5 16.Bxd3 Qh5 17.Nf6+ gxf6 18.exf6',
   *     'Rg8 19.Rad1 Qxf3 20.Rxe7+ Nxe7 21.Qxd7+ Kxd7 22.Bf5+ Ke8',
   *     '23.Bd7+ Kf8 24.Bxe7# 1-0'
   * ]
   *
   * chess.loadPgn(pgn.join('\n'))
   * // -> true
   *
   * chess.fen()
   * // -> 1r3kr1/pbpBBp1p/1b3P2/8/8/2P2q2/P4PPP/3R2K1 b - - 0 24
   *
   * chess.ascii()
   * // -> '  +------------------------+
   * //     8 | .  r  .  .  .  k  r  . |
   * //     7 | p  b  p  B  B  p  .  p |
   * //     6 | .  b  .  .  .  P  .  . |
   * //     5 | .  .  .  .  .  .  .  . |
   * //     4 | .  .  .  .  .  .  .  . |
   * //     3 | .  .  P  .  .  q  .  . |
   * //     2 | P  .  .  .  .  P  P  P |
   * //     1 | .  .  .  R  .  .  K  . |
   * //       +------------------------+
   * //         a  b  c  d  e  f  g  h'
   *
   * // Parse non-standard move formats and unusual line separators
   * const sloppyPgn = [
   *     '[Event "Wijk aan Zee (Netherlands)"]',
   *     '[Date "1971.01.26"]',
   *     '[Result "1-0"]',
   *     '[White "Tigran Vartanovich Petrosian"]',
   *     '[Black "Hans Ree"]',
   *     '[ECO "A29"]',
   *     '',
   *     '1. Pc2c4 Pe7e5', // non-standard
   *     '2. Nc3 Nf6',
   *     '3. Nf3 Nc6',
   *     '4. g2g3 Bb4', // non-standard
   *     '5. Nd5 Nxd5',
   *     '6. c4xd5 e5-e4', // non-standard
   *     '7. dxc6 exf3',
   *     '8. Qb3 1-0'
   * ].join('|')
   *
   * const options = {
   *     newline: '\\|', // Literal '|' character escaped
   * }
   *
   * chess.loadPgn(sloppyPgn)
   * // -> false
   *
   * chess.loadPgn(sloppyPgn, options)
   * // -> true
   *
   * chess.fen()
   * // -> 'r1bqk2r/pppp1ppp/2P5/8/1b6/1Q3pP1/PP1PPP1P/R1B1KB1R b KQkq - 1 8'
   * ```
   */
  public loadPgn(pgn: string, options: { newline?: string } = {}): void {
    const { tree, currentNode, header } = loadPgn(pgn, options)
    this._tree = tree
    this._currentNode = currentNode
    this.header = header
  }

  /**
   * Returns a string containing an ASCII diagram of the current position.
   * @example
   * ```js
   * const chess = new Chess()
   *
   * // Make some moves
   * chess.move('e4')
   * chess.move('e5')
   * chess.move('f4')
   *
   * chess.ascii()
   * // -> '   +------------------------+
   * //      8 | r  n  b  q  k  b  n  r |
   * //      7 | p  p  p  p  .  p  p  p |
   * //      6 | .  .  .  .  .  .  .  . |
   * //      5 | .  .  .  .  p  .  .  . |
   * //      4 | .  .  .  .  P  P  .  . |
   * //      3 | .  .  .  .  .  .  .  . |
   * //      2 | P  P  P  P  .  .  P  P |
   * //      1 | R  N  B  Q  K  B  N  R |
   * //        +------------------------+
   * //          a  b  c  d  e  f  g  h'
   * ```
   */
  public ascii(newline_char = '\n'): string {
    return ascii(this.boardState.board, newline_char)
  }

  /**
   * Returns the current side to move.
   *
   * @example
   * ```js
   * chess.load('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')
   * chess.turn()
   * // -> 'b'
   * ```
   */
  public turn(): Color {
    return this.boardState.turn
  }

  /**
   * Attempts to make a move on the board, returning a move object if the move was
   * legal, otherwise null. The .move function can be called two ways, by passing
   * a string in Standard Algebraic Notation (SAN):
   *
   * @example
   * ```js
   * const chess = new Chess()
   *
   * chess.move('e4')
   * // -> { color: 'w', from: 'e2', to: 'e4', flags: 'b', piece: 'p', san: 'e4' }
   *
   * chess.move('nf6') // SAN is case sensitive!!
   * // -> null
   *
   * chess.move('Nf6')
   * // -> { color: 'b', from: 'g8', to: 'f6', flags: 'n', piece: 'n', san: 'Nf6' }
   * ```
   *
   *
   * Or by passing .move() a move object (only the 'to', 'from', and when necessary
   * 'promotion', fields are needed):
   *
   * @example
   * ```js
   * const chess = new Chess()
   *
   * chess.move({ from: 'g2', to: 'g3' })
   * // -> { color: 'w', from: 'g2', to: 'g3', flags: 'n', piece: 'p', san: 'g3' }
   * ```
   *
   * An optional sloppy flag can be used to parse a variety of non-standard move
   * notations:
   *
   * @example
   * ```js
   * const chess = new Chess()
   *
   * // various forms of Long Algebraic Notation
   * chess.move('e2e4', { sloppy: true })
   * // -> { color: 'w', from: 'e2', to: 'e4', flags: 'b', piece: 'p', san: 'e4' }
   * chess.move('e7-e5', { sloppy: true })
   * // -> { color: 'b', from: 'e7', to: 'e5', flags: 'b', piece: 'p', san: 'e5' }
   * chess.move('Pf2f4', { sloppy: true })
   * // -> { color: 'w', from: 'f2', to: 'f4', flags: 'b', piece: 'p', san: 'f4' }
   * chess.move('Pe5xf4', { sloppy: true })
   * // -> { color: 'b', from: 'e5', to: 'f4', flags: 'c', piece: 'p', captured: 'p', san: 'exf4' }
   *
   * // correctly parses incorrectly disambiguated moves
   * chess = new Chess(
   *     'r2qkbnr/ppp2ppp/2n5/1B2pQ2/4P3/8/PPP2PPP/RNB1K2R b KQkq - 3 7'
   * )
   *
   * chess.move('Nge7') // Ne7 is unambiguous because the knight on c6 is pinned
   * // -> null
   *
   * chess.move('Nge7', { sloppy: true })
   * // -> { color: 'b', from: 'g8', to: 'e7', flags: 'n', piece: 'n', san: 'Ne7' }
   * ```
   *
   * @param move - Case-sensitive SAN string or object, e.g. `'Nxb7'` or
   * `{ from: 'h7', to: 'h8', promotion: 'q' }`
   * @param options - Options to enable parsing of a variety of non-standard
   * move notations
   */
  public move(
    move: string | PartialMove,
    options: { dry_run?: boolean; strict?: boolean } = {},
  ): Move | null {
    const validMove = validateMove(this.boardState, move, options)
    if (!validMove) {
      return null
    }

    // Create pretty move before updating the state
    const prettyMove = hexToMove(this.boardState, validMove)
    if (!options.dry_run) {
      this.makeMove(validMove)
    }
    return prettyMove
  }

  /**
   * Validates a sequence of moves, returning an array of move objects if the
   * moves are all legal, otherwise null.
   *
   * @example
   * ```js
   * const chess = new Chess()
   *
   * chess.validateMoves(['e4', 'Nf6'])
   * // -> [{ color: 'w', from: 'e2', to: 'e4', flags: 'b', piece: 'p', san: 'e4' },
   *        { color: 'b', from: 'g8', to: 'f6', flags: 'n', piece: 'n', san: 'Nf6' }]
   *
   * chess.validateMoves(['e4, 'nf6']) // SAN is case sensitive!!
   * // -> null
   * ```
   *
   * @param moves - Array of case-sensitive SAN strings or objects, e.g. `'Nxb7'` or
   * `{ from: 'h7', to: 'h8', promotion: 'q' }`
   */
  public validateMoves(moves: string[] | PartialMove[]): Move[] | null {
    const validMoves: Move[] = []
    let { boardState } = this
    for (const move of moves) {
      const validMove = validateMove(boardState, move)
      if (!validMove) {
        return null
      }
      validMoves.push(hexToMove(boardState, validMove))
      boardState = makeMove(boardState, validMove)
    }
    return validMoves
  }

  /**
   * Checks if a move results in a promotion.
   *
   * @example
   * ```js
   * const chess = new Chess()
   *
   * chess.isPromotion('e4')
   * // -> false
   *
   * chess.load('8/2P2k2/8/8/8/5K2/8/8 w - - 0 1')
   * chess.isPromotion('c8')
   * // -> true
   * ```
   *
   * @param move - Case-sensitive SAN string or object, e.g. `'Nxb7'` or
   * `{ from: 'h7', to: 'h8' }`
   */
  public isPromotion(move: string | PartialMove): boolean {
    const validMove = validateMove(this.boardState, move, {
      matchPromotion: false,
    })
    if (!validMove) {
      return false
    }

    return !!(validMove.flags & BITS.PROMOTION)
  }

  /**
   * Takeback the last half-move, returning a move object if successful, otherwise null.
   *
   * @example
   * ```js
   * const chess = new Chess()
   *
   * chess.fen()
   * // -> 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
   * chess.move('e4')
   * chess.fen()
   * // -> 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
   *
   * chess.undo()
   * // -> { color: 'w', from: 'e2', to: 'e4', flags: 'b', piece: 'p', san: 'e4' }
   * chess.fen()
   * // -> 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
   * chess.undo()
   * // -> null
   * ```
   */
  public undo(): Move | null {
    const move = this.undoMove()
    return move ? hexToMove(this.boardState, move) : null
  }

  /**
   * Undo all moves.
   */
  public undoAll(): Move[] {
    this._currentNode = this._tree
    return this.path.map(nodeMove).filter(isDefined)
  }

  /**
   * Redo mainline move.
   */
  public redo(): Move | null {
    if (this._currentNode.children.length) {
      this._currentNode = this._currentNode.children[0]
    }
    return nodeMove(this._currentNode)
  }

  /**
   * Redo all mainline moves.
   */
  public redoAll(): Move[] {
    while (this._currentNode.children.length) {
      this._currentNode = this._currentNode.children[0]
    }
    return this.path.map(nodeMove).filter(isDefined)
  }

  /**
   * Returns the color of the square ('light' or 'dark').
   *
   * @example
   * ```js
   * const chess = Chess()
   * chess.squareColor('h1')
   * // -> 'light'
   * chess.squareColor('a7')
   * // -> 'dark'
   * chess.squareColor('bogus square')
   * // -> null
   * ```
   */
  public squareColor(square: string): 'light' | 'dark' | null {
    if (isSquare(square)) {
      const sq_0x88 = SQUARES[square]
      return (rank(sq_0x88) + file(sq_0x88)) % 2 === 0 ? 'light' : 'dark'
    }

    return null
  }

  /**
   * Returns a list containing the moves of the current game.
   *
   * @example
   * ```js
   * const chess = new Chess()
   * chess.move('e4')
   * chess.move('e5')
   * chess.move('f4')
   * chess.move('exf4')
   *
   * chess.history()
   * // -> ['e4', 'e5', 'f4', 'exf4']
   * ```
   */
  public history(options?: { verbose?: false }): string[]

  /**
   * Returns a list containing the moves of the current game.
   *
   * @example
   * ```js
   * const chess = new Chess()
   * chess.move('e4')
   * chess.move('e5')
   * chess.move('f4')
   * chess.move('exf4')
   *
   * chess.history({ verbose: true })
   * // -> [{ color: 'w', from: 'e2', to: 'e4', flags: 'b', piece: 'p', san: 'e4' },
   * //     { color: 'b', from: 'e7', to: 'e5', flags: 'b', piece: 'p', san: 'e5' },
   * //     { color: 'w', from: 'f2', to: 'f4', flags: 'b', piece: 'p', san: 'f4' },
   * //     { color: 'b', from: 'e5', to: 'f4', flags: 'c', piece: 'p', captured: 'p', san: 'exf4' }]
   * ```
   */
  public history(options: { verbose: true }): Move[]

  public history(options: { verbose?: boolean } = {}): string[] | Move[] {
    const { verbose = false } = options

    const nodes = this.path
      .map((node) => {
        if (!node.parent || !node.model.move) return
        return {
          prevState: node.parent.model.boardState,
          move: node.model.move,
        }
      })
      .filter(isDefined)

    if (verbose) {
      return nodes.map(({ prevState, move }) => hexToMove(prevState, move))
    }
    return nodes.map(({ prevState, move }) => moveToSan(prevState, move))
  }

  /**
   * Retrieve the comment for a position, if it exists.
   *
   * @example
   * ```js
   * const chess = new Chess()
   *
   * chess.loadPgn("1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 {giuoco piano} *")
   *
   * chess.getComment()
   * // -> "giuoco piano"
   * ```
   *
   * @param fen - Defaults to the current position
   */
  public getComment(fen?: string): string | undefined {
    if (fen) {
      const node = this._tree.breadth(({ model }) => model.fen === fen)
      return node?.model.comment
    }
    return this._currentNode.model.comment
  }

  /**
   * Retrieve comments for all positions.
   *
   * @example
   * ```js
   * const chess = new Chess()
   *
   * chess.loadPgn("1. e4 e5 {king's pawn opening} 2. Nf3 Nc6 3. Bc4 Bc5 {giuoco piano} *")
   *
   * chess.getComments()
   * // -> {
   * //      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2": "king's pawn opening",
   * //      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3": "giuoco piano"
   * //    }
   * ```
   */
  public getComments(): CommentMap {
    const comments: CommentMap = {}
    this._currentNode.path().forEach(({ model }) => {
      if (model.comment) {
        comments[model.fen] = model.comment
      }
    })
    return comments
  }

  /**
   * Comment on a position.
   *
   * @example
   * ```js
   * const chess = new Chess()
   *
   * chess.move("e4")
   * chess.setComment("king's pawn opening")
   *
   * chess.pgn()
   * // -> "1. e4 {king's pawn opening}"
   * ```
   *
   * @param comment
   * @param fen - Defaults to the current position
   */
  public setComment(comment: string, fen?: string): void {
    const cleaned = comment.replace('{', '[').replace('}', ']')
    if (fen) {
      const node = this._tree.breadth(({ model }) => model.fen === fen)
      if (node) {
        node.model.comment = cleaned
      }
      return
    }

    this._currentNode.model.comment = cleaned
  }

  /**
   * Delete and return the comment for a position in the current branch,
   * it exists.
   *
   * @example
   * ```js
   * const chess = new Chess()
   *
   * chess.loadPgn("1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 {giuoco piano} *")
   *
   * chess.getComment()
   * // -> "giuoco piano"
   *
   * chess.deleteComments()
   * // -> "giuoco piano"
   *
   * chess.getComment()
   * // -> undefined
   * ```
   *
   * @param fen - Defaults to the current position
   */
  public deleteComment(fen?: string): string | undefined {
    let node: TreeNode<HexState> | undefined = this._currentNode
    if (fen) {
      node = this._currentNode.path().find((n) => n.model.fen === fen)
      if (!node) return
    }
    const comment = node.model.comment
    delete node.model.comment
    return comment
  }

  /**
   * Delete and return comments for all positions in the current branch.
   *
   * @example
   * ```js
   * const chess = new Chess()
   *
   * chess.loadPgn("1. e4 e5 {king's pawn opening} 2. Nf3 Nc6 3. Bc4 Bc5 {giuoco piano} *")
   *
   * chess.deleteComments()
   * // -> [
   * //     {
   * //       fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
   * //       comment: "king's pawn opening"
   * //     },
   * //     {
   * //       fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
   * //       comment: "giuoco piano"
   * //     }
   * //    ]
   *
   * chess.getComments()
   * // -> []
   * ```
   */
  public deleteComments(): CommentMap {
    const comments: CommentMap = {}
    this._currentNode.path().forEach(({ model }) => {
      if (model.comment) {
        comments[model.fen] = model.comment
        delete model.comment
      }
    })
    return comments
  }

  public addNag(nag: Nag, fen?: string): void {
    let node: TreeNode<HexState> | undefined = this._currentNode
    if (fen) {
      node = this._currentNode.path().find((n) => n.model.fen === fen)
      if (!node) return
    }
    node.model.nags = node.model.nags || []
    if (!node.model.nags.includes(nag)) {
      node.model.nags.push(nag)
    }
  }

  public getNags(fen?: string): Nag[] {
    let node: TreeNode<HexState> | undefined = this._currentNode
    if (fen) {
      node = this._currentNode.path().find((n) => n.model.fen === fen)
      if (!node) return []
    }
    return node.model.nags || []
  }

  /**
   * Returns a validation object specifying validity or the errors found
   * within the FEN string.
   *
   * @example
   * ```js
   * chess.validateFen('2n1r3/p1k2pp1/B1p3b1/P7/5bP1/2N1B3/1P2KP2/2R5 b - - 4 25')
   * // -> { valid: true, error_number: 0, error: 'No errors.' }
   *
   * chess.validateFen('4r3/8/X12XPk/1p6/pP2p1R1/P1B5/2P2K2/3r4 w - - 1 45')
   * // -> { valid: false, error_number: 9,
   * //     error: '1st field (piece positions) is invalid [invalid piece].' }
   * ```
   */
  public validateFen(fen: string): Validation {
    return validateFen(fen)
  }

  /** @internal */
  public clone(): Chess {
    const clone = new Chess()
    clone._tree = this._tree.clone()
    clone._currentNode =
      clone._tree.breadth(
        ({ model }) => model.fen === this._currentNode.model.fen,
      ) || clone._tree
    clone.header = { ...this.header }
    return clone
  }

  /** @internal */
  public perft(depth: number): number {
    const moves = generateMoves(this.boardState, { legal: false })
    let nodes = 0
    const color = this.boardState.turn

    for (let i = 0, len = moves.length; i < len; i++) {
      this.makeMove(moves[i])
      if (!this.kingAttacked(color)) {
        if (depth - 1 > 0) {
          const child_nodes = this.perft(depth - 1)
          nodes += child_nodes
        } else {
          nodes++
        }
      }
      this.undoMove()
    }

    return nodes
  }

  /**
   * Called when the initial board setup is changed with put() or remove().
   * modifies the SetUp and FEN properties of the header object.  if the FEN is
   * equal to the default position, the SetUp and FEN are deleted
   * the setup is only updated if moves haven't been made.
   *
   * @internal
   */
  protected updateSetup(): void {
    const fen = this.boardState.fen
    if (this._currentNode.parent) return

    if (fen !== DEFAULT_POSITION) {
      this.header['SetUp'] = '1'
      this.header['FEN'] = fen
    } else {
      delete this.header['SetUp']
      delete this.header['FEN']
    }
  }

  /** @internal */
  protected attacked(color: Color, square: number): boolean {
    return isAttacked(this.boardState, color, square)
  }

  /** @internal */
  protected kingAttacked(color: Color): boolean {
    return this.attacked(swapColor(color), this.boardState.kings[color])
  }

  /** @internal */
  protected makeMove(move: HexMove): void {
    const boardState = makeMove(this.boardState, move)
    this._currentNode = this._currentNode.addModel({
      fen: getFen(boardState),
      boardState,
      move,
    })
  }

  /** @internal */
  protected undoMove(): HexMove | null {
    if (!this._currentNode.parent) return null
    this._currentNode = this._currentNode.parent
    return this._currentNode.model.move || null
  }
}
