<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [chess.ts](./chess.ts.md) &gt; [Chess](./chess.ts.chess.md) &gt; [getPiece](./chess.ts.chess.getpiece.md)

## Chess.getPiece() method

Returns the piece on the square.

**Signature:**

```typescript
getPiece(square: string): Piece | null;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  square | string | e.g. 'e4' |

**Returns:**

[Piece](./chess.ts.piece.md) \| null

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

