<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [chess.ts](./chess.ts.md) &gt; [Chess](./chess.ts.chess.md) &gt; [load](./chess.ts.chess.load.md)

## Chess.load() method

Clears the board and loads the Forsyth–Edwards Notation (FEN) string.

**Signature:**

```typescript
load(fen: string, options?: {
        positionOnly?: boolean;
        legal?: boolean;
    }): boolean;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  fen | string | FEN string |
|  options | { positionOnly?: boolean; legal?: boolean; } | _(Optional)_ |

**Returns:**

boolean

True if the position was successfully loaded, otherwise false.

