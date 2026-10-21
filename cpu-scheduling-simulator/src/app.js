/**
 * Browser GUI. This file only reads the page and draws results: all scheduling
 * logic comes from the shared modules (window.Sched.*), the same code the
 * terminal version and the tests use.
 *
 * The page follows the five steps asked for in the SLA:
 *   1. Enter the processes        2. Select the algorithm      3. Execute
 *   4. View the execution/results (Execution and Event log tabs)
 *   5. Compare the algorithms     (Compare tab)
 */
(function () {
  "use strict";
  const { validation, csv, algorithms, metrics, formatting, samples } = window.Sched;
  const { InputError, MAX_PROCESSES } = validation;
  const { ALGORITHMS, LABELS, initialFitness } = algorithms;

  const COLOURS = ["#7fb7d6", "#f2b880", "#b7a3d9", "#9bd1a5", "#f0a3a3",
                   "#f4db7d", "#8fd3cf", "#d6a5c9", "#b9c77e", "#c4b59b"];
  const SERIES_COLOURS = { SJF: "#8a9ba3", SRTF: "#1f4e5f", BJF: "#d08a3c" };

  const $ = (id) => document.getElementById(id);
  const state = { rows: [], selected: -1, reports: null, colours: {} };

  // ------------------------------------------------------------------ status bar
  function setStatus(message, kind = "") {
    const bar = $("status");
    bar.textContent = message;
    bar.className = `status ${kind}`;
  }

  /** Report an InputError to the user; anything else is a real bug and is re-thrown. */
  function handle(error, prefix) {
    if (error instanceof InputError) setStatus(`${prefix}: ${error.message}`, "error");
    else throw error;
  }

  // ------------------------------------------------------------------ step 1: input
  function suggestNextPid() {
    let n = 1;
    while (state.rows.some((r) => r.pid.toLowerCase() === `p${n}`)) n += 1;
    $("in-pid").value = `P${n}`;
  }

  function renderInputTable() {
    const body = $("process-rows");
    body.innerHTML = "";
    state.rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      if (i === state.selected) tr.className = "selected";
      tr.innerHTML = `<td>${r.pid}</td><td>${r.arrival}</td><td>${r.burst}</td><td>${r.priority}</td>`;
      tr.addEventListener("click", () => { state.selected = i === state.selected ? -1 : i; renderInputTable(); });
      body.appendChild(tr);
    });
  }

  function setRows(processes, message) {
    state.rows = processes.map((p) => ({ ...p }));
    state.selected = -1;
    renderInputTable();
    suggestNextPid();
    setStatus(message, "ok");
  }

  function addProcess(event) {
    event.preventDefault();
    try {
      if (state.rows.length >= MAX_PROCESSES) throw new InputError(`The maximum is ${MAX_PROCESSES} processes.`);
      const process = {
        pid: validation.parsePid($("in-pid").value, state.rows.map((r) => r.pid)),
        arrival: validation.parseArrival($("in-arrival").value),
        burst: validation.parseBurst($("in-burst").value),
        priority: validation.parsePriority($("in-priority").value),
      };
      state.rows.push(process);
      renderInputTable();
      $("in-arrival").value = "";
      $("in-burst").value = "";
      $("in-priority").value = "1";
      suggestNextPid();
      $("in-arrival").focus();
      setStatus(`Added ${process.pid}. ${state.rows.length} process(es) in the table.`, "ok");
    } catch (error) {
      handle(error, "Cannot add process");
    }
  }

  function removeSelected() {
    if (state.selected < 0) { setStatus("Click a row in the table first, then press Remove.", "error"); return; }
    const [removed] = state.rows.splice(state.selected, 1);
    state.selected = -1;
    renderInputTable();
    suggestNextPid();
    setStatus(`Removed ${removed.pid}.`);
  }

  function loadCsvFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setRows(csv.parseCsvText(reader.result), `Loaded ${file.name}.`);
      } catch (error) {
        handle(error, `Cannot open ${file.name}`);
      }
      event.target.value = "";   // allow the same file to be chosen again
    };
    reader.readAsText(file);
  }

  // ------------------------------------------------------------------ steps 2-3: run
  const chosenAlgorithm = () => document.querySelector('input[name="algo"]:checked').value;

  function runSimulation() {
    let processes;
    try {
      processes = validation.validateProcesses(state.rows.map((r) => [r.pid, r.arrival, r.burst, r.priority]));
    } catch (error) {
      handle(error, "Cannot run");
      return;
    }
    // Every algorithm runs on the same input; the choice only decides what is shown first
    state.reports = Object.keys(ALGORITHMS).map((name) => metrics.buildReport(processes, ALGORITHMS[name](processes)));
    state.fitness = initialFitness(processes);
    state.colours = Object.fromEntries(processes.map((p, i) => [p.pid, COLOURS[i % COLOURS.length]]));

    const choice = chosenAlgorithm();
    const shown = choice === "ALL" ? "SRTF" : choice;
    showExecution(state.reports.find((r) => r.algorithm === shown));
    showComparison(state.reports);
    showLog(choice === "ALL" ? state.reports : state.reports.filter((r) => r.algorithm === choice));
    selectTab(choice === "ALL" ? "compare" : "exec");
    setStatus(`Simulation finished for ${processes.length} processes (${choice === "ALL" ? "all three algorithms" : LABELS[choice]}).`, "ok");
  }

  function resetResults() {
    state.reports = null;
    $("exec-title").textContent = "Results appear here after you press Run Simulation.";
    $("exec-gantt").innerHTML = '<div class="placeholder">Gantt chart will appear here</div>';
    $("result-head").innerHTML = "";
    $("result-rows").innerHTML = "";
    $("cards").innerHTML = "";
    $("compare-gantts").innerHTML = "";
    $("compare-chart").innerHTML = "";
    $("compare-rows").innerHTML = "";
    $("observation").textContent = "";
    $("event-log").textContent = "Run a simulation to see every scheduling decision here.";
    selectTab("exec");
    setStatus("Results cleared. The process table is unchanged.");
  }

  // ------------------------------------------------------------------ step 4: execution view
  /** Gantt chart as positioned blocks, with a time mark under every boundary. */
  function ganttElement(report, title) {
    const wrap = document.createElement("div");
    const start = report.segments[0].start;
    const end = report.segments[report.segments.length - 1].end;
    const pct = (t) => ((t - start) / (end - start)) * 100;

    let html = title ? `<div class="gantt-title">${title}</div>` : "";
    html += '<div class="gantt">';
    for (const seg of report.segments) {
      const width = pct(seg.end) - pct(seg.start);
      const label = seg.pid ?? "idle";
      const colour = seg.pid === null ? "" : `background:${state.colours[seg.pid]};`;
      html += `<div class="seg${seg.pid === null ? " idle" : ""}" style="left:${pct(seg.start)}%;width:${width}%;${colour}"
                title="${label}: ${seg.start}-${seg.end}">${width > 3.2 ? label : ""}</div>`;
    }
    html += '</div><div class="ticks">';
    const marks = [...new Set([...report.segments.map((s) => s.start), end])];
    let lastShown = -Infinity;
    for (const t of marks) {
      if (pct(t) - lastShown < 2.6 && t !== end) continue;   // avoid overlapping labels
      html += `<span style="left:${pct(t)}%">${t}</span>`;
      lastShown = pct(t);
    }
    wrap.innerHTML = `${html}</div>`;
    return wrap;
  }

  function showExecution(report) {
    $("exec-title").textContent = `${LABELS[report.algorithm]} — Gantt chart and results`;
    const holder = $("exec-gantt");
    holder.innerHTML = "";
    holder.appendChild(ganttElement(report));

    const isBjf = report.algorithm === "BJF";
    const headers = ["PID", "Arrival", "Burst", "Priority", ...(isBjf ? ["Fitness f"] : []),
      "Completion", "Turnaround", "Waiting", "Response"];
    $("result-head").innerHTML = headers.map((h) => `<th>${h}</th>`).join("");
    const rows = report.perProcess.map((r) => `<tr><td>${r.pid}</td><td>${r.arrival}</td><td>${r.burst}</td><td>${r.priority}</td>`
      + (isBjf ? `<td>${state.fitness.get(r.pid).toFixed(3)}</td>` : "")
      + `<td>${r.completion}</td><td>${r.turnaround}</td><td>${r.waiting}</td><td>${r.response}</td></tr>`);
    rows.push(`<tr class="average"><td>Average</td><td></td><td></td><td></td>${isBjf ? "<td></td>" : ""}<td></td>`
      + `<td>${report.avgTurnaround.toFixed(2)}</td><td>${report.avgWaiting.toFixed(2)}</td><td>${report.avgResponse.toFixed(2)}</td></tr>`);
    $("result-rows").innerHTML = rows.join("");

    const cards = [
      ["Avg waiting", `${report.avgWaiting.toFixed(2)} ms`],
      ["Avg turnaround", `${report.avgTurnaround.toFixed(2)} ms`],
      ["Avg response", `${report.avgResponse.toFixed(2)} ms`],
      ["Max waiting", `${report.maxWaiting} ms`],
      ["CPU utilisation", `${report.cpuUtilisation.toFixed(1)} %`],
      ["Throughput", `${report.throughput.toFixed(3)}/ms`],
      ["Context switches", `${report.contextSwitches}`],
    ];
    $("cards").innerHTML = cards.map(([label, value]) =>
      `<div class="card"><div class="label">${label}</div><div class="value">${value}</div></div>`).join("");
  }

  function showLog(reports) {
    const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    $("event-log").innerHTML = reports.map((r) =>
      `<b>${LABELS[r.algorithm]}</b>\n${r.events.map((e) => `  ${escape(e)}`).join("\n")}`).join("\n\n");
  }

  // ------------------------------------------------------------------ step 5: comparison view
  function barChartSvg(reports) {
    const groups = [["Avg waiting", "avgWaiting"], ["Avg turnaround", "avgTurnaround"],
                    ["Avg response", "avgResponse"], ["Max waiting", "maxWaiting"]];
    const W = 760, H = 230, left = 44, bottom = 34, top = 22, right = 110;
    const plotW = W - left - right, plotH = H - top - bottom;
    const maxValue = Math.max(1, ...reports.flatMap((r) => groups.map(([, k]) => r[k]))) * 1.15;
    const y = (v) => top + plotH - (v / maxValue) * plotH;
    const groupW = plotW / groups.length, barW = Math.min(34, (groupW * 0.75) / reports.length);

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Average and maximum times per algorithm">`;
    for (let i = 0; i <= 4; i += 1) {   // light grid lines with values
      const v = (maxValue / 4) * i;
      svg += `<line x1="${left}" x2="${left + plotW}" y1="${y(v)}" y2="${y(v)}" stroke="#e3e8ea"/>`
           + `<text x="${left - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#5b6b72">${v.toFixed(0)}</text>`;
    }
    groups.forEach(([label, key], g) => {
      const x0 = left + g * groupW + (groupW - barW * reports.length) / 2;
      reports.forEach((r, i) => {
        const x = x0 + i * barW, v = r[key];
        svg += `<rect x="${x + 2}" y="${y(v)}" width="${barW - 4}" height="${top + plotH - y(v)}" fill="${SERIES_COLOURS[r.algorithm]}" rx="2"/>`
             + `<text x="${x + barW / 2}" y="${y(v) - 4}" font-size="10.5" text-anchor="middle" fill="#1b2a30">${Number.isInteger(v) ? v : v.toFixed(2)}</text>`;
      });
      svg += `<text x="${left + g * groupW + groupW / 2}" y="${H - 12}" font-size="12" text-anchor="middle" fill="#1b2a30">${label}</text>`;
    });
    svg += `<line x1="${left}" x2="${left + plotW}" y1="${top + plotH}" y2="${top + plotH}" stroke="#1b2a30"/>`;
    svg += `<text x="12" y="${top + plotH / 2}" font-size="11" fill="#5b6b72" transform="rotate(-90 12 ${top + plotH / 2})" text-anchor="middle">ms</text>`;
    reports.forEach((r, i) => {
      svg += `<rect x="${W - right + 18}" y="${top + i * 20}" width="12" height="12" fill="${SERIES_COLOURS[r.algorithm]}" rx="2"/>`
           + `<text x="${W - right + 36}" y="${top + i * 20 + 10}" font-size="12" fill="#1b2a30">${r.algorithm}</text>`;
    });
    return `${svg}</svg>`;
  }

  function showComparison(reports) {
    const gantts = $("compare-gantts");
    gantts.innerHTML = "";
    for (const r of reports) gantts.appendChild(ganttElement(r, LABELS[r.algorithm]));
    $("compare-chart").innerHTML = barChartSvg(reports);

    $("compare-rows").innerHTML = metrics.COMPARISON_ROWS.map(([label, key, lowerIsBetter, decimals]) => {
      const best = metrics.bestOf(reports, key, lowerIsBetter);
      return `<tr><td class="left">${label}</td>${reports.map((r) => `<td>${r[key].toFixed(decimals)}</td>`).join("")}`
        + `<td class="best">${best}</td></tr>`;
    }).join("");
    $("observation").textContent = formatting.observationText(reports);
  }

  // ------------------------------------------------------------------ tabs and wiring
  function selectTab(name) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".tab-body").forEach((b) => b.classList.toggle("active", b.id === `tab-${name}`));
  }

  function init() {
    const select = $("sample-select");
    select.innerHTML = Object.entries(samples.SAMPLES).map(([key, s]) => `<option value="${key}">${s.label}</option>`).join("");

    $("add-form").addEventListener("submit", addProcess);
    $("btn-remove").addEventListener("click", removeSelected);
    $("btn-clear").addEventListener("click", () => { setRows([], "Table cleared."); resetResults(); setStatus("Table cleared."); });
    $("btn-random").addEventListener("click", () => setRows(samples.randomProcesses(4 + Math.floor(Math.random() * 3)), "Loaded a random process set."));
    $("btn-sample").addEventListener("click", () => {
      const sample = samples.SAMPLES[select.value];
      setRows(sample.processes, `Loaded: ${sample.label}.`);
    });
    $("csv-input").addEventListener("change", loadCsvFile);
    $("btn-run").addEventListener("click", runSimulation);
    $("btn-reset").addEventListener("click", resetResults);
    document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => selectTab(t.dataset.tab)));
    suggestNextPid();
  }

  // Exposed for automated screenshots/tests; the page itself does not need it.
  window.SimulatorApp = { state, setRows, runSimulation, selectTab, addProcess };
  init();
})();
