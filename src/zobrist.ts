import seedrandom from 'seedrandom';
import { Board, PieceSymbol, Color, State } from './types';

// Seed so that the table is reproducible
const rng = seedrandom('sonofsigma');
// Use two 32 bit ints instead of 64 bit BigInt, since it's not widely supported
const getPair = (): [number, number] => [rng.int32(), rng.int32()];
const getBoardTable = (): number[][] => Array.from({ length: 64 }, () => getPair());
const getPieceTable = (): Record<Color, number[][]> => ({ 'w' : getBoardTable(), 'b' : getBoardTable() });
const tableMap: Record<PieceSymbol, Record<Color, number[][]>> = {
  'p': getPieceTable(),
  'n': getPieceTable(),
  'b': getPieceTable(),
  'r': getPieceTable(),
  'q': getPieceTable(),
  'k': getPieceTable(),
};

export function hashBoard(board: Board): [number, number] {
  const h: [number, number] = [0, 0];
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
