<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [chess.ts](./chess.ts.md) &gt; [Chess](./chess.ts.chess.md) &gt; [turn](./chess.ts.chess.turn.md)

## Chess.turn() method

Returns the current side to move.

**Signature:**

```typescript
turn(): Color;
```
**Returns:**

[Color](./chess.ts.color.md)

## Example


```js
chess.load('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')
chess.turn()
// -> 'b'
```

