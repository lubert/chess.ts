<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [chess.js](./chess.js.md) &gt; [Chess](./chess.js.chess.md) &gt; [setComment](./chess.js.chess.setcomment.md)

## Chess.setComment() method

Comment on the current position.

```js
const chess = new Chess()

chess.move("e4")
chess.setComment("king's pawn opening")

chess.pgn()
// -> "1. e4 {king's pawn opening}"

```

<b>Signature:</b>

```typescript
setComment(comment: string): void;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  comment | string |  |

<b>Returns:</b>

void
