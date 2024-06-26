<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [chess.ts](./chess.ts.md) &gt; [Chess](./chess.ts.chess.md) &gt; [getPieces](./chess.ts.chess.getpieces.md)

## Chess.getPieces() method

Returns a map of squares to pieces.

**Signature:**

```typescript
getPieces(): Record<string, Piece>;
```
**Returns:**

Record&lt;string, [Piece](./chess.ts.piece.md)<!-- -->&gt;

Copy of the piece or null

## Example


```js
chess.clear()
chess.put({ type: chess.PAWN, color: chess.BLACK }, 'a5') // put a black pawn on a5

chess.get('a5')
// -> { type: 'p', color: 'b' },
chess.get('a6')
// -> null
```

