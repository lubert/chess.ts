<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [chess.js](./chess.js.md) &gt; [Chess](./chess.js.chess.md) &gt; [history](./chess.js.chess.history.md)

## Chess.history() method

Returns a list containing the moves of the current game. Options is an optional parameter which may contain a 'verbose' flag. See .moves() for a description of the verbose move fields.

```js
const chess = new Chess()
chess.move('e4')
chess.move('e5')
chess.move('f4')
chess.move('exf4')

chess.history()
// -> ['e4', 'e5', 'f4', 'exf4']

chess.history({ verbose: true })
// -> [{ color: 'w', from: 'e2', to: 'e4', flags: 'b', piece: 'p', san: 'e4' },
//     { color: 'b', from: 'e7', to: 'e5', flags: 'b', piece: 'p', san: 'e5' },
//     { color: 'w', from: 'f2', to: 'f4', flags: 'b', piece: 'p', san: 'f4' },
//     { color: 'b', from: 'e5', to: 'f4', flags: 'c', piece: 'p', captured: 'p', san: 'exf4' }]

```

<b>Signature:</b>

```typescript
history(options?: {
        verbose?: boolean;
    }): (string | Move)[];
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  options | { verbose?: boolean; } |  |

<b>Returns:</b>

(string \| [Move](./chess.js.move.md)<!-- -->)\[\]
