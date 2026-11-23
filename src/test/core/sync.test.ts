import { describe, it, expect } from 'vitest';
import { diffCollections, applyRemote, key } from '@/core/syncDiff';

describe('sync diff', () => {
  it('detects new, edited and deleted records by identity', () => {
    const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' };
    const prev = { products: [a, b, c] };
    const next = { products: [a, { ...b, x: 1 }, { id: 'd' }] };
    expect(diffCollections(prev, next).sort()).toEqual(['products|b', 'products|c', 'products|d']);
    expect(diffCollections(prev, prev)).toEqual([]);
  });
});

describe('remote apply (LWW)', () => {
  it('applies newer remote, skips older/echo, deletes tombstones, reports conflicts', () => {
    const state = { products: [{ id: 'p1', v: 1 }, { id: 'p2', v: 1 }, { id: 'p3', v: 1 }] as { id: string; v?: number }[] };
    const revs = new Map([[key('products', 'p1'), 100], [key('products', 'p2'), 100]]);
    const dirty = new Set([key('products', 'p3')]);
    const r = applyRemote(state, 'products', [
      { id: 'p1', d: { id: 'p1', v: 2 } as never, rev: 200, dev: 'and-1' },   // newer → apply
      { id: 'p2', d: { id: 'p2', v: 0 } as never, rev: 50, dev: 'and-1' },    // older → skip
      { id: 'p3', d: { id: 'p3', v: 9 } as never, rev: 300, dev: 'and-1' },   // local dirty → conflict
      { id: 'p4', d: { id: 'p4', v: 1 } as never, rev: 300, dev: 'and-1' },   // new
      { id: 'p2', del: true, rev: 400, dev: 'and-1' },                         // delete
    ], revs, dirty);
    expect(r.next.products).toEqual([{ id: 'p1', v: 2 }, { id: 'p3', v: 1 }, { id: 'p4', v: 1 }]);
    expect(r.conflicts).toEqual(['products|p3']);
    expect(r.skipped).toBe(1);
    expect(state.products).toHaveLength(3); // input not mutated
  });
});
