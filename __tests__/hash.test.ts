import { Chess } from '../src/chess'
import { getFen } from '../src/move'
import { hashBoardState } from '../src/hash'
import { BoardState } from '../src/interfaces/types'

/* deterministic pseudo-random games, so a failure is reproducible */
function sampleStates(chess960: boolean, games = 25, plies = 40): BoardState[] {
  const states: BoardState[] = []
  for (let g = 0; g < games; g++) {
    const chess = chess960 ? new Chess({ chess960: true }) : new Chess()
    let seed = g * 7919 + 13
    const rnd = () =>
      (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    for (let i = 0; i < plies; i++) {
      const moves = chess.sanMoves()
      if (!moves.length) break
      chess.move(moves[Math.floor(rnd() * moves.length)])
      states.push((chess as unknown as { boardState: BoardState }).boardState)
    }
  }
  return states
}

const fenKey = (state: BoardState) =>
  getFen(state).split(' ').slice(0, 4).join(' ')
const hashKey = (state: BoardState) => hashBoardState(state).join(':')

describe('hashBoardState', () => {
  /*
   * Repetition detection relies on the hash agreeing with the FEN prefix
   * exactly. A hash that ignores part of the position (castling rights were
   * dropped once, because BITS.KSIDE_CASTLE is 32 rather than 1) collides
   * silently and produces phantom draws.
   */
  describe.each([
    ['standard', false],
    ['chess960', true],
  ])('%s', (_name, chess960) => {
    const states = sampleStates(chess960)

    it('samples enough distinct positions to be meaningful', () => {
      expect(new Set(states.map(fenKey)).size).toBeGreaterThan(500)
    })

    it('gives equal hashes exactly when FEN prefixes are equal', () => {
      const byFen = new Map<string, string>()
      const byHash = new Map<string, string>()
      for (const state of states) {
        const fen = fenKey(state)
        const hash = hashKey(state)
        if (byFen.has(fen)) expect(byFen.get(fen)).toEqual(hash)
        if (byHash.has(hash)) expect(byHash.get(hash)).toEqual(fen)
        byFen.set(fen, hash)
        byHash.set(hash, fen)
      }
    })
  })

  it('distinguishes positions that differ only in castling rights', () => {
    const board = 'r3k2r/8/8/8/8/8/8/R3K2R w '
    const hashes = ['KQkq', 'KQk', 'Kkq', 'kq', '-'].map((rights) =>
      hashKey(
        (
          new Chess(board + rights + ' - 0 1') as unknown as {
            boardState: BoardState
          }
        ).boardState,
      ),
    )
    expect(new Set(hashes).size).toBe(hashes.length)
  })

  it('distinguishes positions that differ only in side to move', () => {
    const w = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1')
    const b = new Chess('4k3/8/8/8/8/8/8/4K3 b - - 0 1')
    expect(hashKey((w as any).boardState)).not.toEqual(
      hashKey((b as any).boardState),
    )
  })

  it('ignores the halfmove and fullmove counters', () => {
    const a = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1')
    const b = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 30 40')
    expect(hashKey((a as any).boardState)).toEqual(
      hashKey((b as any).boardState),
    )
  })

  it('ignores an en passant square that cannot legally be captured', () => {
    /* both are the same position: the ep square in the first is unplayable,
     * so getFen writes '-' for it and the hash must follow
     */
    const withEp = new Chess(
      'rnbqkbnr/pppp1ppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    )
    const withoutEp = new Chess(
      'rnbqkbnr/pppp1ppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    )
    expect(hashKey((withEp as any).boardState)).toEqual(
      hashKey((withoutEp as any).boardState),
    )
  })

  it('separates positions whose en passant capture is real', () => {
    const live = new Chess('4k3/8/8/8/4Pp2/8/8/4K3 b - e3 0 1')
    const dead = new Chess('4k3/8/8/8/4Pp2/8/8/4K3 b - - 0 1')
    expect(hashKey((live as any).boardState)).not.toEqual(
      hashKey((dead as any).boardState),
    )
  })
})

describe('inThreefoldRepetition', () => {
  it('detects a straightforward repetition', () => {
    const chess = new Chess()
    for (const m of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) {
      chess.move(m)
    }
    expect(chess.inThreefoldRepetition()).toBe(true)
  })

  it('does not fire on a game with no repetition', () => {
    const chess = new Chess()
    for (const m of ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']) chess.move(m)
    expect(chess.inThreefoldRepetition()).toBe(false)
  })

  it('counts positions reached by different move orders', () => {
    /* the same position twice via transposition, then a third time */
    const chess = new Chess()
    for (const m of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nc3', 'Nc6', 'Nb1', 'Nb8']) {
      chess.move(m)
    }
    expect(chess.inThreefoldRepetition()).toBe(true)
  })
})
