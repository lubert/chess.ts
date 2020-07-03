# chess.ts

[![Build Status](https://travis-ci.org/lubert/chess.ts.svg?branch=master)](https://travis-ci.org/lubert/chess.ts)

chess.ts is a Typescript chess library that is used for chess move
generation/validation, piece placement/movement, and check/checkmate/stalemate
detection - basically everything but the AI.

chess.ts has been extensively tested in node.js and most modern browsers.

## Installation

To install the stable version:

```
# NPM
npm install @lubert/chess.ts

# Yarn
yarn add @lubert/chess.ts
```

## [Documentation](./docs/chess.ts.md)

## Example Code

The code below plays a random game of chess:

```js
import { Chess } from '@lubert/chess.ts'
const chess = new Chess()

while (!chess.game_over()) {
  const moves = chess.moves()
  const move = moves[Math.floor(Math.random() * moves.length)]
  chess.move(move)
}
console.log(chess.pgn())
```

## User Interface

By design, chess.ts is headless and does not include user interface.  Many
developers have had success integrating chess.js with the
[chessboard.js](http://chessboardjs.com) library. See
[chessboard.js - Random vs Random](http://chessboardjs.com/examples#5002) for
an example.

## MUSIC

Musical support provided by:

-   [The Grateful Dead](https://www.youtube.com/watch?v=z-D9rdJWfWs)
-   [Umphrey's McGee](https://www.youtube.com/watch?v=auEfZVcYp64)

## BUGS

-   The en passant square and castling flags aren't adjusted when using the put/remove functions (workaround: use .load() instead)
