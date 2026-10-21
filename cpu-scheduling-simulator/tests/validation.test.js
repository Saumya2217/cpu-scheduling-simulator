/** Input-handling tests (T6): invalid input is rejected with a clear message, never a crash. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  InputError, MAX_PROCESSES, parseArrival, parseBurst, parsePid, parsePriority, validateProcesses,
} = require("../src/validation.js");
const { parseCsvText } = require("../src/csv.js");

test("valid single values are accepted (and trimmed)", () => {
  assert.equal(parseArrival(" 0 "), 0);
  assert.equal(parseBurst("7"), 7);
  assert.equal(parsePid(" P1 "), "P1");
  assert.equal(parsePriority("3"), 3);
  assert.equal(parsePriority(""), 1);   // blank priority = default
});

test("negative arrival time is rejected", () => assert.throws(() => parseArrival("-1"), InputError));

test("burst time of 0 or less is rejected", () => {
  for (const bad of ["0", "-3"]) assert.throws(() => parseBurst(bad), InputError);
});

test("non-whole numbers are rejected", () => {
  for (const bad of ["", "  ", "abc", "2.5", "1_0", "1e3"]) assert.throws(() => parseBurst(bad), InputError, bad);
});

test("values above the maximum are rejected", () => assert.throws(() => parseBurst("100000"), InputError));

test("priority outside 1-10 is rejected", () => {
  for (const bad of ["0", "11", "x"]) assert.throws(() => parsePriority(bad), InputError, bad);
});

test("PID rules: not empty, no spaces, short, unique ignoring case", () => {
  assert.throws(() => parsePid(""), InputError);
  assert.throws(() => parsePid("P 1"), InputError);
  assert.throws(() => parsePid("VERYLONGPROCESSNAME"), InputError);
  assert.throws(() => parsePid("p1", ["P1"]), InputError);
});

test("a valid table becomes process objects", () => {
  const procs = validateProcesses([["P1", "0", "7"], ["P2", "1", "4", "3"]]);
  assert.deepEqual(procs, [{ pid: "P1", arrival: 0, burst: 7, priority: 1 }, { pid: "P2", arrival: 1, burst: 4, priority: 3 }]);
});

test("an empty table is rejected", () => assert.throws(() => validateProcesses([]), InputError));

test("more than the maximum number of processes is rejected", () => {
  const rows = Array.from({ length: MAX_PROCESSES + 1 }, (_, i) => [`P${i}`, "0", "1"]);
  assert.throws(() => validateProcesses(rows), InputError);
});

test("the error message names the row", () => {
  assert.throws(() => validateProcesses([["P1", "0", "7"], ["P2", "-1", "4"]]), /Row 2/);
});

test("duplicate PIDs are rejected", () => {
  assert.throws(() => validateProcesses([["P1", "0", "7"], ["P1", "1", "4"]]), InputError);
});

test("CSV with a header, with and without priority", () => {
  assert.equal(parseCsvText("pid,arrival,burst\nP1,0,7\nP2,1,4\n").length, 2);
  assert.equal(parseCsvText("pid,arrival,burst,priority\nP1,0,7,2\n")[0].priority, 2);
});

test("CSV without header, with blank lines and Windows line endings", () => {
  assert.equal(parseCsvText("P1,0,7\r\n\r\nP2,1,4\r\n").length, 2);
});

test("an empty CSV is rejected", () => assert.throws(() => parseCsvText(""), InputError));

test("a CSV row with the wrong number of columns is rejected", () => {
  assert.throws(() => parseCsvText("P1,0\n"), InputError);
});

test("a CSV row with a bad value is rejected", () => assert.throws(() => parseCsvText("P1,0,seven\n"), InputError));
