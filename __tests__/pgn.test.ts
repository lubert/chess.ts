import { loadPgn } from '../src/pgn'
import { Chess } from '../src/chess'
import { moveToSan } from '../src/move'

describe('pgn', () => {
  describe('loadPgn', () => {
    it('works', () => {
  const fen = '4q2k/2r1r3/4PR1p/p1p5/P1Bp1Q1P/1P6/6P1/6K1 b - - 4 41'
  const pgn = `
[Event "Reykjavik WCh"]
[Site "Reykjavik WCh"]
[Date "1972.01.07"]
[EventDate "?"]
[Round "6"]
[Result "1-0"]
[White "Robert James Fischer"]
[Black "Boris Spassky"]
[ECO "D59"]
[WhiteElo "?"]
[BlackElo "?"]
[PlyCount "81"]

1. c4 e6 2. Nf3 d5 3. d4 Nf6 4. Nc3 Be7 5. Bg5 O-O 6. e3 h6
7. Bh4 b6 8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6
12. Qa4 c5 13. Qa3 Rc8 14. Bb5 a6 15. dxc5 bxc5 16. O-O Ra7
17. Be2 Nd7 18. Nd4 Qf8 19. Nxe6 fxe6 20. e4 d4 21. f4 Qe7
22. e5 Rb8 23. Bc4 Kh8 24. Qh3 Nf8 25. b3 a5 26. f5 exf5
27. Rxf5 Nh7 28. Rcf1 Qd8 29. Qg3 Re7 30. h4 Rbb7 31. e6 Rbc7
32. Qe5 Qe8 33. a4 Qd8 34. R1f2 Qe8 35. R2f3 Qd8 36. Bd3 Qe8
37. Qe4 Nf6 38. Rxf6 gxf6 39. Rxf6 Kg8 40. Bc4 Kh8 41. Qf4 1-0`

      const { tree, currentNode, header } = loadPgn(pgn)
      expect(currentNode.model.fen).toEqual(fen)
    })

    it('parses startingComment at beginning of game', () => {
      const pgn = '{Opening comment} 1. e4 e5'
      const chess = new Chess()
      chess.loadPgn(pgn)

      // The startingComment should be on the first move (e4)
      expect(chess.getStartingComment([0])).toEqual('Opening comment')
    })

    it('parses startingComment in variation', () => {
      // Variation after 1. e4: an alternative first move with a starting comment
      const pgn = '1. e4 ({Queens Pawn} 1. d4) e5'
      const chess = new Chess()
      chess.loadPgn(pgn)

      // The variation (1. d4) is the second child of the root node (index 1)
      // The startingComment "Queens Pawn" should be on that variation's first move
      expect(chess.getStartingComment([1])).toEqual('Queens Pawn')
    })

    it('round-trips PGN with startingComment', () => {
      const pgn = '{Opening} 1. e4 ({Alternative} 1. d4) e5'
      const chess = new Chess()
      chess.loadPgn(pgn)

      const exportedPgn = chess.pgn()
      // Should contain the starting comments
      expect(exportedPgn).toContain('{Opening}')
      expect(exportedPgn).toContain('{Alternative}')
    })

    it('parses simple mainline correctly', () => {
      const pgn = '1. e4 e5 2. Nc3 Nf6'
      const { tree, currentNode } = loadPgn(pgn)

      // Tree structure: root -> e4 -> e5 -> Nc3 -> Nf6
      expect(tree.isRoot).toBe(true)
      expect(tree.children.length).toBe(1)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')
      expect(e4.children.length).toBe(1)

      const e5 = e4.children[0]
      expect(moveToSan(e4.model.boardState, e5.model.move!)).toBe('e5')
      expect(e5.children.length).toBe(1)

      const Nc3 = e5.children[0]
      expect(moveToSan(e5.model.boardState, Nc3.model.move!)).toBe('Nc3')
      expect(Nc3.children.length).toBe(1)

      const Nf6 = Nc3.children[0]
      expect(moveToSan(Nc3.model.boardState, Nf6.model.move!)).toBe('Nf6')
      expect(Nf6.children.length).toBe(0)

      // currentNode should be the last move
      expect(currentNode).toBe(Nf6)

      // Round-trip: generate PGN back
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('1. e4 e5 2. Nc3 Nf6')
    })

    it('parses single variation after white move', () => {
      const pgn = '1. e4 (1. d4) 1...e5'
      const { tree } = loadPgn(pgn)

      // Tree structure:
      // (root) has 2 children: e4 (mainline) and d4 (variation)
      // e4 has 1 child: e5
      // d4 has 0 children
      expect(tree.isRoot).toBe(true)
      expect(tree.children.length).toBe(2)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')
      expect(e4.children.length).toBe(1)

      const d4 = tree.children[1]
      expect(moveToSan(tree.model.boardState, d4.model.move!)).toBe('d4')
      expect(d4.children.length).toBe(0)

      const e5 = e4.children[0]
      expect(moveToSan(e4.model.boardState, e5.model.move!)).toBe('e5')
      expect(e5.children.length).toBe(0)

      // Round-trip: generate PGN back
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('1. e4 (1. d4) 1...e5')
    })

    it('parses single variation after black move', () => {
      const pgn = '1. e4 e5 (1...c5) 2. Nf3'
      const { tree } = loadPgn(pgn)

      // Tree structure:
      // (root) -> e4 -> e5 (mainline) -> Nf3
      //                -> c5 (variation)
      expect(tree.isRoot).toBe(true)
      expect(tree.children.length).toBe(1)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')
      expect(e4.children.length).toBe(2)

      const e5 = e4.children[0]
      expect(moveToSan(e4.model.boardState, e5.model.move!)).toBe('e5')
      expect(e5.children.length).toBe(1)

      const c5 = e4.children[1]
      expect(moveToSan(e4.model.boardState, c5.model.move!)).toBe('c5')
      expect(c5.children.length).toBe(0)

      const Nf3 = e5.children[0]
      expect(moveToSan(e5.model.boardState, Nf3.model.move!)).toBe('Nf3')
      expect(Nf3.children.length).toBe(0)

      // Round-trip: generate PGN back
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('1. e4 e5 (1...c5) 2. Nf3')
    })

    it('parses sibling variations', () => {
      const pgn = '1. e4 (1. d4) (1. c4) 1...e5'
      const { tree } = loadPgn(pgn)

      // Tree structure:
      // (root) -> e4 (mainline) -> e5
      //        -> d4 (variation 1)
      //        -> c4 (variation 2)
      expect(tree.isRoot).toBe(true)
      expect(tree.children.length).toBe(3)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')
      expect(e4.children.length).toBe(1)

      const d4 = tree.children[1]
      expect(moveToSan(tree.model.boardState, d4.model.move!)).toBe('d4')
      expect(d4.children.length).toBe(0)

      const c4 = tree.children[2]
      expect(moveToSan(tree.model.boardState, c4.model.move!)).toBe('c4')
      expect(c4.children.length).toBe(0)

      const e5 = e4.children[0]
      expect(moveToSan(e4.model.boardState, e5.model.move!)).toBe('e5')
      expect(e5.children.length).toBe(0)

      // Round-trip: generate PGN back
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('1. e4 (1. d4) (1. c4) 1...e5')
    })

    it('parses nested variations (variation of variation)', () => {
      const pgn = '1. e4 (1. d4 d5 (1...Nf6)) 1...e5'
      const { tree } = loadPgn(pgn)

      // Tree structure:
      // (root) -> e4 (mainline) -> e5
      //        -> d4 (variation) -> d5 (mainline of variation)
      //                          -> Nf6 (nested variation)
      expect(tree.isRoot).toBe(true)
      expect(tree.children.length).toBe(2)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')
      expect(e4.children.length).toBe(1)

      const e5 = e4.children[0]
      expect(moveToSan(e4.model.boardState, e5.model.move!)).toBe('e5')
      expect(e5.children.length).toBe(0)

      const d4 = tree.children[1]
      expect(moveToSan(tree.model.boardState, d4.model.move!)).toBe('d4')
      expect(d4.children.length).toBe(2)

      const d5 = d4.children[0]
      expect(moveToSan(d4.model.boardState, d5.model.move!)).toBe('d5')
      expect(d5.children.length).toBe(0)

      const Nf6 = d4.children[1]
      expect(moveToSan(d4.model.boardState, Nf6.model.move!)).toBe('Nf6')
      expect(Nf6.children.length).toBe(0)

      // Round-trip: generate PGN back
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('1. e4 (1. d4 d5 (1...Nf6)) 1...e5')
    })

    it('parses regular comment after move', () => {
      const pgn = '1. e4 {good move} e5'
      const { tree } = loadPgn(pgn)

      // Tree structure:
      // (root) -> e4 {good move} -> e5
      expect(tree.children.length).toBe(1)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')
      expect(e4.model.comment).toBe('good move')
      expect(e4.children.length).toBe(1)

      const e5 = e4.children[0]
      expect(moveToSan(e4.model.boardState, e5.model.move!)).toBe('e5')
      expect(e5.model.comment).toBeUndefined()

      // Round-trip: generate PGN back
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('1. e4 {good move} 1...e5')
    })

    it('parses starting comment before first move', () => {
      const pgn = '{Opening comment} 1. e4 e5'
      const { tree } = loadPgn(pgn)

      // Tree structure:
      // (root) -> e4 [startingComment: Opening comment] -> e5
      expect(tree.children.length).toBe(1)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')
      expect(e4.model.startingComment).toBe('Opening comment')
      expect(e4.model.comment).toBeUndefined()

      const e5 = e4.children[0]
      expect(moveToSan(e4.model.boardState, e5.model.move!)).toBe('e5')

      // Round-trip: generate PGN back
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('{Opening comment} 1. e4 e5')
    })

    it('parses starting comment in variation', () => {
      const pgn = '1. e4 ({Alternative} 1. d4) 1...e5'
      const { tree } = loadPgn(pgn)

      // Tree structure:
      // (root) -> e4 (mainline) -> e5
      //        -> d4 [startingComment: Alternative] (variation)
      expect(tree.children.length).toBe(2)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')
      expect(e4.model.startingComment).toBeUndefined()

      const d4 = tree.children[1]
      expect(moveToSan(tree.model.boardState, d4.model.move!)).toBe('d4')
      expect(d4.model.startingComment).toBe('Alternative')

      // Round-trip: generate PGN back
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('1. e4 ({Alternative} 1. d4) 1...e5')
    })

    it('parses variation with comment after move inside', () => {
      const pgn = '1. e4 (1. d4 {Queen\'s Pawn}) 1...e5'
      const { tree } = loadPgn(pgn)

      expect(tree.children.length).toBe(2)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')

      const d4 = tree.children[1]
      expect(moveToSan(tree.model.boardState, d4.model.move!)).toBe('d4')
      expect(d4.model.comment).toBe("Queen's Pawn")

      // Round-trip
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('1. e4 (1. d4 {Queen\'s Pawn}) 1...e5')
    })

    it('parses mainline comment + variation with starting comment', () => {
      const pgn = '1. e4 {main line} ({Alternative} 1. d4) 1...e5'
      const { tree } = loadPgn(pgn)

      expect(tree.children.length).toBe(2)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')
      expect(e4.model.comment).toBe('main line')

      const d4 = tree.children[1]
      expect(moveToSan(tree.model.boardState, d4.model.move!)).toBe('d4')
      expect(d4.model.startingComment).toBe('Alternative')

      // Round-trip
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('1. e4 {main line} ({Alternative} 1. d4) 1...e5')
    })

    it('parses sibling variations with comments', () => {
      const pgn = '1. e4 {King\'s Pawn} ({Queen\'s Pawn} 1. d4) ({English} 1. c4) 1...e5'
      const { tree } = loadPgn(pgn)

      expect(tree.children.length).toBe(3)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')
      expect(e4.model.comment).toBe("King's Pawn")

      const d4 = tree.children[1]
      expect(moveToSan(tree.model.boardState, d4.model.move!)).toBe('d4')
      expect(d4.model.startingComment).toBe("Queen's Pawn")

      const c4 = tree.children[2]
      expect(moveToSan(tree.model.boardState, c4.model.move!)).toBe('c4')
      expect(c4.model.startingComment).toBe('English')

      // Round-trip
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('1. e4 {King\'s Pawn} ({Queen\'s Pawn} 1. d4) ({English} 1. c4) 1...e5')
    })

    it('parses nested variation with comments', () => {
      const pgn = '1. e4 (1. d4 d5 {solid} ({Indian} 1...Nf6)) 1...e5'
      const { tree } = loadPgn(pgn)

      expect(tree.children.length).toBe(2)

      const d4 = tree.children[1]
      expect(moveToSan(tree.model.boardState, d4.model.move!)).toBe('d4')
      expect(d4.children.length).toBe(2)

      const d5 = d4.children[0]
      expect(moveToSan(d4.model.boardState, d5.model.move!)).toBe('d5')
      expect(d5.model.comment).toBe('solid')

      const Nf6 = d4.children[1]
      expect(moveToSan(d4.model.boardState, Nf6.model.move!)).toBe('Nf6')
      expect(Nf6.model.startingComment).toBe('Indian')

      // Round-trip
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('1. e4 (1. d4 d5 {solid} ({Indian} 1...Nf6)) 1...e5')
    })

    it('parses starting comment + move comment combined', () => {
      const pgn = '{Game start} 1. e4 {best by test} e5'
      const { tree } = loadPgn(pgn)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')
      expect(e4.model.startingComment).toBe('Game start')
      expect(e4.model.comment).toBe('best by test')

      // Round-trip
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('{Game start} 1. e4 {best by test} 1...e5')
    })

    it('parses nested variations (flattens to siblings)', () => {
      // Nested variation (1...d5) inside (1...c5) is flattened to sibling
      const pgn = '1. e4 e5 (1...c5 (1...d5) 2. Nf3)'
      const { tree } = loadPgn(pgn)

      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')

      // Expected tree structure (flattened):
      // e4 (children: 3)
      // ├── e5 (mainline)
      // ├── c5 (variation) -> Nf3
      // └── d5 (flattened from nested)
      expect(e4.children.length).toBe(3)

      const e5 = e4.children[0]
      expect(moveToSan(e4.model.boardState, e5.model.move!)).toBe('e5')

      const c5 = e4.children[1]
      expect(moveToSan(e4.model.boardState, c5.model.move!)).toBe('c5')
      expect(c5.children.length).toBe(1) // Only Nf3 continuation

      const Nf3 = c5.children[0]
      expect(moveToSan(c5.model.boardState, Nf3.model.move!)).toBe('Nf3')

      // d5 is now a sibling of c5, not a child
      const d5 = e4.children[2]
      expect(moveToSan(e4.model.boardState, d5.model.move!)).toBe('d5')

      // Round-trip produces flattened output
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('1. e4 e5 (1...c5 2. Nf3) (1...d5)')
    })

    it('parses deeply nested variations (flattens all to siblings)', () => {
      // All nested variations are flattened to siblings of c5
      const pgn = '1. e4 e5 (1...c5 (1...d5 (1...b5)) 2. Nf3)'
      const { tree } = loadPgn(pgn)

      const e4 = tree.children[0]

      // Expected tree structure (flattened):
      // e4 (children: 4)
      // ├── e5 (mainline)
      // ├── c5 (variation) -> Nf3
      // ├── d5 (flattened)
      // └── b5 (flattened)
      expect(e4.children.length).toBe(4)

      const c5 = e4.children[1]
      expect(moveToSan(e4.model.boardState, c5.model.move!)).toBe('c5')
      expect(c5.children.length).toBe(1) // Only Nf3

      const Nf3 = c5.children[0]
      expect(moveToSan(c5.model.boardState, Nf3.model.move!)).toBe('Nf3')

      const d5 = e4.children[2]
      expect(moveToSan(e4.model.boardState, d5.model.move!)).toBe('d5')

      const b5 = e4.children[3]
      expect(moveToSan(e4.model.boardState, b5.model.move!)).toBe('b5')

      // Round-trip produces flattened output
      const chess = new Chess()
      chess.loadPgn(pgn)
      expect(chess.pgn()).toBe('1. e4 e5 (1...c5 2. Nf3) (1...d5) (1...b5)')
    })

    it('parses multiple nested variations at same level (flattens all)', () => {
      // Both d5 and b5 nested inside c5 variation are flattened to siblings
      const pgn = '1. e4 e5 (1...c5 (1...d5) (1...b5) 2. Nf3)'
      const { tree } = loadPgn(pgn)

      const e4 = tree.children[0]

      // Expected tree structure (flattened):
      // e4 (children: 4)
      // ├── e5 (mainline)
      // ├── c5 (variation) -> Nf3
      // ├── d5 (flattened)
      // └── b5 (flattened)
      expect(e4.children.length).toBe(4)

      const c5 = e4.children[1]
      expect(moveToSan(e4.model.boardState, c5.model.move!)).toBe('c5')
      expect(c5.children.length).toBe(1) // Only Nf3

      const Nf3 = c5.children[0]
      expect(moveToSan(c5.model.boardState, Nf3.model.move!)).toBe('Nf3')

      const d5 = e4.children[2]
      expect(moveToSan(e4.model.boardState, d5.model.move!)).toBe('d5')

      const b5 = e4.children[3]
      expect(moveToSan(e4.model.boardState, b5.model.move!)).toBe('b5')

      // Round-trip produces flattened output
      const chess = new Chess()
      chess.loadPgn(pgn)
      expect(chess.pgn()).toBe('1. e4 e5 (1...c5 2. Nf3) (1...d5) (1...b5)')
    })

    it('parses complex game with multiple variations and comments', () => {
      const pgn = '{A classic opening} 1. e4 {King\'s Pawn} e5 ({Sicilian} 1...c5 2. Nf3) 2. Nf3 Nc6 ({Petroff} 2...Nf6 {equal game})'
      const { tree } = loadPgn(pgn)

      // Root -> e4
      const e4 = tree.children[0]
      expect(moveToSan(tree.model.boardState, e4.model.move!)).toBe('e4')
      expect(e4.model.startingComment).toBe('A classic opening')
      expect(e4.model.comment).toBe("King's Pawn")
      expect(e4.children.length).toBe(2)

      // e4 -> e5 (mainline)
      const e5 = e4.children[0]
      expect(moveToSan(e4.model.boardState, e5.model.move!)).toBe('e5')
      expect(e5.children.length).toBe(1)

      // e4 -> c5 (Sicilian variation)
      const c5 = e4.children[1]
      expect(moveToSan(e4.model.boardState, c5.model.move!)).toBe('c5')
      expect(c5.model.startingComment).toBe('Sicilian')
      expect(c5.children.length).toBe(1)

      // c5 -> Nf3 (continuation in Sicilian)
      const Nf3InSicilian = c5.children[0]
      expect(moveToSan(c5.model.boardState, Nf3InSicilian.model.move!)).toBe('Nf3')

      // e5 -> Nf3 (mainline)
      const Nf3 = e5.children[0]
      expect(moveToSan(e5.model.boardState, Nf3.model.move!)).toBe('Nf3')
      expect(Nf3.children.length).toBe(2)

      // Nf3 -> Nc6 (mainline)
      const Nc6 = Nf3.children[0]
      expect(moveToSan(Nf3.model.boardState, Nc6.model.move!)).toBe('Nc6')

      // Nf3 -> Nf6 (Petroff variation)
      const Nf6 = Nf3.children[1]
      expect(moveToSan(Nf3.model.boardState, Nf6.model.move!)).toBe('Nf6')
      expect(Nf6.model.startingComment).toBe('Petroff')
      expect(Nf6.model.comment).toBe('equal game')

      // Round-trip
      // Note: 1...e5 has move number because {King's Pawn} is intervening annotation
      const chess = new Chess()
      chess.loadPgn(pgn)
      const exportedPgn = chess.pgn()
      expect(exportedPgn).toBe('{A classic opening} 1. e4 {King\'s Pawn} 1...e5 ({Sicilian} 1...c5 2. Nf3) 2. Nf3 Nc6 ({Petroff} 2...Nf6 {equal game})')
    })
  });

  describe('startingComment methods', () => {
    it('getStartingComment returns undefined when no starting comment', () => {
      const chess = new Chess()
      chess.move('e4')
      expect(chess.getStartingComment()).toBeUndefined()
    })

    it('setStartingComment sets starting comment', () => {
      const chess = new Chess()
      chess.move('e4')
      chess.setStartingComment('A bold opening')
      expect(chess.getStartingComment()).toEqual('A bold opening')
    })

    it('deleteStartingComment removes and returns starting comment', () => {
      const chess = new Chess()
      chess.move('e4')
      chess.setStartingComment('A bold opening')
      const deleted = chess.deleteStartingComment()
      expect(deleted).toEqual('A bold opening')
      expect(chess.getStartingComment()).toBeUndefined()
    })

    it('getStartingComments returns all starting comments', () => {
      const chess = new Chess()
      chess.move('e4')
      chess.setStartingComment('First move')
      chess.move('e5')
      chess.setStartingComment('Response')

      const comments = chess.getStartingComments('indices')
      expect(Object.keys(comments).length).toEqual(2)
    })

    it('deleteComments also removes starting comments', () => {
      const chess = new Chess()
      chess.move('e4')
      chess.setComment('After move comment')
      chess.setStartingComment('Before move comment')

      chess.deleteComments()

      expect(chess.getComment()).toBeUndefined()
      expect(chess.getStartingComment()).toBeUndefined()
    })
  })
})
