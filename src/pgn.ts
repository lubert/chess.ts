import { TreeNode } from 'treenode.ts'
import {
  HexMove,
  NodeModel,
  HeaderMap,
  WalkPgnOptions,
  WalkPgnContext,
} from './interfaces/types'
import { Nag, extractNags } from './interfaces/nag'
import {
  WHITE,
  DEFAULT_POSITION,
  POSSIBLE_RESULTS,
  NULL_MOVES,
  CASTLING_MOVES,
} from './constants'
import { loadFen, sanToMove, makeMove, unmakeMove, asStoredMove } from './move'
import { cloneBoardState, NodeState } from './state'
import { REGEXP_HEADER, REGEXP_MOVE_NUMBER } from './regex'

export function addNag(node: TreeNode<NodeModel>, nag: number): void {
  if (!node.model.nags) {
    node.model.nags = [nag]
    return
  }
  node.model.nags = Array.from(new Set<number>([...node.model.nags, nag]))
}

export function isMainline(node: TreeNode<NodeModel>): boolean {
  while (node.parent) {
    const parent = node.parent
    if (parent.children[0] !== node) {
      return false
    }
    node = parent
  }
  return true
}

/** A PGN string token may hold no non-printing character. Char codes, not a
 * regex, because a control range in a regex trips no-control-regex. */
function printable(v: string): string {
  let out = ''
  for (const ch of v) {
    const c = ch.charCodeAt(0)
    out += c < 0x20 || c === 0x7f ? ' ' : ch
  }
  return out
}

/** Backslash first, so the backslash an escaped quote adds is not doubled. */
function escapeTag(v: string): string {
  return printable(String(v)).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** One pass over exactly `\\` and `\"`, so `\\"` cannot be misread and a
 * lax file's bare `\g` passes through unchanged. */
function unescapeTag(v: string): string {
  return v.replace(/\\(["\\])/g, '$1')
}

export function pgnHeader(header: HeaderMap): string[] {
  return Object.entries(header)
    .filter(([, val]) => val !== undefined && val !== null)
    .map(([key, val]) => `[${key} "${escapeTag(String(val))}"]`)
}

/**
 * A `}` ends the comment for every reader and no escape helps, so a brace has
 * to become the bracket the annotator meant.
 */
function repairBraces(text: string): string {
  if (!/[{}]/.test(text)) return text
  const out = text.split('')
  const opens: number[] = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      opens.push(i)
    } else if (text[i] === '}') {
      const open = opens.pop()
      if (open === undefined) {
        out[i] = nearestBracket(text, i, -1)
      } else {
        out[open] = '('
        out[i] = ')'
      }
    }
  }
  for (const open of opens) out[open] = nearestBracket(text, open, 1)
  return out.join('')
}

/**
 * The bracket an unmatched brace stands for: the nearest one left unclosed
 * before it (dir -1), or closed but never opened after it (dir 1).
 */
function nearestBracket(text: string, i: number, dir: 1 | -1): string {
  const [paren, square] = dir < 0 ? ['(', '['] : [')', ']']
  const [nestParen, nestSquare] = dir < 0 ? [')', ']'] : ['(', '[']
  let par = 0
  let sq = 0
  for (let j = i + dir; j >= 0 && j < text.length; j += dir) {
    const ch = text[j]
    if (ch === nestParen) par++
    else if (ch === paren) {
      if (par === 0) return dir < 0 ? ')' : '('
      par--
    } else if (ch === nestSquare) sq++
    else if (ch === square) {
      if (sq === 0) return dir < 0 ? ']' : '['
      sq--
    }
  }
  return dir < 0 ? ')' : '('
}

/**
 * A comment as it is safe to write. A blank line ends a game for a
 * line-oriented reader, and a `[` in column one reads as the next game's tags.
 */
function commentBody(text: string): string {
  return repairBraces(text.replace(/^[ \t\n\f\r]+|[ \t\n\f\r]+$/g, ''))
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, i) => (i > 0 && line.startsWith('[') ? ` ${line}` : line))
    .join('\n')
}

export function pgnMoves(
  node: TreeNode<NodeModel>,
  afterAnnotation = false,
): string[] {
  const tokens: string[] = []
  const { boardState } = node.model

  const pushComment = (text: string | undefined) => {
    const body = text && commentBody(text)
    if (body) tokens.push(`{${body}}`)
  }

  // Special case for initial commented position
  if (node.isRoot) pushComment(node.model.comment)

  const formatMove = (
    state: NodeModel,
    isVariation = false,
    hasInterveningAnnotation = false,
  ) => {
    const { move, comment, nags, startingComment } = state

    // Output starting comment BEFORE the move
    pushComment(startingComment)

    if (move) {
      const isFirstMove = !node.model.move
      const { san } = move
      const nagStr =
        nags && nags.length ? ' ' + nags.map((nag) => `$${nag}`).join(' ') : ''
      // Move
      if (move.color === WHITE) {
        tokens.push(`${boardState.move_number}. ${san}${nagStr}`)
      } else if (
        isFirstMove ||
        isVariation ||
        hasInterveningAnnotation ||
        startingComment
      ) {
        // Numbered at a game or variation start, or after anything that breaks
        // the flow, its own starting comment included
        tokens.push(`${boardState.move_number}...${san}${nagStr}`)
      } else {
        tokens.push(`${san}${nagStr}`)
      }
    }
    // Comment after the move
    pushComment(comment)
  }

  const [mainline, ...variations] = node.children

  if (mainline) {
    formatMove(mainline.model, false, afterAnnotation)

    variations.forEach((variation) => {
      tokens.push('(')
      formatMove(variation.model, true)
      tokens.push(...pgnMoves(variation, variation.model.comment !== undefined))
      tokens.push(')')
    })
    // After variations or comments, the next black move needs number indication
    const hasInterveningAnnotation =
      variations.length > 0 || mainline.model.comment !== undefined
    tokens.push(...pgnMoves(mainline, hasInterveningAnnotation))
  }
  return tokens
}

// Join PGN tokens with proper spacing (no space after '(' or before ')')
function joinPgnTokens(tokens: string[]): string {
  let result = ''
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const prevToken = i > 0 ? tokens[i - 1] : ''
    // Add space unless after '(' or before ')'
    if (i > 0 && prevToken !== '(' && token !== ')') {
      result += ' '
    }
    result += token
  }
  return result
}

export function getPgn(
  tree: TreeNode<NodeModel>,
  header: HeaderMap,
  options: { newline?: string } = {},
): string {
  const { newline = '\n' } = options
  let pgn = ''

  // Omit header if "Result" is the only key
  if (!header.Result || Object.keys(header).length > 1) {
    pgn += pgnHeader(header).join(newline) + newline + newline
  }
  const moves = pgnMoves(tree)
  pgn += joinPgnTokens(moves)
  if (header.Result) pgn += ' ' + header.Result
  return pgn.trim()
}

function extractFen(pgn: string, newline = '\r\n|\n|\r'): string | undefined {
  const newlineRe = new RegExp(newline)
  const lines = pgn.split(newlineRe)
  for (const line of lines) {
    if (!line || line.startsWith('%')) continue
    if (!line.startsWith('[')) break
    const match = line.match(REGEXP_HEADER)
    if (match && match[1] === 'FEN') {
      return unescapeTag(match[2])
    }
  }
  return undefined
}

/** @public */
export function createWalkPgnContext(): WalkPgnContext {
  return {
    undoStack: [],
    variationStack: [],
  }
}

const RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*'])

/**
 * Where a game's movetext ends: at a blank line after
 * the result, or at a tag line, but never inside a comment.
 */
class MovetextBoundary {
  private inComment = false
  private awaitingResult = true

  endsBefore(line: string): boolean {
    if (this.inComment) return false
    const trimmed = line.trim()
    return trimmed ? trimmed.startsWith('[') : !this.awaitingResult
  }

  track(line: string): void {
    let last = ''
    let start = -1
    let i = 0
    for (; i < line.length; i++) {
      const code = line.charCodeAt(i)
      if (this.inComment) {
        if (code === 125) this.inComment = false // }
        continue
      }
      // { ; space tab \n \v \f \r end a token
      if (
        code === 123 ||
        code === 59 ||
        code === 32 ||
        (code >= 9 && code <= 13)
      ) {
        if (start >= 0) last = line.slice(start, i)
        start = -1
        if (code === 123) this.inComment = true
        else if (code === 59) break
      } else if (start < 0) {
        start = i
      }
    }
    if (start >= 0) last = line.slice(start, i)
    if (line.trim()) {
      this.awaitingResult = this.inComment || !RESULT_TOKENS.has(last)
    }
  }
}

type PendingMove = {
  move: HexMove
  comment?: string
  startingComment?: string
  nags?: number[]
}

/* eslint-disable @typescript-eslint/no-non-null-assertion */
/** @public */
export function walkPgn(pgn: string, options: WalkPgnOptions): HeaderMap {
  const {
    newline = '\r\n|\n|\r',
    skipSan,
    onMove,
    onStartVariation,
    onEndVariation,
    onComment,
    context,
  } = options

  // Split on newlines and read line by line
  const newlineRe = new RegExp(newline)
  const lines = pgn.split(newlineRe)

  const header: HeaderMap = {}

  // Extract headers, then concatenate movetext lines into a single string
  const movetextParts: string[] = []
  const boundary = new MovetextBoundary()
  let inHeaders = true
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    if (inHeaders) {
      /* headers may be indented, so classify the line by its trimmed form */
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('%')) continue
      if (trimmed.startsWith('[')) {
        const match = trimmed.match(REGEXP_HEADER)
        if (match) header[match[1]] = unescapeTag(match[2])
        continue
      }
      inHeaders = false
    } else if (boundary.endsBefore(line)) break
    boundary.track(line)
    movetextParts.push(line)
  }
  const movetext = movetextParts.join('\n')

  // Set up board state
  const fen = header.FEN || DEFAULT_POSITION
  const boardState = loadFen(fen)
  if (!boardState) {
    throw new Error(`Invalid FEN: ${fen}`)
  }

  // Reuse or create stacks
  const undoStack = context ? context.undoStack : []
  const variationStack = context ? context.variationStack : []
  undoStack.length = 0
  variationStack.length = 0

  // Deferred move callback — buffer the move until the next move/structure token
  // so that post-move comments and NAGs are included
  let pendingMoveInfo: PendingMove | undefined
  let pendingStartingComment: string | undefined
  let commentStartsNext = false
  let atRootNoMoves = true
  let aborted = false

  const flushPending = (): boolean => {
    if (!pendingMoveInfo) return true
    const { move, comment, startingComment, nags } = pendingMoveInfo
    pendingMoveInfo = undefined
    const result = onMove(move, boardState, comment, startingComment, nags)
    if (result === false) {
      aborted = true
      return false
    }
    return true
  }

  const addPendingNag = (nag: number) => {
    if (!pendingMoveInfo) return
    if (!pendingMoveInfo.nags) pendingMoveInfo.nags = [nag]
    else if (!pendingMoveInfo.nags.includes(nag)) pendingMoveInfo.nags.push(nag)
  }

  const join = (prev: string | undefined, next: string) =>
    prev ? `${prev} ${next}` : next

  const setComment = (raw: string) => {
    // Line breaks are the annotator's, so keep them and trim only the ends
    const commentText = raw.replace(/\r\n/g, '\n').trim()
    if (!commentText) return
    if (commentStartsNext || atRootNoMoves) {
      pendingStartingComment = join(pendingStartingComment, commentText)
    } else if (pendingMoveInfo) {
      pendingMoveInfo.comment = join(pendingMoveInfo.comment, commentText)
    }
  }

  // A starting comment that no move followed: it closes the line instead.
  const settleStartingComment = () => {
    if (!pendingStartingComment) return
    const text = pendingStartingComment
    pendingStartingComment = undefined
    if (pendingMoveInfo) {
      pendingMoveInfo.comment = join(pendingMoveInfo.comment, text)
    } else if (onComment) {
      onComment(text)
    }
  }

  // Phase 2: Position-based scanner over movetext string
  const len = movetext.length
  let pos = 0

  // Character codes that delimit tokens: { ( ) ; and whitespace
  // Note: } is not included — it only appears inside {…} comments which
  // are handled by indexOf before the token scanner runs.
  const isStructural = (code: number) =>
    code === 123 || // {
    code === 40 || // (
    code === 41 || // )
    code === 59 || // ;
    code === 32 || // space
    code === 9 || // tab
    code === 10 || // \n
    code === 13 // \r

  const skipWhitespace = () => {
    while (pos < len) {
      const ch = movetext.charCodeAt(pos)
      if (ch === 32 || ch === 9 || ch === 10 || ch === 13) pos++
      else break
    }
  }

  while (pos < len) {
    if (aborted) break
    skipWhitespace()
    if (pos >= len) break

    const ch = movetext.charCodeAt(pos)

    if (ch === 123) {
      // {
      // Block comment — scan to closing }
      const start = pos + 1
      const end = movetext.indexOf('}', start)
      if (end === -1) {
        // Unterminated comment — take rest of string
        setComment(movetext.substring(start))
        pos = len
      } else {
        setComment(movetext.substring(start, end))
        pos = end + 1
      }
    } else if (ch === 59) {
      // ;
      // Line comment — scan to end of line; setComment handles trim
      const start = pos + 1
      let end = movetext.indexOf('\n', start)
      if (end === -1) end = len
      if (start < end) {
        setComment(movetext.substring(start, end))
      }
      pos = end
    } else if (ch === 40) {
      // (
      // Start variation
      if (!flushPending()) break
      if (!undoStack.length) throw new Error('Missing parent')
      pos++

      const lastUndo = undoStack.pop()!
      unmakeMove(boardState, lastUndo)
      variationStack.push({
        restoreDepth: undoStack.length,
        replayUndo: lastUndo,
        startingComment: pendingStartingComment,
      })
      pendingStartingComment = undefined
      if (onStartVariation) onStartVariation()
      commentStartsNext = true
    } else if (ch === 41) {
      // )
      // End variation
      settleStartingComment()
      if (!flushPending()) break
      if (!variationStack.length) throw new Error('Mismatched parentheses')
      pos++

      if (onEndVariation) onEndVariation()
      const { restoreDepth, replayUndo, startingComment } =
        variationStack.pop()!
      while (undoStack.length > restoreDepth) {
        unmakeMove(boardState, undoStack.pop()!)
      }
      const redo = makeMove(boardState, replayUndo.move)
      undoStack.push(redo)
      // The move's own comment came before the `(`, so one here leads the next
      commentStartsNext = true
      pendingStartingComment = startingComment
    } else {
      // Scan a token: read until whitespace or structural char
      const start = pos
      while (pos < len && !isStructural(movetext.charCodeAt(pos))) pos++
      let token = movetext.substring(start, pos)

      if (token.startsWith('$')) {
        addPendingNag(parseInt(token.substring(1), 10))
      } else if (token === '!') {
        addPendingNag(Nag.GOOD_MOVE)
      } else if (token === '?') {
        addPendingNag(Nag.MISTAKE)
      } else if (token === '!!') {
        addPendingNag(Nag.BRILLIANT_MOVE)
      } else if (token === '??') {
        addPendingNag(Nag.BLUNDER)
      } else if (token === '!?') {
        addPendingNag(Nag.SPECULATIVE_MOVE)
      } else if (token === '?!') {
        addPendingNag(Nag.DUBIOUS_MOVE)
      } else if (POSSIBLE_RESULTS.includes(token)) {
        if (!header.Result && variationStack.length === 0) {
          header.Result = token
        }
      } else if (NULL_MOVES.includes(token)) {
        // Unplayable in check: skipped, so what follows stays with the move before
        const move = sanToMove(boardState, '--', { skipSan })
        if (!move) continue
        if (!flushPending()) break
        const undo = makeMove(boardState, move)
        undoStack.push(undo)
        pendingMoveInfo = { move, startingComment: pendingStartingComment }
        pendingStartingComment = undefined
        commentStartsNext = false
        atRootNoMoves = false
      } else if (REGEXP_MOVE_NUMBER.test(token)) {
        continue
      } else {
        // Regular move token
        if (!flushPending()) break
        if (CASTLING_MOVES.includes(token)) {
          token = token.replace(/0/g, 'O')
        }
        token = token.replace(/^\d+\.{1,3}|^\.+|,$/g, '')
        if (!token) continue
        const nags = extractNags(token)
        const move = sanToMove(boardState, token, { skipSan })
        if (!move) {
          throw new Error(`Invalid move token: "${token}"`)
        }
        const undo = makeMove(boardState, move)
        undoStack.push(undo)
        pendingMoveInfo = {
          move,
          nags,
          startingComment: pendingStartingComment,
        }
        pendingStartingComment = undefined
        commentStartsNext = false
        atRootNoMoves = false
      }
    }
  }

  // Flush final pending move
  settleStartingComment()
  flushPending()

  return header
}

export function loadPgn(
  pgn: string,
  options: { newline?: string; width?: number } = {},
): {
  tree: TreeNode<NodeModel>
  currentNode: TreeNode<NodeModel>
  header: HeaderMap
} {
  const fen = extractFen(pgn, options.newline) || DEFAULT_POSITION
  const rootState = loadFen(fen)
  if (!rootState) {
    throw new Error(`Invalid FEN: ${fen}`)
  }

  const tree = new TreeNode<NodeModel>(new NodeState({ boardState: rootState }))
  let currentNode = tree
  const parentNodes: TreeNode<NodeModel>[] = []

  const header = walkPgn(pgn, {
    newline: options.newline,
    // Pinned false: asStoredMove requires san, and onMove's state is
    // post-move, too late to derive it.
    skipSan: false,
    onMove: (move, boardState, comment, startingComment, nags) => {
      currentNode = currentNode.addModel(
        new NodeState({
          boardState: cloneBoardState(boardState),
          move: asStoredMove(move),
          comment,
          startingComment,
          nags,
        }),
      )
    },
    onStartVariation: () => {
      parentNodes.push(currentNode)
      currentNode = currentNode.parent!
    },
    onEndVariation: () => {
      currentNode = parentNodes.pop()!
    },
    onComment: (comment) => {
      const own = currentNode.model.comment
      currentNode.model.comment = own ? `${own} ${comment}` : comment
    },
  })
  return { tree, currentNode, header }
}
/* eslint-enable @typescript-eslint/no-non-null-assertion */
