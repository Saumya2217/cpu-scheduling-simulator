/** Turns reports into plain text: used by the terminal version (cli.js). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./algorithms.js"), require("./metrics.js"));
  else (root.Sched = root.Sched || {}).formatting = factory(root.Sched.algorithms, root.Sched.metrics);
})(typeof self !== "undefined" ? self : this, function (algorithms, metrics) {
  "use strict";
  const { LABELS } = algorithms;
  const { COMPARISON_ROWS, bestOf } = metrics;

  /** Two-line text Gantt chart: process boxes, then the time marks underneath. */
  function ganttText(report) {
    let bar = "|";
    let marks = "";
    for (const seg of report.segments) {
      const cell = ` ${seg.pid ?? "idle"} `;
      marks += String(seg.start).padEnd(cell.length + 1);
      bar += `${cell}|`;
    }
    marks += String(report.segments[report.segments.length - 1].end);
    return `${bar}\n${marks}`;
  }

  function tableText(report) {
    const header = "PID".padEnd(6) + ["Arrival", "Burst", "Prio", "Compl.", "TAT", "WT", "RT"].map((h, i) => h.padStart(i === 0 ? 8 : 7)).join("");
    const line = "-".repeat(header.length);
    const rows = report.perProcess.map((r) => r.pid.padEnd(6)
      + [r.arrival, r.burst, r.priority, r.completion, r.turnaround, r.waiting, r.response]
        .map((v, i) => String(v).padStart(i === 0 ? 8 : 7)).join(""));
    const avg = "Avg".padEnd(6) + "".padStart(8) + "".padStart(7 * 3)
      + [report.avgTurnaround, report.avgWaiting, report.avgResponse].map((v) => v.toFixed(2).padStart(7)).join("");
    return [header, line, ...rows, line, avg].join("\n");
  }

  function summaryText(report) {
    return [
      `Average waiting time    : ${report.avgWaiting.toFixed(2)} ms`,
      `Average turnaround time : ${report.avgTurnaround.toFixed(2)} ms`,
      `Average response time   : ${report.avgResponse.toFixed(2)} ms`,
      `Maximum waiting time    : ${report.maxWaiting} ms`,
      `CPU utilisation         : ${report.cpuUtilisation.toFixed(1)} %`,
      `Throughput              : ${report.throughput.toFixed(3)} processes/ms`,
      `Context switches        : ${report.contextSwitches}`,
    ].join("\n");
  }

  function fullText(report, withEvents = true) {
    const parts = [`=== ${LABELS[report.algorithm]} ===`, "Gantt chart:", ganttText(report), "",
      tableText(report), "", summaryText(report)];
    if (withEvents) parts.push("", "Execution log:", ...report.events.map((e) => `  ${e}`));
    return parts.join("\n");
  }

  /** Side-by-side table of every performance parameter, best algorithm marked. */
  function comparisonText(reports) {
    const names = reports.map((r) => r.algorithm);
    const head = "Parameter".padEnd(30) + names.map((n) => n.padStart(9)).join("") + "   Best";
    const lines = [head, "-".repeat(head.length + 6)];
    for (const [label, key, lowerIsBetter, decimals] of COMPARISON_ROWS) {
      lines.push(label.padEnd(30) + reports.map((r) => r[key].toFixed(decimals).padStart(9)).join("")
        + `   ${bestOf(reports, key, lowerIsBetter)}`);
    }
    return lines.join("\n");
  }

  /** A few plain sentences explaining the comparison (also shown in the GUI). */
  function observationText(reports) {
    const byName = Object.fromEntries(reports.map((r) => [r.algorithm, r]));
    const sentences = [];
    const lowestWait = [...reports].sort((a, b) => a.avgWaiting - b.avgWaiting)[0];
    if (reports.every((r) => Math.abs(r.avgWaiting - lowestWait.avgWaiting) < 1e-9)) {
      sentences.push(`All algorithms give the same average waiting time (${lowestWait.avgWaiting.toFixed(2)} ms).`);
    } else {
      sentences.push(`${lowestWait.algorithm} has the lowest average waiting time (${lowestWait.avgWaiting.toFixed(2)} ms).`);
    }
    const namesWith = (key, value) => reports.filter((r) => r[key] === value).map((r) => r.algorithm).join(" and ");
    const lowestMax = Math.min(...reports.map((r) => r.maxWaiting));
    if (!reports.every((r) => r.maxWaiting === lowestMax)) {
      sentences.push(`${namesWith("maxWaiting", lowestMax)} keep${namesWith("maxWaiting", lowestMax).includes(" and ") ? "" : "s"} the longest wait of any single process lowest (${lowestMax} ms).`);
    }
    const fewest = Math.min(...reports.map((r) => r.contextSwitches));
    if (!reports.every((r) => r.contextSwitches === fewest)) {
      sentences.push(`${namesWith("contextSwitches", fewest)} make${namesWith("contextSwitches", fewest).includes(" and ") ? "" : "s"} the fewest context switches (${fewest}).`);
    }
    if (byName.SRTF && byName.BJF && byName.BJF.maxWaiting < byName.SRTF.maxWaiting) {
      sentences.push(`BJF reduces the longest wait compared with SRTF (${byName.BJF.maxWaiting} ms vs ${byName.SRTF.maxWaiting} ms), which is the starvation benefit claimed in [1].`);
    }
    return sentences.join(" ");
  }

  return { ganttText, tableText, summaryText, fullText, comparisonText, observationText };
});
