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
import {
  moveToSan,
  loadFen,
  sanToMove,
  makeMove,
  getFen,
  generateMoves,
} from './move'
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
  return Object.entries(header).map(([key, val]) => (
    `[${key} "${val}"]`
  ))
}

export function pgnMoves(node: TreeNode<HexState>): string[] {
  // 3. e4 {comment} (variation) e5 {comment} (variation)
  const tokens: string[] = []
  const { boardState } = node.model

  // Special case for initial commented position
  if (!node.parent && node.model.comment) {
    tokens.push(`{${node.model.comment}}`)
  }

  const formatMove = (state: HexState, isVariation = false) => {
    const { move, comment, nags } = state
    if (move) {
      const isFirstMove = !node.model.move
      const san = moveToSan(
        boardState,
        move,
        generateMoves(boardState, { piece: move.piece }),
      )
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
    // Comment
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
  options: { newline?: string } = {}
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
export function loadPgn(pgn: string, options: { newline?: string, width?: number } = {}): { tree: TreeNode<HexState>, currentNode: TreeNode<HexState>, header: HeaderMap } {
  const { newline = '\r\n|\n|\r' } = options

  // Split on newlines and read line by line
  const newlineRe = new RegExp(newline)
  const lines = pgn.split(newlineRe)

  const header: HeaderMap = {}
  const moveTokens: string[] = []

  const parseHeader = (line: string) => {
    const key = line.replace(REGEXP_HEADER_KEY, '$1').trim()
    const val = line.replace(REGEXP_HEADER_VAL, '$1').trim()
    if (!key.length || !val.length) {
      throw new Error(`Could not parse header: ${line}`)
    }
    header[key] = val
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
          currentNode.model.comment = commentTokens.join(' ')
          break
        } else if (token === NULL_CHAR) {
          continue
        }
        commentTokens.push(token)
      }
    } else if (token.startsWith('(')) {
      // Start variation
      if (!currentNode.parent) throw new Error('Missing parent')
      if (token.length > 1) moveTokens.unshift(token.substring(1))
      parentNodes.push(currentNode)
      currentNode = currentNode.parent
    } else if (token.startsWith(')')) {
      // End variation and return to original node
      if (!parentNodes.length) throw new Error('Mismatched parentheses')
      if (token.length > 1) moveTokens.unshift(token.substring(1))
      currentNode = parentNodes.pop()!
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
      // Remove move number
      token = token.replace(/\d+\.(\.\.)?/g, '')
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
      })
    }
  }
  return { tree, currentNode, header }
}
/* eslint-enable @typescript-eslint/no-non-null-assertion */
