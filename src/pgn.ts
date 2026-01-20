import { TreeNode } from 'treenode.ts'
import { HexState, HeaderMap } from './interfaces/types'
import { Nag, extractNags } from './interfaces/nag'
import {
  WHITE,
  DEFAULT_POSITION,
  POSSIBLE_RESULTS,
  NULL_MOVES,
  CASTLING_MOVES,
} from './constants'
import { loadFen, sanToMove, makeMove, getFen, moveToSan } from './move'
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
    .filter(([_, val]) => val !== undefined && val !== null)
    .map(([key, val]) => `[${key} "${val}"]`)
}

export function pgnMoves(node: TreeNode<HexState>): string[] {
  // 3. e4 {comment} (variation) e5 {comment} (variation)
  const tokens: string[] = []
  const { boardState } = node.model

  // Special case for initial commented position
  if (node.isRoot && node.model.comment) {
    tokens.push(`{${node.model.comment}}`)
  }

  const formatMove = (state: HexState, isVariation = false) => {
    const { move, comment, nags, startingComment } = state

    // Output starting comment BEFORE the move
    if (startingComment) {
      tokens.push(`{${startingComment}}`)
    }

    if (move) {
      const isFirstMove = !node.model.move
      const san = moveToSan(boardState, move)
      const nagStr =
        nags && nags.length ? ' ' + nags.map((nag) => `$${nag}`).join(' ') : ''
      // Move
      if (move.color === WHITE) {
        tokens.push(`${boardState.move_number}. ${san}${nagStr}`)
      } else if (isFirstMove || isVariation) {
        // Special case for first move black
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
    formatMove(mainline.model)
    variations.forEach((variation) => {
      tokens.push('(')
      formatMove(variation.model, true)
      tokens.push(...pgnMoves(variation))
      tokens.push(')')
    })
    tokens.push(...pgnMoves(mainline))
  }
  return tokens
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
  pgn += moves.join(' ')
  if (header.Result) pgn += ' ' + header.Result
  return pgn.trim()
}

/* eslint-disable @typescript-eslint/no-non-null-assertion */
export function loadPgn(
  pgn: string,
  options: { newline?: string; width?: number } = {},
): {
  tree: TreeNode<HexState>
  currentNode: TreeNode<HexState>
  header: HeaderMap
} {
  const { newline = '\r\n|\n|\r' } = options

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
    // Add a newline as a hint for discerning nested commentary tokens
    moveTokens.push(...line.split(/\s+/), NULL_CHAR)
  }

  // Process lines
  let state: 'header' | 'moves' = 'header'
  while (lines.length) {
    const line = lines.shift()!
    if (state === 'header') {
      // Skip empty lines and comments
      if (!line || line.startsWith('%')) continue
      // Parse header
      if (line.startsWith('[')) {
        parseHeader(line)
        continue
      }
      // Transition to move parsing
      state = 'moves'
      splitMove(line)
    } else if (state === 'moves') {
      // End game parsing on empty line
      if (!line) break
      splitMove(line)
    }
  }

  // Set FEN if present, ignore SetUp for compatibility
  const fen = header.FEN || DEFAULT_POSITION
  const boardState = loadFen(fen)
  if (!boardState) {
    throw new Error(`Invalid FEN: ${fen}`)
  }

  // Build move tree
  const tree = new TreeNode<HexState>({ fen, boardState })
  const parentNodes: TreeNode<HexState>[] = []
  let currentNode = tree
  // Track pending starting comment (comment before a move)
  let pendingStartingComment: string | undefined
  // Track if we just entered a variation (comment after '(' should be startingComment)
  let inVariationStart = false
  // Track if we're at root with no moves yet
  let atRootNoMoves = true

  while (moveTokens.length) {
    let token = moveTokens.shift()!
    if (!token) continue

    if (token.startsWith(';')) {
      if (token.length > 1) moveTokens.unshift(token.substring(1))
      const commentTokens: string[] = []
      while (moveTokens.length) {
        token = moveTokens.shift()!
        if (token === NULL_CHAR) {
          if (commentTokens.length) {
            currentNode.model.comment = commentTokens.join(' ')
          }
          break
        } else {
          commentTokens.push(token)
        }
      }
      if (commentTokens.length) {
        currentNode.model.comment = commentTokens.join(' ')
      }
    } else if (token.includes(';')) {
      moveTokens.unshift(...splitStr(token, ';'))
    } else if (token.startsWith('{')) {
      if (token.length > 1) moveTokens.unshift(token.substring(1))
      const commentTokens: string[] = []
      while (moveTokens.length) {
        token = moveTokens.shift()!
        if (token.endsWith('}')) {
          if (token.length > 1) {
            commentTokens.push(token.substring(0, token.length - 1))
          }
          break
        } else if (token.includes('}')) {
          // Handle case like "comment})" where } is followed by other chars
          const idx = token.indexOf('}')
          if (idx > 0) {
            commentTokens.push(token.substring(0, idx))
          }
          // Push remaining chars back for processing (e.g., the ")")
          if (idx < token.length - 1) {
            moveTokens.unshift(token.substring(idx + 1))
          }
          break
        } else if (token === NULL_CHAR) {
          continue
        }
        commentTokens.push(token)
      }
      const commentText = commentTokens.join(' ')
      // If we're in a variation start or at root with no moves, this is a starting comment
      if (inVariationStart || atRootNoMoves) {
        pendingStartingComment = commentText
      } else {
        currentNode.model.comment = commentText
      }
    } else if (token.startsWith('(')) {
      // Start variation
      if (!currentNode.parent) throw new Error('Missing parent')
      if (token.length > 1) moveTokens.unshift(token.substring(1))
      parentNodes.push(currentNode)
      currentNode = currentNode.parent
      inVariationStart = true
    } else if (token.startsWith(')')) {
      // End variation and return to original node
      if (!parentNodes.length) throw new Error('Mismatched parentheses')
      if (token.length > 1) moveTokens.unshift(token.substring(1))
      currentNode = parentNodes.pop()!
      inVariationStart = false
      pendingStartingComment = undefined
    } else if (token.includes(')')) {
      moveTokens.unshift(...splitStr(token, ')'))
    } else if (token.startsWith('$')) {
      addNag(currentNode, parseInt(token.substring(1), 10))
    } else if (token === '!') {
      addNag(currentNode, Nag.GOOD_MOVE)
    } else if (token === '?') {
      addNag(currentNode, Nag.MISTAKE)
    } else if (token === '!!') {
      addNag(currentNode, Nag.BRILLIANT_MOVE)
    } else if (token === '??') {
      addNag(currentNode, Nag.BLUNDER)
    } else if (token === '!?') {
      addNag(currentNode, Nag.SPECULATIVE_MOVE)
    } else if (token === '?!') {
      addNag(currentNode, Nag.DUBIOUS_MOVE)
    } else if (POSSIBLE_RESULTS.includes(token)) {
      if (!header.Result && isMainline(currentNode)) {
        header.Result = token
      }
    } else if (NULL_MOVES.includes(token)) {
      // Null moves (--) represent a "pass" - handled by sanToMove/makeMove
      const boardState = currentNode.model.boardState
      const move = sanToMove(boardState, '--')
      if (!move) {
        // Null move not allowed (e.g., in check) - skip it
        continue
      }
      const nextState = makeMove(boardState, move)
      currentNode = currentNode.addModel({
        boardState: nextState,
        fen: getFen(nextState),
        move,
        startingComment: pendingStartingComment,
      })
      pendingStartingComment = undefined
      inVariationStart = false
      atRootNoMoves = false
      continue
    } else if (REGEXP_MOVE_NUMBER.test(token)) {
      continue
    } else if (token === NULL_CHAR) {
      continue
    } else {
      const boardState = currentNode.model.boardState
      if (CASTLING_MOVES.includes(token)) {
        token = token.replace(/0/g, 'O')
      }
      // Remove move number (handles 1, 2, or 3 dots for compatibility)
      token = token.replace(/\d+\.{1,3}/g, '')
      // Strip leading dots (handles "..Kf8" when "16." was a separate token)
      token = token.replace(/^\.+/, '')
      // Strip trailing commas (common in older PGN files)
      token = token.replace(/,$/g, '')
      // Skip if token is now empty (was only dots or move number)
      if (!token) continue
      const move = sanToMove(boardState, token)
      if (!move) {
        throw new Error(`Invalid move token: "${token}"`)
      }
      const nextState = makeMove(boardState, move)
      currentNode = currentNode.addModel({
        boardState: nextState,
        fen: getFen(nextState),
        nags: extractNags(token),
        move,
        startingComment: pendingStartingComment,
      })
      pendingStartingComment = undefined
      inVariationStart = false
      atRootNoMoves = false
    }
  }
  return { tree, currentNode, header }
}
/* eslint-enable @typescript-eslint/no-non-null-assertion */
