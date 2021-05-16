import { TreeNode } from 'treenode.ts';
import { GameState, HeaderMap } from './interfaces/types';
import { Nag } from './interfaces/nag';
import { WHITE, DEFAULT_POSITION, POSSIBLE_RESULTS, NULL_MOVES, CASTLING_MOVES } from './constants';
import { moveToSan, loadFen, sanToMove, makeMove, getFen } from './move';
import { addNag, isMainline } from './gamenode';
import { REGEXP_HEADER_KEY, REGEXP_HEADER_VAL, REGEXP_MOVE_NUMBER } from './regex';

export function pgnHeader(header: HeaderMap): string[] {
  return Object.entries(header).map(([key, val]) => (
    `[${key} "${val}"]`
  ));
}

export function pgnMoves(node: TreeNode<GameState>): string[] {
  // 3. e4 { comment } ( variation ) e5 { comment } ( variation )
  const tokens: string[] = []
  const { move, boardState, comment } = node.model
  if (!move) {
    // Special case for initial commented position
    if (comment) tokens.push(`{ ${comment} }`);
  } else if (node.parent) {
    const san = moveToSan(node.parent.model.boardState, move)
    const isFirstMove = node.parent.model.move === undefined

    // Move
    if (move.color === WHITE) {
      tokens.push(`${boardState.move_number}. ${san}`)
    } else if (isFirstMove) {
      // Special case for first move black
      tokens.push(`${node.parent.model.boardState.move_number}...${san}`)
    } else {
      tokens.push(san)
    }

    // Comment
    if (comment) tokens.push(`{ ${comment} }`)
  }

  // Variations
  const mainline = node.children[0]
  if (mainline) {
    tokens.push(...pgnMoves(mainline))
  }
  return tokens
}

export function getPgn(
  tree: TreeNode<GameState>,
  header: HeaderMap,
  options: { newline_char?: string } = {}
): string {
  const { newline_char = '\n' } = options
  let pgn = ''
  pgn += pgnHeader(header).join(newline_char) + newline_char
  pgnMoves(tree).forEach((token) => {
    if (token.startsWith('{')) {
      pgn += newline_char + token + newline_char
    } else if (token.match(/^\d/)) {
      pgn += newline_char + token
    } else {
      pgn += ' ' + token
    }
  })
  if (header.Result) pgn += ' ' + header.Result
  return pgn.trim()
}

export function loadPgn(pgn: string): { tree: TreeNode<GameState>, currentNode: TreeNode<GameState>, header: HeaderMap } {
  // Split on newlines and read line by line
  const lines = pgn.split(/\r?\n/)

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

  const splitMove = (line: string) => {
    moveTokens.push(...line.split(/\s+/))
  }

  // Process lines
  let state: 'header' | 'moves' = 'header'
  for (let i = 0; i < lines.length; i++) {
    // Remove semicolon comments
    let line = lines[i].replace(/;[^}]+$/, '').trim();

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
  const tree = new TreeNode<GameState>({ fen, boardState })
  const parentNodes: TreeNode<GameState>[] = []
  let currentNode = tree

  while (moveTokens.length) {
    let token = moveTokens.shift()!
    if (token.startsWith('{')) {
      if (token.length > 1) moveTokens.unshift(token.substring(1))
      const commentTokens = []
      while (moveTokens.length) {
        token = moveTokens.shift()!
        if (token.startsWith('}')) {
          if (token.length > 1) moveTokens.unshift(token.substring(1))
          currentNode.model.comment = commentTokens.join(' ')
          break
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
    } else {
      const boardState = currentNode.model.boardState
      if (CASTLING_MOVES.includes(token)) {
        token = token.replace(/0/g, 'O')
      }
      const move = sanToMove(boardState, token)
      if (!move) {
        throw new Error(`Invalid move token: ${token}`)
      }
      const nextState = makeMove(boardState, move)
      currentNode = currentNode.addModel({
        boardState: nextState,
        fen: getFen(boardState),
      })
    }
  }
  return { tree, currentNode, header }
}
