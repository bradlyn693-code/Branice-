export type PlayerColor = "violet" | "ember";

export type Position = {
  row: number;
  col: number;
};

export type Piece = {
  id: string;
  player: PlayerColor;
  king: boolean;
};

export type Board = Array<Array<Piece | null>>;

export type Move = {
  from: Position;
  to: Position;
  captured?: Position;
  isCapture: boolean;
};

export type GameState = {
  boardSize: 8 | 10 | 12;
  round: number;
  board: Board;
  currentPlayer: PlayerColor;
  forcedFrom: Position | null;
  winner: PlayerColor | null;
  moveCount: number;
  lastMove: Move | null;
};

const openingRows: Record<GameState["boardSize"], number> = {
  8: 3,
  10: 4,
  12: 5,
};

const opponentOf = (player: PlayerColor): PlayerColor =>
  player === "violet" ? "ember" : "violet";

const isInside = (size: number, row: number, col: number) =>
  row >= 0 && row < size && col >= 0 && col < size;

const isPlayable = (row: number, col: number) => (row + col) % 2 === 1;

export const positionKey = ({ row, col }: Position) => `${row}-${col}`;

export const positionsEqual = (left: Position | null, right: Position | null) =>
  Boolean(left && right && left.row === right.row && left.col === right.col);

export function createInitialGame(boardSize: GameState["boardSize"], round = 1): GameState {
  const board: Board = Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => null)
  );
  const rows = openingRows[boardSize];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < boardSize; col += 1) {
      if (isPlayable(row, col)) {
        board[row][col] = { id: `ember-${row}-${col}`, player: "ember", king: false };
      }
    }
  }

  for (let row = boardSize - rows; row < boardSize; row += 1) {
    for (let col = 0; col < boardSize; col += 1) {
      if (isPlayable(row, col)) {
        board[row][col] = { id: `violet-${row}-${col}`, player: "violet", king: false };
      }
    }
  }

  return {
    boardSize,
    round,
    board,
    currentPlayer: "violet",
    forcedFrom: null,
    winner: null,
    moveCount: 0,
    lastMove: null,
  };
}

function movementDirections(piece: Piece): Array<[number, number]> {
  if (piece.king) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }
  const forward = piece.player === "violet" ? -1 : 1;
  return [
    [forward, -1],
    [forward, 1],
  ];
}

export function getMovesForPiece(
  state: GameState,
  from: Position,
  capturesOnly = false
): Move[] {
  const piece = state.board[from.row]?.[from.col];
  if (!piece) return [];

  const captures: Move[] = [];
  const simpleMoves: Move[] = [];

  for (const [rowDelta, colDelta] of movementDirections(piece)) {
    const adjacentRow = from.row + rowDelta;
    const adjacentCol = from.col + colDelta;
    const landingRow = from.row + rowDelta * 2;
    const landingCol = from.col + colDelta * 2;

    if (
      isInside(state.boardSize, adjacentRow, adjacentCol) &&
      isInside(state.boardSize, landingRow, landingCol)
    ) {
      const adjacent = state.board[adjacentRow][adjacentCol];
      const landing = state.board[landingRow][landingCol];
      if (adjacent?.player === opponentOf(piece.player) && !landing) {
        captures.push({
          from,
          to: { row: landingRow, col: landingCol },
          captured: { row: adjacentRow, col: adjacentCol },
          isCapture: true,
        });
      }
    }

    if (!capturesOnly && isInside(state.boardSize, adjacentRow, adjacentCol) && !state.board[adjacentRow][adjacentCol]) {
      simpleMoves.push({
        from,
        to: { row: adjacentRow, col: adjacentCol },
        isCapture: false,
      });
    }
  }

  return captures.length > 0 ? captures : capturesOnly ? [] : simpleMoves;
}

export function getLegalMoves(state: GameState, player = state.currentPlayer): Move[] {
  if (state.winner || player !== state.currentPlayer) return [];

  if (state.forcedFrom) {
    return getMovesForPiece(state, state.forcedFrom, true);
  }

  const pieces: Position[] = [];
  for (let row = 0; row < state.boardSize; row += 1) {
    for (let col = 0; col < state.boardSize; col += 1) {
      if (state.board[row][col]?.player === player) pieces.push({ row, col });
    }
  }

  const captures = pieces.flatMap(position => getMovesForPiece(state, position, true));
  if (captures.length > 0) return captures;
  return pieces.flatMap(position => getMovesForPiece(state, position));
}

export function findMove(state: GameState, from: Position, to: Position): Move | undefined {
  return getLegalMoves(state).find(
    move =>
      move.from.row === from.row &&
      move.from.col === from.col &&
      move.to.row === to.row &&
      move.to.col === to.col
  );
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(piece => (piece ? { ...piece } : null)));
}

function promoteIfNeeded(piece: Piece, destinationRow: number, boardSize: number): Piece {
  if (piece.king) return piece;
  const shouldPromote =
    (piece.player === "violet" && destinationRow === 0) ||
    (piece.player === "ember" && destinationRow === boardSize - 1);
  return shouldPromote ? { ...piece, king: true } : piece;
}

function countPieces(board: Board, player: PlayerColor) {
  return board.flat().filter(piece => piece?.player === player).length;
}

export function applyMove(state: GameState, move: Move): GameState {
  const legalMove = findMove(state, move.from, move.to);
  if (!legalMove) throw new Error("That move is not legal in the current game state.");

  const board = cloneBoard(state.board);
  const movingPiece = board[move.from.row][move.from.col];
  if (!movingPiece) throw new Error("The selected piece no longer exists.");

  board[move.from.row][move.from.col] = null;
  board[move.to.row][move.to.col] = movingPiece;
  if (legalMove.captured) {
    board[legalMove.captured.row][legalMove.captured.col] = null;
  }

  const draft: GameState = {
    ...state,
    board,
    forcedFrom: null,
    moveCount: state.moveCount + 1,
    lastMove: legalMove,
  };

  const continuingCaptures = legalMove.isCapture
    ? getMovesForPiece(draft, legalMove.to, true)
    : [];

  if (continuingCaptures.length > 0) {
    return { ...draft, forcedFrom: legalMove.to };
  }

  board[move.to.row][move.to.col] = promoteIfNeeded(movingPiece, move.to.row, state.boardSize);
  const nextPlayer = opponentOf(state.currentPlayer);
  const nextState = {
    ...draft,
    currentPlayer: nextPlayer,
  };
  const opponentHasPieces = countPieces(board, nextPlayer) > 0;
  const opponentHasMoves = getLegalMoves(nextState, nextPlayer).length > 0;

  return {
    ...nextState,
    winner: opponentHasPieces && opponentHasMoves ? null : state.currentPlayer,
  };
}

export function countPlayerPieces(state: GameState, player: PlayerColor) {
  return countPieces(state.board, player);
}
