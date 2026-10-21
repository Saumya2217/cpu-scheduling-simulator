/**
 * Input validation.
 * Every check throws an InputError whose message is written for the user, so the
 * terminal version and the browser GUI can show it as it is.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else (root.Sched = root.Sched || {}).validation = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MAX_PROCESSES = 10;     // keeps the Gantt chart and the tables readable
  const MAX_PID_LENGTH = 8;
  const MAX_TIME_VALUE = 999;   // upper limit for arrival and burst time (ms)
  const MIN_PRIORITY = 1;       // 1 = most urgent (the BJF fitness is minimised)
  const MAX_PRIORITY = 10;
  const DEFAULT_PRIORITY = 1;   // used when no priority is given (SJF/SRTF ignore it)

  const WHOLE_NUMBER = /^[+-]?[0-9]+$/;
  const PID_CHARS = /^[A-Za-z0-9_-]+$/;

  class InputError extends Error {
    constructor(message) {
      super(message);
      this.name = "InputError";
    }
  }

  /** Convert text such as " 7 " to 7. Rejects blanks, decimals, words and "1e3". */
  function parseWholeNumber(text, fieldName) {
    const value = String(text ?? "").trim();
    if (value === "") throw new InputError(`${fieldName} is empty. Enter a whole number.`);
    if (!WHOLE_NUMBER.test(value)) throw new InputError(`${fieldName} must be a whole number (got '${value}').`);
    return Number.parseInt(value, 10);
  }

  function parseArrival(text) {
    const value = parseWholeNumber(text, "Arrival time");
    if (value < 0) throw new InputError("Arrival time cannot be negative (use 0 or more).");
    if (value > MAX_TIME_VALUE) throw new InputError(`Arrival time is too large (maximum ${MAX_TIME_VALUE}).`);
    return value;
  }

  function parseBurst(text) {
    const value = parseWholeNumber(text, "Burst time");
    if (value < 1) throw new InputError("Burst time must be at least 1 (a process needs some CPU time).");
    if (value > MAX_TIME_VALUE) throw new InputError(`Burst time is too large (maximum ${MAX_TIME_VALUE}).`);
    return value;
  }

  /** Priority is only used by the BJF algorithm. Blank means the default (1). */
  function parsePriority(text) {
    if (String(text ?? "").trim() === "") return DEFAULT_PRIORITY;
    const value = parseWholeNumber(text, "Priority");
    if (value < MIN_PRIORITY || value > MAX_PRIORITY) {
      throw new InputError(`Priority must be from ${MIN_PRIORITY} (most urgent) to ${MAX_PRIORITY}.`);
    }
    return value;
  }

  /** A process name: non-empty, short, simple characters, not already used (case-insensitive). */
  function parsePid(text, existingPids = []) {
    const pid = String(text ?? "").trim();
    if (pid === "") throw new InputError("PID is empty. Give the process a name such as P1.");
    if (pid.length > MAX_PID_LENGTH) throw new InputError(`PID '${pid}' is too long (maximum ${MAX_PID_LENGTH} characters).`);
    if (!PID_CHARS.test(pid)) throw new InputError("PID may contain only letters, digits, '_' and '-'.");
    if (existingPids.some((p) => p.toLowerCase() === pid.toLowerCase())) {
      throw new InputError(`PID '${pid}' already exists. PIDs must be unique.`);
    }
    return pid;
  }

  /**
   * Validate a whole table of rows: [pid, arrival, burst] or [pid, arrival, burst, priority].
   * Returns process objects { pid, arrival, burst, priority }.
   * The first problem found is reported with its row number.
   */
  function validateProcesses(rows) {
    if (!rows || rows.length === 0) throw new InputError("Add at least one process before running the simulation.");
    if (rows.length > MAX_PROCESSES) {
      throw new InputError(`Too many processes (${rows.length}). The maximum is ${MAX_PROCESSES}.`);
    }
    const processes = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 1;
      if (row.length !== 3 && row.length !== 4) {
        throw new InputError(`Row ${rowNumber}: expected PID, arrival time, burst time and (optionally) priority.`);
      }
      try {
        processes.push({
          pid: parsePid(row[0], processes.map((p) => p.pid)),
          arrival: parseArrival(row[1]),
          burst: parseBurst(row[2]),
          priority: parsePriority(row.length === 4 ? row[3] : ""),
        });
      } catch (error) {
        if (error instanceof InputError) throw new InputError(`Row ${rowNumber}: ${error.message}`);
        throw error;
      }
    });
    return processes;
  }

  return {
    MAX_PROCESSES, MAX_PID_LENGTH, MAX_TIME_VALUE, MIN_PRIORITY, MAX_PRIORITY, DEFAULT_PRIORITY,
    InputError, parseWholeNumber, parseArrival, parseBurst, parsePriority, parsePid, validateProcesses,
  };
});
