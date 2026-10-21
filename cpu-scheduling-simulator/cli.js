#!/usr/bin/env node
/**
 * Terminal version of the simulator.
 *
 *   node cli.js --sample review1                  run a built-in sample (see --help)
 *   node cli.js --file sample_inputs/paper_table1.csv --algo bjf
 *   node cli.js                                   type the processes in
 */
"use strict";
const fs = require("fs");
const readline = require("readline");
const { ALGORITHMS } = require("./src/algorithms.js");
const { buildReport } = require("./src/metrics.js");
const { fullText, comparisonText, observationText } = require("./src/formatting.js");
const { parseCsvText } = require("./src/csv.js");
const { SAMPLES } = require("./src/samples.js");
const {
  InputError, MAX_PROCESSES, parseWholeNumber, parsePid, parseArrival, parseBurst, parsePriority, validateProcesses,
} = require("./src/validation.js");

const HELP = `Usage: node cli.js [--sample NAME | --file FILE.csv] [--algo sjf|srtf|bjf|all] [--no-log]
Samples: ${Object.keys(SAMPLES).join(", ")}
CSV columns: pid,arrival,burst[,priority]   (priority 1-10, only used by BJF; default 1)`;

function parseArgs(argv) {
  const args = { algo: "all", log: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--no-log") args.log = false;
    else if (a === "--sample") args.sample = argv[++i];
    else if (a === "--file") args.file = argv[++i];
    else if (a === "--algo") args.algo = String(argv[++i] || "").toLowerCase();
    else throw new InputError(`Unknown option '${a}'. Use --help to see the options.`);
  }
  if (!["sjf", "srtf", "bjf", "all"].includes(args.algo)) throw new InputError("--algo must be sjf, srtf, bjf or all.");
  if (args.sample !== undefined && !SAMPLES[args.sample]) throw new InputError(`Unknown sample '${args.sample}'.`);
  return args;
}

/** Read processes from the keyboard; every answer is re-asked until it is valid. */
async function readInteractively() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  async function ask(prompt, parser) {
    for (;;) {
      process.stdout.write(prompt);
      const { value, done } = await lines.next();
      if (done) throw new InputError("Input ended before all processes were entered.");
      try {
        return parser(value);
      } catch (error) {
        if (!(error instanceof InputError)) throw error;
        console.log(`  Invalid input: ${error.message}`);
      }
    }
  }
  try {
    const count = await ask(`Number of processes (1-${MAX_PROCESSES}): `, (t) => {
      const n = parseWholeNumber(t, "Number of processes");
      if (n < 1 || n > MAX_PROCESSES) throw new InputError(`Enter a number from 1 to ${MAX_PROCESSES}.`);
      return n;
    });
    const processes = [];
    for (let i = 1; i <= count; i += 1) {
      console.log(`Process ${i}:`);
      const pid = await ask("  PID: ", (t) => parsePid(t, processes.map((p) => p.pid)));
      const arrival = await ask("  Arrival time (ms): ", parseArrival);
      const burst = await ask("  Burst time (ms): ", parseBurst);
      const priority = await ask("  Priority 1-10 (Enter = 1, used by BJF only): ", parsePriority);
      processes.push({ pid, arrival, burst, priority });
    }
    return processes;
  } finally {
    rl.close();
  }
}

function loadFile(path) {
  let text;
  try {
    text = fs.readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") throw new InputError(`File not found: ${path}`);
    throw new InputError(`Cannot read '${path}'. Check the path and permissions.`);
  }
  return parseCsvText(text);
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { console.log(HELP); return 0; }

    let processes;
    if (args.sample) processes = SAMPLES[args.sample].processes;
    else if (args.file) processes = loadFile(args.file);
    else processes = await readInteractively();
    processes = validateProcesses(processes.map((p) => [p.pid, p.arrival, p.burst, p.priority]));

    const names = args.algo === "all" ? Object.keys(ALGORITHMS) : [args.algo.toUpperCase()];
    const reports = names.map((name) => buildReport(processes, ALGORITHMS[name](processes)));
    for (const report of reports) console.log(`${fullText(report, args.log)}\n`);
    if (reports.length > 1) {
      console.log("=== Comparison ===");
      console.log(comparisonText(reports));
      console.log(`\n${observationText(reports)}`);
    }
    return 0;
  } catch (error) {
    if (error instanceof InputError) { console.log(`Input error: ${error.message}`); return 1; }
    throw error;
  }
}

main().then((code) => { process.exitCode = code; });
