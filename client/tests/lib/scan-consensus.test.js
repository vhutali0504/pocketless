import { createConsensus } from '../../src/lib/scan-consensus.js';

const A = { value: '4006381333931', format: 'EAN_13' };
const B = { value: '5901234123457', format: 'EAN_13' };
const BAD = { value: '4006381333932', format: 'EAN_13' };

describe('createConsensus', () => {
  it('returns the read on the third identical push', () => {
    const c = createConsensus();
    expect(c.push(A)).toBeNull();
    expect(c.push(A)).toBeNull();
    expect(c.push(A)).toEqual(A);
  });

  it('is broken by a different value', () => {
    const c = createConsensus();
    for (const r of [A, A, B, A, A]) expect(c.push(r)).toBeNull();
  });

  it('ignores reads that fail the checksum without breaking the run', () => {
    const c = createConsensus();
    expect(c.push(A)).toBeNull();
    expect(c.push(A)).toBeNull();
    expect(c.push(BAD)).toBeNull();
    expect(c.push(A)).toEqual(A);
  });

  it('does not count invalid reads towards the run', () => {
    const c = createConsensus();
    for (const r of [BAD, BAD, BAD]) expect(c.push(r)).toBeNull();
  });

  it('treats the same value in a different format as a different read', () => {
    const c = createConsensus();
    const code128 = { value: A.value, format: 'CODE_128' };
    for (const r of [A, A, code128, A]) expect(c.push(r)).toBeNull();
  });

  it('normalises values before comparing', () => {
    const c = createConsensus();
    c.push(A);
    c.push({ value: '4006 381 333 931', format: 'EAN_13' });
    expect(c.push(A)).toEqual(A);
  });

  it('resets itself after returning a result', () => {
    const c = createConsensus();
    c.push(A);
    c.push(A);
    expect(c.push(A)).toEqual(A);
    expect(c.push(A)).toBeNull();
    expect(c.push(A)).toBeNull();
    expect(c.push(A)).toEqual(A);
  });

  it('reset() clears a partial run', () => {
    const c = createConsensus();
    c.push(A);
    c.push(A);
    c.reset();
    expect(c.push(A)).toBeNull();
    expect(c.push(A)).toBeNull();
    expect(c.push(A)).toEqual(A);
  });

  it('honours a custom required count', () => {
    const c = createConsensus(2);
    expect(c.push(A)).toBeNull();
    expect(c.push(A)).toEqual(A);
  });

  describe('pushFrame', () => {
    it('accepts a code present in 3 frames in a row while another code is also in view', () => {
      const c = createConsensus();
      expect(c.pushFrame([A, B])).toBeNull();
      expect(c.pushFrame([B, A])).toBeNull();
      expect(c.pushFrame([A, B])).toEqual(A); // first key to reach 3, in frame order
    });

    it('accepts after A,B,A,B,A,B pushes delivered as frames holding both codes', () => {
      const c = createConsensus();
      const frames = [[A, B], [A, B], [A, B]];
      const results = frames.map((f) => c.pushFrame(f));
      expect(results.slice(0, 2)).toEqual([null, null]);
      expect([A, B]).toContainEqual(results[2]);
    });

    it('drops a code that is missing from a frame with other valid reads', () => {
      const c = createConsensus();
      expect(c.pushFrame([A, B])).toBeNull();
      expect(c.pushFrame([A])).toBeNull(); // B dropped, A at 2
      expect(c.pushFrame([B])).toBeNull(); // A dropped, B at 1
      expect(c.pushFrame([A])).toBeNull(); // A back at 1
      expect(c.pushFrame([A])).toBeNull();
      expect(c.pushFrame([A])).toEqual(A);
    });

    it('keeps counts through frames with no valid reads', () => {
      const c = createConsensus();
      expect(c.pushFrame([A])).toBeNull();
      expect(c.pushFrame([])).toBeNull();
      expect(c.pushFrame([BAD])).toBeNull();
      expect(c.pushFrame([A])).toBeNull();
      expect(c.pushFrame([A])).toEqual(A);
    });

    it('ignores invalid-checksum reads inside a frame', () => {
      const c = createConsensus();
      for (let i = 0; i < 3; i += 1) expect(c.pushFrame([BAD])).toBeNull();
      expect(c.pushFrame([BAD, A])).toBeNull();
      expect(c.pushFrame([A, BAD])).toBeNull();
      expect(c.pushFrame([BAD, A])).toEqual(A);
    });

    it('counts a code once per frame even if decoded twice in it', () => {
      const c = createConsensus();
      expect(c.pushFrame([A, A, A])).toBeNull();
      expect(c.pushFrame([A])).toBeNull();
      expect(c.pushFrame([A])).toEqual(A);
    });

    it('resets every count after accepting', () => {
      const c = createConsensus();
      c.pushFrame([A, B]);
      c.pushFrame([A, B]);
      expect(c.pushFrame([A, B])).toEqual(A);
      expect(c.pushFrame([B])).toBeNull();
      expect(c.pushFrame([B])).toBeNull();
      expect(c.pushFrame([B])).toEqual(B);
    });

    it('treats undefined or junk entries as no reads', () => {
      const c = createConsensus();
      expect(c.pushFrame(undefined)).toBeNull();
      expect(c.pushFrame([null, { value: 3, format: 'EAN_13' }])).toBeNull();
    });
  });
});
