import seedrandom from 'seedrandom';
import { Board, PieceSymbol, Color, State, HashKey } from './types';
import { BITS } from './constants';

// Seed so that the table is reproducible
const rng = seedrandom('sonofsigma');
// Use two 32 bit ints instead of 64 bit BigInt, since it's not widely supported
const getHashValue = (): HashKey => [rng.int32(), rng.int32()];
const getBoardTable = (): HashKey[] => Array.from(
  { length: 64 }, () => getHashValue()
);
const getPieceTable = (): Record<Color, HashKey[]> => ({
  'w': getBoardTable(),
  'b': getBoardTable(),
});
const tableMap: Record<PieceSymbol, Record<Color, HashKey[]>> = {
  'p': getPieceTable(),
  'n': getPieceTable(),
  'b': getPieceTable(),
  'r': getPieceTable(),
  'q': getPieceTable(),
  'k': getPieceTable(),
};
const whiteTurn = getHashValue();
const castlingTable: Record<Color, Record<'k' | 'q', HashKey>> = {
  'w': {
    'k': getHashValue(),
    'q': getHashValue(),
  },
  'b': {
    'k': getHashValue(),
    'q': getHashValue(),
  },
};

export function hashBoard(board: Board): HashKey {
  const h: HashKey = [0, 0];
  for (let i = 0; i < 64; i++) {
    const piece = board[i];
    if (piece) {
      const { color, type } = piece;
      h[0] ^= tableMap[type][color][i][0];
      h[1] ^= tableMap[type][color][i][1];
    }
  }
  return h;
}

export function hashState(state: State): HashKey {
  const h = hashBoard(state.board);
  // Turn
  if (state.turn === 'w') {
    h[0] ^= whiteTurn[0];
    h[1] ^= whiteTurn[1];
  }
  // Castling
  if (state.castling.w & BITS.KSIDE_CASTLE) {
    h[0] ^= castlingTable.w.k[0];
    h[1] ^= castlingTable.w.k[1];
  }
  if (state.castling.w & BITS.QSIDE_CASTLE) {
    h[0] ^= castlingTable.w.q[0];
    h[1] ^= castlingTable.w.q[1];
  }
  if (state.castling.b & BITS.KSIDE_CASTLE) {
    h[0] ^= castlingTable.b.k[0];
    h[1] ^= castlingTable.b.k[1];
  }
  if (state.castling.b & BITS.QSIDE_CASTLE) {
    h[0] ^= castlingTable.b.q[0];
    h[1] ^= castlingTable.b.q[1];
  }
  // Enpassant
  return h;
}
