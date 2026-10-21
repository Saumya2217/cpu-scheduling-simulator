/**
 * Performance parameters calculated from a finished schedule (all times in ms).
 *
 *   Turnaround time  = Completion time - Arrival time
 *   Waiting time     = Turnaround time - Burst time
 *   Response time    = First CPU time  - Arrival time
 *   Maximum waiting  = the longest waiting time of any process (shows starvation)
 *   CPU utilisation  = busy time / schedule length x 100
 *   Throughput       = processes completed / schedule length
 *   Context switches = number of times the CPU changes from one process to a different one
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else (root.Sched = root.Sched || {}).metrics = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function buildReport(processes, result) {
    const perProcess = processes.map((p) => {
      const completion = result.completion.get(p.pid);
      const turnaround = completion - p.arrival;
      return {
        pid: p.pid,
        arrival: p.arrival,
        burst: p.burst,
        priority: p.priority,
        completion,
        turnaround,
        waiting: turnaround - p.burst,
        response: result.firstStart.get(p.pid) - p.arrival,
      };
    });

    const n = perProcess.length;
    const average = (key) => perProcess.reduce((sum, r) => sum + r[key], 0) / n;
    const lastCompletion = Math.max(...perProcess.map((r) => r.completion));
    const firstArrival = Math.min(...perProcess.map((r) => r.arrival));
    const scheduleLength = lastCompletion - firstArrival;
    const busyTime = result.segments
      .filter((s) => s.pid !== null)
      .reduce((sum, s) => sum + (s.end - s.start), 0);

    // Context switch = the CPU moves from one process to a different one (idle gaps are ignored)
    const runOrder = result.segments.filter((s) => s.pid !== null).map((s) => s.pid);
    let contextSwitches = 0;
    for (let i = 1; i < runOrder.length; i += 1) if (runOrder[i] !== runOrder[i - 1]) contextSwitches += 1;

    return {
      algorithm: result.algorithm,
      segments: result.segments,
      events: result.events,
      perProcess,
      avgWaiting: average("waiting"),
      avgTurnaround: average("turnaround"),
      avgResponse: average("response"),
      maxWaiting: Math.max(...perProcess.map((r) => r.waiting)),
      cpuUtilisation: (100 * busyTime) / scheduleLength,
      throughput: n / scheduleLength,
      contextSwitches,
      scheduleLength,
    };
  }

  /** Rows for comparison tables: [label, key, lowerIsBetter, decimals] */
  const COMPARISON_ROWS = [
    ["Average waiting time (ms)", "avgWaiting", true, 2],
    ["Average turnaround time (ms)", "avgTurnaround", true, 2],
    ["Average response time (ms)", "avgResponse", true, 2],
    ["Maximum waiting time (ms)", "maxWaiting", true, 0],
    ["CPU utilisation (%)", "cpuUtilisation", false, 1],
    ["Throughput (processes/ms)", "throughput", false, 3],
    ["Context switches", "contextSwitches", true, 0],
  ];

  /** Names of the algorithm(s) with the best value for one parameter, or "same" if all equal. */
  function bestOf(reports, key, lowerIsBetter) {
    const values = reports.map((r) => r[key]);
    const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
    if (values.every((v) => Math.abs(v - best) < 1e-9)) return "same";
    return reports.filter((r) => Math.abs(r[key] - best) < 1e-9).map((r) => r.algorithm).join(", ");
  }

  return { buildReport, COMPARISON_ROWS, bestOf };
});
