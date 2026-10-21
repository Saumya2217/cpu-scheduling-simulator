# CPU Scheduling Simulator — SJF, SRTF and Preemptive BJF

Operating Systems Self-Learning Activity, Review 2 — Shah & Anchor Kutchhi Engineering College.

Simulates three CPU scheduling algorithms on the same set of processes and compares them:

| Algorithm | Type | Chooses the process with the lowest… |
|---|---|---|
| SJF | non-preemptive | burst time |
| SRTF | preemptive | remaining time |
| Preemptive BJF [1] | preemptive | fitness f = 0.33·priority + 0.33·arrival + 0.33·burst (min-max normalised, remaining burst for a process that has run) |

[1] K. M. N. B. Alamag and D. R. Tandingan Jr., "Improving CPU scheduling with a preemptive best-job-first algorithm with dynamic fitness computation," IEEE HNICEM 2025, DOI 10.1109/HNICEM69498.2025.11569220.

## Run

**Live demo:** [Open CPU Scheduling Simulator](https://cpu-scheduling-simulator-bay.vercel.app).

**GUI** – open `index.html` in any modern browser (Chrome, Edge, Firefox). No installation, no internet needed.

**Terminal and tests** – need Node.js 18 or newer:

```
node cli.js --sample review1                 # Review 1 example, all three algorithms
node cli.js --sample paperTable1 --algo bjf  # the sample case from paper [1]
node cli.js --file sample_inputs/starvation.csv
node cli.js                                  # type the processes in
node cli.js --help
npm test                                     # run the 36 automated tests
```

## Folder layout

```
index.html, css/style.css   the GUI page
src/validation.js           input checks and error messages
src/csv.js                  reading pid,arrival,burst[,priority] CSV text
src/algorithms.js           SJF, SRTF and preemptive BJF (one shared simulation loop)
src/metrics.js              waiting / turnaround / response time and the other parameters
src/formatting.js           text tables and comparison text (terminal)
src/samples.js              built-in process sets, seeded random generator
src/app.js                  browser-only code: reads the page and draws the results
cli.js                      terminal version (Node.js)
tests/                      node:test test files
sample_inputs/              example CSV files
```

Every file in `src/` except `app.js` works both in the browser (loaded with `<script>`) and in Node.js
(loaded with `require`), so the GUI, the terminal version and the tests all use exactly the same code.

## Input rules

* PID: 1–8 letters, digits, `_` or `-`; unique (not case-sensitive)
* Arrival time: whole number 0–999 ms · Burst time: whole number 1–999 ms
* Priority: whole number 1 (most urgent) to 10; optional, default 1; used by BJF only
* 1 to 10 processes

## Tie-break

Equal burst / remaining time / fitness: the earlier arrival runs first, then the process entered first.
A running process is never preempted by a tie (in [1] only a *better* fitness preempts).
