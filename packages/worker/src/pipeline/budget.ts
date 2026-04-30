export function calculateSpanBudget(turnCount: number): number {
  const raw = Math.round(turnCount / 2.8);
  return Math.max(3, Math.min(40, raw));
}

export const CHUNK_SIZE = 60;
export const CHUNK_OVERLAP = 10;

export function chunkTurns<T>(turns: T[]): T[][] {
  if (turns.length <= 80) return [turns];

  const chunks: T[][] = [];
  let start = 0;

  while (start < turns.length) {
    const end = Math.min(start + CHUNK_SIZE, turns.length);
    chunks.push(turns.slice(start, end));
    if (end === turns.length) break;
    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}
