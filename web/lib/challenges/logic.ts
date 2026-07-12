export const SYMBOLS = ['◆', '▲', '●', '✦', '⬟', '☾'];

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function hashSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(input: string | number) {
  let state = typeof input === 'number' ? input >>> 0 : hashSeed(input);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleSeeded<T>(items: readonly T[], seed: string) {
  const shuffled = [...items];
  const random = createRng(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function normalizeScore(rawScore: number, elapsedSeconds: number, speedWeight: number) {
  return clamp(Math.round(rawScore - elapsedSeconds * speedWeight), 0, 1000);
}

export function caesarEncode(input: string, shift: number) {
  return input
    .toUpperCase()
    .replace(/[A-Z]/g, (character) =>
      String.fromCharCode(((character.charCodeAt(0) - 65 + shift) % 26) + 65),
    );
}

export function normalizeAnswer(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function createSymbolSequence(seed: string, length: number) {
  const random = createRng(`${seed}:${length}`);
  return Array.from({ length }, () => SYMBOLS[Math.floor(random() * SYMBOLS.length)]);
}

export function createCoordinateSecret(seed: string) {
  return shuffleSeeded(SYMBOLS, `coordinates:${seed}`).slice(0, 4);
}

export function scoreCoordinateGuess(secret: string[], guess: string[]) {
  const exact = guess.filter((symbol, index) => symbol === secret[index]).length;
  const remainingSecret = secret.filter((_, index) => guess[index] !== secret[index]);
  const remainingGuess = guess.filter((_, index) => guess[index] !== secret[index]);
  let present = 0;
  const pool = [...remainingSecret];
  for (const symbol of remainingGuess) {
    const match = pool.indexOf(symbol);
    if (match >= 0) {
      present += 1;
      pool.splice(match, 1);
    }
  }
  return { exact, present };
}

export interface MazeDefinition {
  grid: number[][];
  start: [number, number];
  goal: [number, number];
}

export function createMaze(seed: string, size = 9): MazeDefinition {
  const safeSize = size % 2 === 0 ? size + 1 : size;
  const grid = Array.from({ length: safeSize }, () => Array(safeSize).fill(1));
  const random = createRng(`maze:${seed}`);
  const stack: [number, number][] = [[1, 1]];
  grid[1][1] = 0;
  const directions: [number, number][] = [[-2, 0], [2, 0], [0, -2], [0, 2]];

  while (stack.length) {
    const [row, column] = stack[stack.length - 1];
    const options = directions
      .map(([rowStep, columnStep]) => [row + rowStep, column + columnStep, rowStep, columnStep] as const)
      .filter(([nextRow, nextColumn]) =>
        nextRow > 0 && nextRow < safeSize - 1 && nextColumn > 0 && nextColumn < safeSize - 1 && grid[nextRow][nextColumn] === 1,
      );

    if (!options.length) {
      stack.pop();
      continue;
    }

    const [nextRow, nextColumn, rowStep, columnStep] = options[Math.floor(random() * options.length)];
    grid[row + rowStep / 2][column + columnStep / 2] = 0;
    grid[nextRow][nextColumn] = 0;
    stack.push([nextRow, nextColumn]);
  }

  return { grid, start: [1, 1], goal: [safeSize - 2, safeSize - 2] };
}

export function isMazeReachable(maze: MazeDefinition) {
  const queue: [number, number][] = [maze.start];
  const visited = new Set([maze.start.join(':')]);
  while (queue.length) {
    const [row, column] = queue.shift()!;
    if (row === maze.goal[0] && column === maze.goal[1]) return true;
    for (const [rowStep, columnStep] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nextRow = row + rowStep;
      const nextColumn = column + columnStep;
      const key = `${nextRow}:${nextColumn}`;
      if (maze.grid[nextRow]?.[nextColumn] === 0 && !visited.has(key)) {
        visited.add(key);
        queue.push([nextRow, nextColumn]);
      }
    }
  }
  return false;
}
