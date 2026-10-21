/**
 * Reading a process list from CSV text: pid,arrival,burst[,priority]
 * The same function is used by the browser (file picker) and by Node (cli.js).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./validation.js"));
  else (root.Sched = root.Sched || {}).csv = factory(root.Sched.validation);
})(typeof self !== "undefined" ? self : this, function (validation) {
  "use strict";
  const { InputError, validateProcesses } = validation;
  const HEADER_NAMES = ["pid", "process", "id", "name"];

  function parseCsvText(text) {
    const rows = String(text ?? "")
      .replace(/^﻿/, "")                       // remove a byte-order mark if present
      .split(/\r?\n/)
      .map((line) => line.split(",").map((cell) => cell.trim()))
      .filter((cells) => cells.some((cell) => cell !== ""));   // skip blank lines

    // An optional header line such as "pid,arrival,burst,priority"
    if (rows.length && HEADER_NAMES.includes(rows[0][0].toLowerCase())) rows.shift();
    if (rows.length === 0) throw new InputError("The file contains no processes.");
    return validateProcesses(rows);
  }

  return { parseCsvText };
});
