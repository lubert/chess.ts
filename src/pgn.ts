import { TreeNode } from 'treenode.ts'
import {
  HexMove,
  HexState,
  HeaderMap,
  UndoInfo,
  WalkPgnOptions,
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
import {
  REGEXP_HEADER_KEY,
  REGEXP_HEADER_VAL,
  REGEXP_MOVE_NUMBER,
} from './regex'
import { splitStr } from './utils'

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
    const key = line.replace(REGEXP_HEADER_KEY, '$1').trim()
    if (key === 'FEN') {
      return line.replace(REGEXP_HEADER_VAL, '$1').trim()
    }
  }
  return undefined
}

/* eslint-disable @typescript-eslint/no-non-null-assertion */
export function walkPgn(pgn: string, options: WalkPgnOptions): HeaderMap {
  const {
    newline = '\r\n|\n|\r',
    skipSan,
    onMove,
    onStartVariation,
    onEndVariation,
  } = options

  // Split on newlines and read line by line
  const newlineRe = new RegExp(newline)
  const lines = pgn.split(newlineRe)

  const header: HeaderMap = {}
  const moveTokens: string[] = []

  const parseHeader = (line: string) => {
    const key = line.replace(REGEXP_HEADER_KEY, '$1').trim()
    const val = line.replace(REGEXP_HEADER_VAL, '$1').trim()
    if (key.length && val.length) {
      header[key] = val
    }
  }

  const NULL_CHAR = '\0'
  const splitMove = (line: string) => {
    moveTokens.push(...line.split(/\s+/), NULL_CHAR)
  }

  // Process lines into header + move tokens
  let lineState: 'header' | 'moves' = 'header'
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    if (lineState === 'header') {
      if (!line || line.startsWith('%')) continue
      if (line.startsWith('[')) {
        parseHeader(line)
        continue
      }
      lineState = 'moves'
      splitMove(line)
    } else if (lineState === 'moves') {
      if (!line) break
      splitMove(line)
    }
  }

  // Set up board state
  const fen = header.FEN || DEFAULT_POSITION
  const boardState = loadFen(fen)
  if (!boardState) {
    throw new Error(`Invalid FEN: ${fen}`)
  }

  // Undo stack for make/unmake
  const undoStack: UndoInfo[] = []
  // Variation stack: when entering a variation, we unmake the last mainline move
  // and save the undo info so we can replay it when exiting the variation
  const variationStack: Array<{ restoreDepth: number; replayUndo: UndoInfo }> =
    []

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

  // Tokenizer state
  let mi = 0
  const pending: string[] = []

  const nextToken = (): string | undefined => {
    if (pending.length) return pending.pop()!
    if (mi < moveTokens.length) return moveTokens[mi++]
    return undefined
  }
  const pushBack = (t: string) => {
    pending.push(t)
  }
  const pushBackMultiple = (ts: string[]) => {
    for (let i = ts.length - 1; i >= 0; i--) pending.push(ts[i])
  }

  for (let token = nextToken(); token !== undefined; token = nextToken()) {
    if (!token) continue
    if (aborted) break

    if (token.startsWith(';')) {
      // Line comment — collect until NULL_CHAR (end of line)
      if (token.length > 1) pushBack(token.substring(1))
      const commentTokens: string[] = []
      for (token = nextToken(); token !== undefined; token = nextToken()) {
        if (token === NULL_CHAR) break
        commentTokens.push(token)
      }
      if (commentTokens.length) {
        const commentText = commentTokens.join(' ')
        if (pendingMoveInfo) {
          pendingMoveInfo.comment = commentText
        }
      }
    } else if (token.includes(';')) {
      pushBackMultiple(splitStr(token, ';'))
    } else if (token.startsWith('{')) {
      // Block comment
      if (token.length > 1) pushBack(token.substring(1))
      const commentTokens: string[] = []
      for (token = nextToken(); token !== undefined; token = nextToken()) {
        if (token.endsWith('}')) {
          if (token.length > 1) {
            commentTokens.push(token.substring(0, token.length - 1))
          }
          break
        } else if (token.includes('}')) {
          const idx = token.indexOf('}')
          if (idx > 0) {
            commentTokens.push(token.substring(0, idx))
          }
          if (idx < token.length - 1) {
            pushBack(token.substring(idx + 1))
          }
          break
        } else if (token === NULL_CHAR) {
          continue
        }
        commentTokens.push(token)
      }
      const commentText = commentTokens.join(' ')
      if (inVariationStart || atRootNoMoves) {
        pendingStartingComment = commentText
      } else if (pendingMoveInfo) {
        pendingMoveInfo.comment = commentText
      }
    } else if (token.startsWith('(')) {
      // Start variation
      if (!flushPending()) break
      if (!undoStack.length) throw new Error('Missing parent')
      if (token.length > 1) pushBack(token.substring(1))

      // Unmake the last move to get back to the parent position
      const lastUndo = undoStack.pop()!
      unmakeMove(boardState, lastUndo)
      variationStack.push({
        restoreDepth: undoStack.length,
        replayUndo: lastUndo,
      })
      if (onStartVariation) onStartVariation()
      inVariationStart = true
    } else if (token.startsWith(')')) {
      // End variation
      if (!flushPending()) break
      if (!variationStack.length) throw new Error('Mismatched parentheses')
      if (token.length > 1) pushBack(token.substring(1))

      if (onEndVariation) onEndVariation()
      const { restoreDepth, replayUndo } = variationStack.pop()!
      // Unmake all moves back to restoreDepth
      while (undoStack.length > restoreDepth) {
        unmakeMove(boardState, undoStack.pop()!)
      }
      // Re-make the mainline move
      const redo = makeMove(boardState, replayUndo.move)
      undoStack.push(redo)
      inVariationStart = false
      pendingStartingComment = undefined
    } else if (token.includes(')')) {
      pushBackMultiple(splitStr(token, ')'))
    } else if (token.startsWith('$')) {
      const nag = parseInt(token.substring(1), 10)
      if (pendingMoveInfo) {
        if (!pendingMoveInfo.nags) pendingMoveInfo.nags = [nag]
        else pendingMoveInfo.nags.push(nag)
      }
    } else if (token === '!') {
      if (pendingMoveInfo) {
        if (!pendingMoveInfo.nags) pendingMoveInfo.nags = [Nag.GOOD_MOVE]
        else pendingMoveInfo.nags.push(Nag.GOOD_MOVE)
      }
    } else if (token === '?') {
      if (pendingMoveInfo) {
        if (!pendingMoveInfo.nags) pendingMoveInfo.nags = [Nag.MISTAKE]
        else pendingMoveInfo.nags.push(Nag.MISTAKE)
      }
    } else if (token === '!!') {
      if (pendingMoveInfo) {
        if (!pendingMoveInfo.nags) pendingMoveInfo.nags = [Nag.BRILLIANT_MOVE]
        else pendingMoveInfo.nags.push(Nag.BRILLIANT_MOVE)
      }
    } else if (token === '??') {
      if (pendingMoveInfo) {
        if (!pendingMoveInfo.nags) pendingMoveInfo.nags = [Nag.BLUNDER]
        else pendingMoveInfo.nags.push(Nag.BLUNDER)
      }
    } else if (token === '!?') {
      if (pendingMoveInfo) {
        if (!pendingMoveInfo.nags) pendingMoveInfo.nags = [Nag.SPECULATIVE_MOVE]
        else pendingMoveInfo.nags.push(Nag.SPECULATIVE_MOVE)
      }
    } else if (token === '?!') {
      if (pendingMoveInfo) {
        if (!pendingMoveInfo.nags) pendingMoveInfo.nags = [Nag.DUBIOUS_MOVE]
        else pendingMoveInfo.nags.push(Nag.DUBIOUS_MOVE)
      }
    } else if (POSSIBLE_RESULTS.includes(token)) {
      if (!header.Result) {
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
    } else if (token === NULL_CHAR) {
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
