export type StoneColor = 'rose' | 'sage';

export interface CellDef {
  x: number;
  y: number;
  color: StoneColor;
}

export const GRID_SIZE = 11;
export const CELL_GAP = 0.08;

export const COLORS: Record<
  StoneColor,
  { matte: number; gem: number; emissive: number; outline: number }
> = {
  rose: {
    matte: 0xc4788a,
    gem: 0xe88da0,
    emissive: 0xffb8c8,
    outline: 0xd4a0ad,
  },
  sage: {
    matte: 0x7a9e8a,
    gem: 0x8fb89e,
    emissive: 0xb8e8c8,
    outline: 0x9ab8a8,
  },
};

/** Heart-shaped mosaic split into rose (left) and sage (right) halves */
const HEART_MASK: string[] = [
  '....XXX....',
  '...XXXXX...',
  '..XXXXXXX..',
  '.XXXXXXXXX.',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  '.XXXXXXXXX.',
  '..XXXXXXX..',
  '...XXXXX...',
  '....XXX....',
  '.....X.....',
];

export function buildMosaicCells(): CellDef[] {
  const cells: CellDef[] = [];
  const mid = (GRID_SIZE - 1) / 2;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (HEART_MASK[y]?.[x] !== 'X') continue;
      const color: StoneColor = x <= mid ? 'rose' : 'sage';
      cells.push({ x, y, color });
    }
  }

  return cells;
}

export function gridToWorld(x: number, y: number): { wx: number; wy: number } {
  const offset = (GRID_SIZE - 1) / 2;
  return {
    wx: (x - offset) * (1 + CELL_GAP),
    wy: (offset - y) * (1 + CELL_GAP),
  };
}
