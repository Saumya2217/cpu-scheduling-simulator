/** Algorithm tests: Review 1 worked example, edge cases, the paper [1] and random checks. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ALGORITHMS, initialFitness } = require("../src/algorithms.js");
const { buildReport } = require("../src/metrics.js");
const { SAMPLES, randomProcesses } = require("../src/samples.js");

const proc = (pid, arrival, burst, priority = 1) => ({ pid, arrival, burst, priority });
const run = (name, processes) => buildReport(processes, ALGORITHMS[name](processes));
const gantt = (report) => report.segments.map((s) => [s.pid, s.start, s.end]);
const review1 = SAMPLES.review1.processes;

// ---------------------------------------------------------------- Review 1 worked example (T1, T2)
test("T1: SJF on the Review 1 example matches the hand calculation", () => {
  const r = run("SJF", review1);
  assert.deepEqual(gantt(r), [["P1", 0, 7], ["P3", 7, 8], ["P2", 8, 12], ["P4", 12, 16]]);
  assert.equal(r.avgWaiting, 5.25);
  assert.equal(r.avgTurnaround, 9.25);
  assert.equal(r.avgResponse, 5.25);
  assert.equal(r.contextSwitches, 3);
});

test("T2: SRTF on the Review 1 example matches the hand calculation", () => {
  const r = run("SRTF", review1);
  assert.deepEqual(gantt(r), [["P1", 0, 1], ["P2", 1, 2], ["P3", 2, 3], ["P2", 3, 6], ["P4", 6, 10], ["P1", 10, 16]]);
  assert.equal(r.avgWaiting, 3.25);
  assert.equal(r.avgTurnaround, 7.25);
  assert.equal(r.avgResponse, 0.75);
  assert.equal(r.contextSwitches, 5);
});

test("SRTF per-process values on the Review 1 example", () => {
  const byPid = Object.fromEntries(run("SRTF", review1).perProcess.map((m) => [m.pid, m]));
  assert.deepEqual([byPid.P1.completion, byPid.P1.waiting], [16, 9]);
  assert.deepEqual([byPid.P3.completion, byPid.P3.waiting], [3, 0]);
});

// ---------------------------------------------------------------- edge cases (T3-T5 and more)
test("T3: idle gap is shown and counted in CPU utilisation", () => {
  const procs = [proc("P1", 0, 2), proc("P2", 5, 3)];
  for (const name of Object.keys(ALGORITHMS)) {
    const r = run(name, procs);
    assert.deepEqual(gantt(r), [["P1", 0, 2], [null, 2, 5], ["P2", 5, 8]]);
    assert.equal(r.cpuUtilisation, 62.5);
  }
});

test("T4: equal bursts - the earlier arrival runs first", () => {
  const r = run("SJF", [proc("P1", 0, 5), proc("P2", 1, 4), proc("P3", 2, 4)]);
  assert.deepEqual(r.segments.map((s) => s.pid), ["P1", "P2", "P3"]);
});

test("T5: a single process never waits", () => {
  for (const name of Object.keys(ALGORITHMS)) {
    const r = run(name, [proc("P1", 3, 4)]);
    const m = r.perProcess[0];
    assert.deepEqual([m.waiting, m.response, m.turnaround, r.contextSwitches], [0, 0, 4, 0]);
  }
});

test("all processes arrive together: SJF and SRTF give the same schedule", () => {
  const procs = [proc("A", 0, 6), proc("B", 0, 2), proc("C", 0, 4)];
  assert.deepEqual(gantt(run("SJF", procs)), gantt(run("SRTF", procs)));
  assert.deepEqual(gantt(run("SJF", procs)), [["B", 0, 2], ["C", 2, 6], ["A", 6, 12]]);
});

test("SRTF: a tie in remaining time does not preempt", () => {
  assert.deepEqual(gantt(run("SRTF", [proc("P1", 0, 4), proc("P2", 1, 3)])), [["P1", 0, 4], ["P2", 4, 7]]);
});

test("the clock starts at the first arrival, not at 0", () => {
  const r = run("SRTF", [proc("P1", 4, 3)]);
  assert.deepEqual(gantt(r), [["P1", 4, 7]]);
  assert.equal(r.cpuUtilisation, 100);
});

test("the order in which rows are entered does not change the schedule", () => {
  const shuffled = [review1[2], review1[0], review1[3], review1[1]];
  for (const name of Object.keys(ALGORITHMS)) assert.deepEqual(gantt(run(name, shuffled)), gantt(run(name, review1)));
});

test("every process gets exactly its burst time, and WT = TAT - BT", () => {
  for (const name of Object.keys(ALGORITHMS)) {
    const r = run(name, review1);
    for (const m of r.perProcess) {
      const ran = r.segments.filter((s) => s.pid === m.pid).reduce((t, s) => t + s.end - s.start, 0);
      assert.equal(ran, m.burst);
      assert.equal(m.waiting, m.turnaround - m.burst);
    }
  }
});

// ---------------------------------------------------------------- preemptive BJF, checked against paper [1]
test("BJF: fitness values match Tables I-IV of [1] (20 values)", () => {
  const expected = {
    paperTable1: [0.660, 0.357, 0.292, 0.348, 0.330],
    paperTC1: [0.055, 0.873, 0.658, 0.405, 0.829],
    paperTC2: [0.330, 0.194, 0.293, 0.979, 0.722],
    paperTC3: [0.650, 0.122, 0.439, 0.647, 0.943],
  };
  for (const [key, values] of Object.entries(expected)) {
    const fitness = [...initialFitness(SAMPLES[key].processes).values()].map((f) => Number(f.toFixed(3)));
    assert.deepEqual(fitness, values, key);
  }
});

test("BJF: Table I sample case follows the order described in [1]", () => {
  const r = run("BJF", SAMPLES.paperTable1.processes);
  // [1] reports P1 finishing at 175; P1 actually has 81 ms left at t=20 (100 - 19), so it finishes at 176.
  assert.deepEqual(gantt(r), [["P1", 1, 20], ["P2", 20, 31], ["P3", 31, 48], ["P2", 48, 77],
    ["P5", 77, 83], ["P4", 83, 95], ["P1", 95, 176]]);
});

test("BJF: test case 1 reproduces Tables V and VI of [1] (WT 23, TAT 49.2)", () => {
  const r = run("BJF", SAMPLES.paperTC1.processes);
  assert.equal(Number(r.avgWaiting.toFixed(2)), 23);
  assert.equal(Number(r.avgTurnaround.toFixed(2)), 49.2);
});

test("SRTF ('preemptive SJF' in [1]) reproduces the turnaround times of Table VI", () => {
  const expected = { paperTC1: 47, paperTC2: 158, paperTC3: 109 };
  for (const [key, tat] of Object.entries(expected)) {
    assert.equal(Number(run("SRTF", SAMPLES[key].processes).avgTurnaround.toFixed(2)), tat, key);
  }
});

test("BJF: equal priorities do not break the fitness (no division by zero)", () => {
  const fitness = [...initialFitness(review1).values()];
  assert.ok(fitness.every(Number.isFinite));
});

test("BJF: equal fitness - the earlier arrival runs first", () => {
  // Same arrival, burst and priority for B and C: only the arrival/entry order separates them
  const r = run("BJF", [proc("A", 0, 2, 1), proc("B", 1, 3, 2), proc("C", 1, 3, 2)]);
  assert.deepEqual(r.segments.map((s) => s.pid), ["A", "B", "C"]);
});

test("BJF: the long job waits less than under SRTF in the starvation case", () => {
  const procs = SAMPLES.starvation.processes;
  const waitOfP1 = (name) => run(name, procs).perProcess.find((m) => m.pid === "P1").waiting;
  assert.equal(waitOfP1("SRTF"), 15);
  assert.equal(waitOfP1("BJF"), 9);
});

// ---------------------------------------------------------------- random checks
test("300 random process sets: general rules hold for every algorithm", () => {
  for (let seed = 0; seed < 300; seed += 1) {
    const procs = randomProcesses(1 + (seed % 10), seed);
    const reports = Object.keys(ALGORITHMS).map((name) => run(name, procs));
    for (const r of reports) {
      for (const m of r.perProcess) {
        assert.ok(m.waiting >= 0 && m.turnaround >= m.burst);
        const ran = r.segments.filter((s) => s.pid === m.pid).reduce((t, s) => t + s.end - s.start, 0);
        assert.equal(ran, m.burst);
      }
    }
    // SRTF is optimal for average waiting time, so no algorithm may beat it
    const [sjf, srtf, bjf] = reports;
    assert.ok(srtf.avgWaiting <= sjf.avgWaiting + 1e-9 && srtf.avgWaiting <= bjf.avgWaiting + 1e-9, `seed ${seed}`);
  }
});
