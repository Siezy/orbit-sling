// A small seeded random generator (mulberry32), so a level built from a seed
// is the same level every time: screenshots and replays are reproducible,
// and ?seed=N on the URL picks a different universe to fly in.

export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    /** Next float in [0, 1). */
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Float in [min, max). */
    range(min, max) {
      return min + (max - min) * this.next();
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    /** One element of an array. */
    pick(array) {
      return array[Math.floor(this.next() * array.length)];
    },
  };
}
