<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [chess.ts](./chess.ts.md) &gt; [isAttacked](./chess.ts.isattacked.md)

## isAttacked() function

Checks if a square is attacked. If an attacking color is not provided, the opposite color of the piece on the square or the current turn is used. This function does not check if the attacking piece is pinned.

**Signature:**

```typescript
export declare function isAttacked(state: Readonly<BoardState>, square: number, color?: Color): boolean;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  state | Readonly&lt;[BoardState](./chess.ts.boardstate.md)<!-- -->&gt; | Board state |
|  square | number | Square to check |
|  color | [Color](./chess.ts.color.md) | _(Optional)_ Color of the attacking side |

**Returns:**

boolean
