/** Ready-made process sets (GUI "Load sample" menu and CLI flags) and a seeded random generator. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else (root.Sched = root.Sched || {}).samples = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const make = (rows) => rows.map(([pid, arrival, burst, priority]) => ({ pid, arrival, burst, priority }));

  const SAMPLES = {
    review1: {
      label: "Review 1 example (P1–P4)",
      processes: make([["P1", 0, 7, 1], ["P2", 1, 4, 1], ["P3", 2, 1, 1], ["P4", 3, 4, 1]]),
    },
    paperTable1: {
      label: "Paper [1] Table I",
      processes: make([["P1", 1, 100, 10], ["P2", 20, 40, 5], ["P3", 31, 17, 4], ["P4", 54, 12, 3], ["P5", 70, 6, 1]]),
    },
    paperTC1: {
      label: "Paper [1] test case 1",
      processes: make([["P1", 1, 9, 3], ["P2", 54, 56, 8], ["P3", 79, 11, 8], ["P4", 79, 22, 2], ["P5", 83, 33, 8]]),
    },
    paperTC2: {
      label: "Paper [1] test case 2",
      processes: make([["P1", 1, 95, 1], ["P2", 36, 58, 1], ["P3", 80, 49, 1], ["P4", 89, 94, 4], ["P5", 90, 73, 3]]),
    },
    paperTC3: {
      label: "Paper [1] test case 3",
      processes: make([["P1", 1, 88, 8], ["P2", 14, 28, 2], ["P3", 85, 22, 4], ["P4", 93, 88, 1], ["P5", 94, 90, 7]]),
    },
    starvation: {
      label: "Starvation case",
      processes: make([["P1", 0, 12, 1], ["P2", 2, 3, 1], ["P3", 4, 3, 1], ["P4", 6, 3, 1], ["P5", 8, 3, 1], ["P6", 10, 3, 1]]),
    },
    idleGap: {
      label: "Idle gap",
      processes: make([["P1", 0, 2, 1], ["P2", 5, 3, 1]]),
    },
  };

  /** Small seeded generator (mulberry32) so tests are repeatable. */
  function seededRandom(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** count processes: arrival 0-8 ms, burst 1-8 ms, priority 1-10. */
  function randomProcesses(count = 5, seed) {
    const random = seed === undefined ? Math.random : seededRandom(seed);
    const between = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
    return Array.from({ length: count }, (_, i) => ({
      pid: `P${i + 1}`, arrival: between(0, 8), burst: between(1, 8), priority: between(1, 10),
    }));
  }

  return { SAMPLES, randomProcesses };
});
