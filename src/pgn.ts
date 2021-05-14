import { TreeNode } from 'treenode.ts';
import { GameState, HeaderMap } from './interfaces/types';
import { Nag } from './interfaces/nag';
import { WHITE, DEFAULT_POSITION, POSSIBLE_RESULTS, NULL_MOVES, CASTLING_MOVES } from './constants';
import { moveToSan, loadFen, sanToMove, makeMove, getFen } from './state';
import { addNag, isMainline } from './gamenode';

export function pgnHeader(header: HeaderMap): string[] {
  return Object.entries(header).map(([key, val]) => (
    `[${key} "${val}"]`
  ));
}

export function pgnMoves(tree: TreeNode<GameState>): string[] {
  // 3. e4 { comment } ( variation ) e5 { comment } ( variation )
  const tokens: string[] = []
  tree.pre((node) => {
    const { move, boardState, comment } = node.model
    // Special case for initial commented position
    if (!move) {
      if (comment) tokens.push(`{ ${comment} }`);
      return
    }

    const san = moveToSan(boardState, move)
    const isFirstMove = node.parent?.model.move !== undefined

    // Move
    if (move.color === WHITE) {
      tokens.push('${boardState.move_number}.${san}')
    } else if (isFirstMove) {
      tokens.push('${boardState.move_number}...${san}')
    } else {
      tokens.push(san)
    }

    // Comment
    if (comment) tokens.push(`{ ${comment} }`)

    // Variations
    const [mainline, ...variations] = node.children
    tokens.push(...pgnMoves(mainline))
    variations.forEach((variation) =>{
      tokens.push('(', ...pgnMoves(variation), ')')
    })
  });
  return tokens
}

export function getPgn(
  tree: TreeNode<GameState>,
  header: HeaderMap,
  options: { newline_char?: string } = {}
): string {
  const {
    newline_char = '\n',
  } = options

  const headerRows = pgnHeader(header)
  const moveTokens = pgnMoves(tree)
  const result = header.Result ? ` ${header.Result}` : ''

  return headerRows.join(newline_char) + moveTokens.join(' ') + result
}

export function mask(str: string): string {
  return str.replace(/\\/g, '\\')
}

export function parseHeader(headerStr: string, options: { newline_char: string }) {
  const { newline_char }  = options
  const header: { [key: string]: string } = {}
  const headers = headerStr.split(new RegExp(mask(newline_char)))
  let key = ''
  let value = ''

  for (let i = 0; i < headers.length; i++) {
    key = headers[i].replace(/^\[([A-Z][A-Za-z]*)\s.*\]$/, '$1')
    value = headers[i].replace(/^\[[A-Za-z]+\s"(.*)" *\]$/, '$1')
    if (key.trim().length > 0) {
      header[key.trim()] = value
    }
  }

  return header
}

type ParseState = 'header' | 'moves'

export function loadPgn(pgn: string): { tree: TreeNode<GameState>, header: HeaderMap } {
  // Split on newlines and read line by line
  const lines = pgn.split(/\r?\n/)

  const header: HeaderMap = {}
  const moveTokens: string[] = []

  const parseHeader = (line: string) => {
    const key = line.replace(/^\[([A-Z][A-Za-z]*)\s.*\]$/, '$1').trim()
    const val = line.replace(/^\[[A-Za-z]+\s"(.*)" *\]$/, '$1').trim()
    if (!key.length || !val.length) {
      throw new Error(`Could not parse header: ${line}`)
    }
    header[key] = val
  }

  const parseMove = (line: string) => {
    moveTokens.push(...line.split(/(\s+)/))
  }

  // Process lines
  let state: ParseState = 'header'
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
      parseMove(line)
    } else if (state === 'moves') {
      // End game parsing on empty line
      if (!line) break
      parseMove(line)
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
      if (!currentNode.parent) throw new Error('Missing parent')
      if (token.length > 1) moveTokens.unshift(token.substring(1))
      // Start variation
      currentNode = currentNode.parent
    } else if (token.startsWith(')')) {
      if (!currentNode.parent) throw new Error('Missing parent')
      if (token.length > 1) moveTokens.unshift(token.substring(1))
      currentNode = currentNode.parent
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
    } else if (CASTLING_MOVES.includes(token)) {
      token.replace(/0/g, 'O');
      const prevState = currentNode.model.boardState
      const move = sanToMove(prevState, token)
      if (!move) {
        throw new Error(`Invalid move token: {token}`)
      }
      const boardState = makeMove(prevState, move)
      currentNode = currentNode.addModel({
        boardState,
        fen: getFen(boardState),
      })
    } else {
      // try to parse move
    }
  }
  return { tree, header }
}
