import { TreeNode } from 'treenode.ts'
import {
  HexMove,
  HexState,
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
import { loadFen, sanToMove, makeMove, unmakeMove, moveToSan } from './move'
import { cloneBoardState } from './state'
import { REGEXP_HEADER, REGEXP_MOVE_NUMBER } from './regex'

export function addNag(node: TreeNode<HexState>, nag: number): void {
  if (!node.model.nags) {
    node.model.nags = [nag]
    return
  }
  node.model.nags = Array.from(new Set<number>([...node.model.nags, nag]))
}

export function isMainline(node: TreeNode<HexState>): boolean {
  while (node.parent) {
    const parent = node.parent
    if (parent.children[0] !== node) {
      return false
    }
    node = parent
  }
  return true
}

export function pgnHeader(header: HeaderMap): string[] {
  return Object.entries(header)
    .filter(([, val]) => val !== undefined && val !== null)
    .map(([key, val]) => `[${key} "${val}"]`)
}

export function pgnMoves(
  node: TreeNode<HexState>,
  afterAnnotation = false,
): string[] {
  const tokens: string[] = []
  const { boardState } = node.model

  // Special case for initial commented position
  if (node.isRoot && node.model.comment) {
    tokens.push(`{${node.model.comment}}`)
  }

  const formatMove = (
    state: HexState,
    isVariation = false,
    hasInterveningAnnotation = false,
  ) => {
    const { move, comment, nags, startingComment } = state

    // Output starting comment BEFORE the move
    if (startingComment) {
      tokens.push(`{${startingComment}}`)
    }

    if (move) {
      const isFirstMove = !node.model.move
      const san = move.san ?? moveToSan(boardState, move)
      const nagStr =
        nags && nags.length ? ' ' + nags.map((nag) => `$${nag}`).join(' ') : ''
      // Move
      if (move.color === WHITE) {
        tokens.push(`${boardState.move_number}. ${san}${nagStr}`)
      } else if (isFirstMove || isVariation || hasInterveningAnnotation) {
        // Black move needs number indication when:
        // - It's the first move of the game
        // - It's the start of a variation
        // - There's intervening annotation (variation or comment) before it
        tokens.push(`${boardState.move_number}...${san}${nagStr}`)
      } else {
        tokens.push(`${san}${nagStr}`)
      }
    }
    // Comment after the move
    if (comment) tokens.push(`{${comment}}`)
  }

  const [mainline, ...variations] = node.children

  if (mainline) {
    formatMove(mainline.model, false, afterAnnotation)

    variations.forEach((variation) => {
      tokens.push('(')
      formatMove(variation.model, true)
      tokens.push(...pgnMoves(variation))
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
  tree: TreeNode<HexState>,
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
      return match[2]
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

/* eslint-disable @typescript-eslint/no-non-null-assertion */
/** @public */
export function walkPgn(pgn: string, options: WalkPgnOptions): HeaderMap {
  const {
    newline = '\r\n|\n|\r',
    skipSan,
    onMove,
    onStartVariation,
    onEndVariation,
    context,
  } = options

  // Split on newlines and read line by line
  const newlineRe = new RegExp(newline)
  const lines = pgn.split(newlineRe)

  const header: HeaderMap = {}

  // Extract headers, then concatenate movetext lines into a single string
  const movetextParts: string[] = []
  let inHeaders = true
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    if (inHeaders) {
      if (!line || line.startsWith('%')) continue
      if (line.startsWith('[')) {
        const match = line.match(REGEXP_HEADER)
        if (match) header[match[1]] = match[2]
        continue
      }
      inHeaders = false
    } else if (!line) break
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
  type PendingMove = {
    move: HexMove
    comment?: string
    startingComment?: string
    nags?: number[]
  }
  let pendingMoveInfo: PendingMove | undefined
  let pendingStartingComment: string | undefined
  let inVariationStart = false
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

  const setComment = (raw: string) => {
    // Normalize: collapse whitespace runs (including newlines) to single space, trim
    const commentText = raw.replace(/\s+/g, ' ').trim()
    if (!commentText) return
    if (inVariationStart || atRootNoMoves) {
      pendingStartingComment = commentText
    } else if (pendingMoveInfo) {
      pendingMoveInfo.comment = commentText
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

    const ch = movetext[pos]

    if (ch === '{') {
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
    } else if (ch === ';') {
      // Line comment — scan to end of line; setComment handles trim
      const start = pos + 1
      let end = movetext.indexOf('\n', start)
      if (end === -1) end = len
      if (start < end) {
        setComment(movetext.substring(start, end))
      }
      pos = end
    } else if (ch === '(') {
      // Start variation
      if (!flushPending()) break
      if (!undoStack.length) throw new Error('Missing parent')
      pos++

      const lastUndo = undoStack.pop()!
      unmakeMove(boardState, lastUndo)
      variationStack.push({
        restoreDepth: undoStack.length,
        replayUndo: lastUndo,
      })
      if (onStartVariation) onStartVariation()
      inVariationStart = true
    } else if (ch === ')') {
      // End variation
      if (!flushPending()) break
      if (!variationStack.length) throw new Error('Mismatched parentheses')
      pos++

      if (onEndVariation) onEndVariation()
      const { restoreDepth, replayUndo } = variationStack.pop()!
      while (undoStack.length > restoreDepth) {
        unmakeMove(boardState, undoStack.pop()!)
      }
      const redo = makeMove(boardState, replayUndo.move)
      undoStack.push(redo)
      inVariationStart = false
      pendingStartingComment = undefined
    } else {
      // Scan a token: read until whitespace or structural char
      const start = pos
      while (pos < len && !isStructural(movetext.charCodeAt(pos))) pos++
      let token = movetext.substring(start, pos)
      if (!token) continue

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
        if (!flushPending()) break
        const move = sanToMove(boardState, '--', { skipSan })
        if (!move) continue
        const undo = makeMove(boardState, move)
        undoStack.push(undo)
        pendingMoveInfo = {
          move,
          startingComment: pendingStartingComment,
        }
        pendingStartingComment = undefined
        inVariationStart = false
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
        inVariationStart = false
        atRootNoMoves = false
      }
    }
  }

  // Flush final pending move
  flushPending()

  return header
}

export function loadPgn(
  pgn: string,
  options: { newline?: string; width?: number } = {},
): {
  tree: TreeNode<HexState>
  currentNode: TreeNode<HexState>
  header: HeaderMap
} {
  const fen = extractFen(pgn, options.newline) || DEFAULT_POSITION
  const rootState = loadFen(fen)
  if (!rootState) {
    throw new Error(`Invalid FEN: ${fen}`)
  }

  const tree = new TreeNode<HexState>({ boardState: rootState })
  let currentNode = tree
  const parentNodes: TreeNode<HexState>[] = []

  const header = walkPgn(pgn, {
    newline: options.newline,
    onMove: (move, boardState, comment, startingComment, nags) => {
      currentNode = currentNode.addModel({
        boardState: cloneBoardState(boardState),
        move,
        comment,
        startingComment,
        nags,
      })
    },
    onStartVariation: () => {
      parentNodes.push(currentNode)
      currentNode = currentNode.parent!
    },
    onEndVariation: () => {
      currentNode = parentNodes.pop()!
    },
  })
  return { tree, currentNode, header }
}
/* eslint-enable @typescript-eslint/no-non-null-assertion */
