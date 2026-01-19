import { loadPgn } from '../src/pgn';
import { Chess } from '../src/chess';
import { readFileSync } from 'fs';
import { join } from 'path';

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

    it('parses comments correctly in Pillsbury vs Tarrasch 1895', () => {
      const pgn = readFileSync(
        join(__dirname, 'fixtures/pgn/pillsbury-tarasch-1895.pgn'),
        'utf-8'
      )
      const chess = new Chess()
      chess.loadPgn(pgn)

      // Move 8 white (cxd5) is at mainline index 14 (0-indexed, 15th ply)
      // Indices are [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] for 15 mainline moves from root
      const move8WhiteIndices = Array(15).fill(0)
      chess.setCurrentNode(move8WhiteIndices)
      const history = chess.history()
      expect(history[history.length - 1]).toEqual('cxd5')
      expect(chess.getComment(move8WhiteIndices)).toEqual(
        'Depriving Black of the opportunity to play dxc4 when the diagonal b7-g2 would be open for his Queen Bishop.'
      )

      // The variation introducing comment should be startingComment on Nf6xd5
      // The variation is an alternative to 8...exd5, so it's a sibling (child of 8.cxd5)
      // 8.cxd5 is at indices [0,0,...,0] (15 zeros), and the variation Nxd5 is its second child (index 1)
      const variationIndices = [...Array(15).fill(0), 1]
      expect(chess.getStartingComment(variationIndices)).toEqual(
        'The classical continuation more common today is'
      )
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
