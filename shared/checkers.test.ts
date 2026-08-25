import { describe, expect, it } from "vitest";
import {
  applyMove,
  createInitialGame,
  getLegalMoves,
  type GameState,
} from "./checkers";

function emptyState(): GameState {
  return {
    boardSize: 8,
    round: 1,
    board: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null)),
    currentPlayer: "violet",
    forcedFrom: null,
    winner: null,
    moveCount: 0,
    lastMove: null,
  };
}

describe("checkers rules engine", () => {
  it("initializes each supported board with the expected number of pieces", () => {
    expect(createInitialGame(8).board.flat().filter(Boolean)).toHaveLength(24);
    expect(createInitialGame(10).board.flat().filter(Boolean)).toHaveLength(40);
    expect(createInitialGame(12).board.flat().filter(Boolean)).toHaveLength(60);
  });

  it("requires a capture when one is available", () => {
    const state = emptyState();
    state.board[5][0] = { id: "violet-capturer", player: "violet", king: false };
    state.board[5][4] = { id: "violet-walker", player: "violet", king: false };
    state.board[4][1] = { id: "ember-target", player: "ember", king: false };

    const moves = getLegalMoves(state);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ from: { row: 5, col: 0 }, to: { row: 3, col: 2 }, isCapture: true });
  });

  it("keeps the same piece active through a multi-jump", () => {
    const state = emptyState();
    state.board[5][0] = { id: "violet-capturer", player: "violet", king: false };
    state.board[4][1] = { id: "ember-one", player: "ember", king: false };
    state.board[2][3] = { id: "ember-two", player: "ember", king: false };

    const afterFirstCapture = applyMove(state, {
      from: { row: 5, col: 0 },
      to: { row: 3, col: 2 },
      captured: { row: 4, col: 1 },
      isCapture: true,
    });

    expect(afterFirstCapture.currentPlayer).toBe("violet");
    expect(afterFirstCapture.forcedFrom).toEqual({ row: 3, col: 2 });
    expect(getLegalMoves(afterFirstCapture)).toMatchObject([
      { from: { row: 3, col: 2 }, to: { row: 1, col: 4 }, isCapture: true },
    ]);
  });

  it("promotes a man upon reaching the far side and permits a king to move backward", () => {
    const state = emptyState();
    state.board[1][2] = { id: "violet-runner", player: "violet", king: false };
    state.board[6][1] = { id: "ember-watcher", player: "ember", king: false };

    const crowned = applyMove(state, {
      from: { row: 1, col: 2 },
      to: { row: 0, col: 1 },
      isCapture: false,
    });

    expect(crowned.board[0][1]?.king).toBe(true);
    crowned.currentPlayer = "violet";
    expect(getLegalMoves(crowned)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: { row: 0, col: 1 }, to: { row: 1, col: 2 } }),
      ])
    );
  });
});
