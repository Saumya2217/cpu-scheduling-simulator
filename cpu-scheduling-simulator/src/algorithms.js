/**
 * The scheduling algorithms.
 *
 *  SJF  - non-preemptive: when the CPU is free, run the ready process with the
 *         smallest BURST time until it finishes.
 *  SRTF - preemptive: the ready process with the smallest REMAINING time runs;
 *         a new arrival with less remaining time takes the CPU.
 *  BJF  - preemptive Best-Job-First with dynamic fitness, exactly as proposed by
 *         Alamag & Tandingan (HNICEM 2025) [1]:
 *           f = 0.33*priority + 0.33*arrival + 0.33*burst          (equation 2 of [1])
 *         where each property is min-max normalised over the process set, the
 *         running process uses its REMAINING burst, and the LOWEST f wins.
 *
 * All three share one simulation loop (simulate). A "policy" object supplies the
 * score that is minimised and whether the algorithm is preemptive.
 *
 * Tie-break (all algorithms, step 7 of [1]): the earlier arrival first, then the
 * process that was entered first. A running process is never preempted by a tie.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else (root.Sched = root.Sched || {}).algorithms = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const EPSILON = 1e-9;             // fitness values are decimals: compare with a tolerance
  const BJF_WEIGHT = 0.33;          // equal weights for the three properties (equation 2 of [1])

  const LABELS = {
    SJF: "SJF (non-preemptive)",
    SRTF: "SRTF (preemptive)",
    BJF: "Preemptive BJF (fitness) [1]",
  };

  // ------------------------------------------------------------------ shared loop
  function simulate(processes, policy) {
    const entryOrder = new Map(processes.map((p, i) => [p.pid, i]));
    const remaining = new Map(processes.map((p) => [p.pid, p.burst]));
    const notArrived = [...processes].sort(
      (a, b) => a.arrival - b.arrival || entryOrder.get(a.pid) - entryOrder.get(b.pid));
    const ready = [];               // arrived and not finished (includes the running process)
    const segments = [];            // Gantt chart blocks { pid, start, end }; pid null = idle
    const firstStart = new Map();   // pid -> first time it got the CPU
    const completion = new Map();   // pid -> completion time
    const events = [];              // { t, text } decision log

    let clock = notArrived.length ? notArrived[0].arrival : 0;   // start at the earliest arrival
    let running = null;

    const score = (p) => policy.score(p, remaining.get(p.pid));
    const describe = (p) => policy.describe(p, remaining.get(p.pid));
    const log = (t, text) => events.push({ t, text });

    /** true if process a should get the CPU before process b */
    function goesBefore(a, b) {
      const difference = score(a) - score(b);
      if (Math.abs(difference) > EPSILON) return difference < 0;
      if (a.arrival !== b.arrival) return a.arrival < b.arrival;
      return entryOrder.get(a.pid) < entryOrder.get(b.pid);
    }
    const pickBest = (list) =>
      list.reduce((best, p) => (best === null || goesBefore(p, best) ? p : best), null);

    function addSegment(pid, start, end) {
      const last = segments[segments.length - 1];
      if (last && last.pid === pid && last.end === start) last.end = end;   // merge with the same process
      else segments.push({ pid, start, end });
    }

    while (notArrived.length || ready.length) {
      // 1. Move every process that has arrived by now into the ready queue
      const arrivedNow = [];
      while (notArrived.length && notArrived[0].arrival <= clock) {
        const p = notArrived.shift();
        ready.push(p);
        arrivedNow.push(p);
        log(p.arrival, `${p.pid} arrives (${policy.describeArrival(p)})`);
      }

      // 2. Nothing to run: the CPU is idle until the next arrival
      if (ready.length === 0) {
        const nextTime = notArrived[0].arrival;
        addSegment(null, clock, nextTime);
        log(clock, `CPU idle until t=${nextTime}`);
        clock = nextTime;
        running = null;
        continue;
      }

      // 3. Decide who gets the CPU now
      let next;
      if (policy.preemptive) {
        next = pickBest(ready);
        if (running && score(running) <= score(next) + EPSILON) next = running;   // a tie never preempts
      } else {
        next = running || pickBest(ready);
      }

      if (next !== running) {
        if (running) {
          log(clock, `${running.pid} preempted (${describe(running)}); `
                   + `${next.pid} is better (${describe(next)})`);
        }
        const verb = firstStart.has(next.pid) ? "resumes" : "starts";
        log(clock, `${next.pid} ${verb} on the CPU (${describe(next)})`);
        if (!firstStart.has(next.pid)) firstStart.set(next.pid, clock);
        running = next;
      } else if (policy.preemptive && arrivedNow.length) {
        // A new process arrived but the running one is still the best: say why
        const challenger = pickBest(arrivedNow.filter((p) => p !== running));
        if (challenger) {
          log(clock, `${running.pid} keeps the CPU (${describe(running)}); `
                   + `${challenger.pid} is not better (${describe(challenger)})`);
        }
      }

      // 4. Run: non-preemptive runs to completion, preemptive advances one time unit and decides again
      const step = policy.preemptive ? 1 : remaining.get(running.pid);
      addSegment(running.pid, clock, clock + step);
      clock += step;
      remaining.set(running.pid, remaining.get(running.pid) - step);

      // 5. Finished?
      if (remaining.get(running.pid) === 0) {
        completion.set(running.pid, clock);
        log(clock, `${running.pid} completes`);
        ready.splice(ready.indexOf(running), 1);
        running = null;
      }
    }

    events.sort((a, b) => a.t - b.t);   // stable sort: same-time events keep their order
    return {
      algorithm: policy.name,
      segments,
      firstStart,
      completion,
      events: events.map((e) => `t=${e.t}: ${e.text}`),
    };
  }

  // ------------------------------------------------------------------ SJF and SRTF
  function runSjf(processes) {
    return simulate(processes, {
      name: "SJF",
      preemptive: false,
      score: (p) => p.burst,
      describe: (p) => `burst ${p.burst} ms`,
      describeArrival: (p) => `burst ${p.burst} ms`,
    });
  }

  function runSrtf(processes) {
    return simulate(processes, {
      name: "SRTF",
      preemptive: true,
      score: (p, remainingTime) => remainingTime,
      describe: (p, remainingTime) => `remaining ${remainingTime} ms`,
      describeArrival: (p) => `burst ${p.burst} ms`,
    });
  }

  // ------------------------------------------------------------------ preemptive BJF [1]
  /** Min-max normalisation; when all values are equal the property cannot separate processes, so 0. */
  function normalise(value, min, max) {
    return max === min ? 0 : (value - min) / (max - min);
  }

  /**
   * Build the fitness function of [1] for one process set.
   * The minimum and maximum of each property are taken from the whole set (all
   * processes are known beforehand, as assumed in [1]). The burst term uses the
   * remaining burst, so a process that has already run gets a better (lower) f.
   */
  function makeFitness(processes, weight = BJF_WEIGHT) {
    const range = (key) => {
      const values = processes.map((p) => p[key]);
      return [Math.min(...values), Math.max(...values)];
    };
    const [arrivalMin, arrivalMax] = range("arrival");
    const [burstMin, burstMax] = range("burst");
    const [priorityMin, priorityMax] = range("priority");

    return function fitness(p, remainingBurst = p.burst) {
      return weight * normalise(p.priority, priorityMin, priorityMax)
           + weight * normalise(p.arrival, arrivalMin, arrivalMax)
           + weight * normalise(remainingBurst, burstMin, burstMax);
    };
  }

  function runBjf(processes) {
    const fitness = makeFitness(processes);
    return simulate(processes, {
      name: "BJF",
      preemptive: true,
      score: (p, remainingBurst) => fitness(p, remainingBurst),
      describe: (p, remainingBurst) => remainingBurst < p.burst
        ? `f = ${fitness(p, remainingBurst).toFixed(3)} with remaining ${remainingBurst} ms`
        : `f = ${fitness(p, remainingBurst).toFixed(3)}`,
      describeArrival: (p) => `burst ${p.burst} ms, priority ${p.priority}, f = ${fitness(p).toFixed(3)}`,
    });
  }

  /** Initial fitness of every process (as listed in Tables I-IV of [1]). */
  function initialFitness(processes) {
    const fitness = makeFitness(processes);
    return new Map(processes.map((p) => [p.pid, fitness(p)]));
  }

  // Name -> function. The CLI and the GUI loop over this, so adding an algorithm is one line.
  const ALGORITHMS = { SJF: runSjf, SRTF: runSrtf, BJF: runBjf };

  return {
    ALGORITHMS, LABELS, BJF_WEIGHT, simulate, runSjf, runSrtf, runBjf, makeFitness, initialFitness, normalise,
  };
});
