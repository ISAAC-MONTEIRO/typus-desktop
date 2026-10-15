import { execFile } from "node:child_process";
import os from "node:os";

import { app, ipcMain } from "electron";

/**
 * Run a Windows command and return its output (empty on failure)
 * @param file Executable
 * @param args Arguments
 */
function run(file: string, args: string[], env?: Record<string, string>) {
  return new Promise<string>((resolve) => {
    execFile(
      file,
      args,
      {
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 4 * 1024 * 1024,
        env: env ? { ...process.env, ...env } : undefined,
      },
      (error, stdout) => resolve(error ? "" : stdout),
    );
  });
}

/**
 * Names (lowercase) of the running processes
 */
async function runningProcesses(): Promise<Set<string>> {
  if (process.platform !== "win32") return new Set();
  const output = await run("tasklist", ["/fo", "csv", "/nh"]);
  const names = new Set<string>();
  for (const line of output.split(/\r?\n/)) {
    const match = /^"([^"]+)"/.exec(line);
    if (match) names.add(match[1].toLowerCase());
  }
  return names;
}

/**
 * Total bytes received / sent by the system (Windows `netstat -e`)
 */
async function networkTotals(): Promise<{ rx: number; tx: number } | null> {
  if (process.platform !== "win32") return null;
  const output = await run("netstat", ["-e"]);
  // the first line with two large numbers is "Bytes  <received>  <sent>"
  for (const line of output.split(/\r?\n/)) {
    const numbers = line.trim().split(/\s+/).slice(1).map(Number);
    if (numbers.length === 2 && numbers.every((n) => Number.isFinite(n))) {
      return { rx: numbers[0], tx: numbers[1] };
    }
  }
  return null;
}

let lastNetwork: { rx: number; tx: number; at: number } | undefined;

/**
 * Performance counters of one process plus the total 3D GPU usage, read
 * from WMI (class names are the same in every Windows language). The
 * process name goes in through an environment variable, never the script.
 */
const GAME_QUERY = `
$ErrorActionPreference = 'SilentlyContinue'
$name = $env:TYPUS_PROC
$procs = @(Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $_.Name -eq $name -or $_.Name -like ($name + '#*') })
$ids = @($procs | ForEach-Object { [int]$_.IDProcess })
$engines = @(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine | Where-Object { $_.Name -like '*engtype_3D' })
$gameGpu = ($engines | Where-Object { $ids -contains [int](($_.Name -split '_')[1]) } | Measure-Object UtilizationPercentage -Sum).Sum
[pscustomobject]@{
  running = $procs.Count -gt 0
  cpu = ($procs | Measure-Object PercentProcessorTime -Sum).Sum
  memory = ($procs | Measure-Object WorkingSetPrivate -Sum).Sum
  gpu = $gameGpu
  gpuTotal = ($engines | Measure-Object UtilizationPercentage -Sum).Sum
} | ConvertTo-Json -Compress
`;

/**
 * Executable names accepted from the renderer
 */
const EXE = /^[\w .()+-]{1,64}\.exe$/i;

/**
 * Game samples are slow (~1-2 s), so keep each one for a while
 */
const GAME_CACHE_MS = 5_000;

type GameSample = {
  running: boolean;
  cpu: number;
  memory: number;
  gpu: number | null;
  gpuTotal: number | null;
};

let gameCache:
  | { exe: string; at: number; sample: GameSample | null }
  | undefined;
let gameInFlight: Promise<GameSample | null> | undefined;

/**
 * CPU (% of the whole machine), private memory (MB) and GPU (%) of a game
 * @param exe Executable name, e.g. "cs2.exe"
 */
async function sampleGame(exe: string): Promise<GameSample | null> {
  if (process.platform !== "win32" || !EXE.test(exe)) return null;
  if (gameCache?.exe === exe && Date.now() - gameCache.at < GAME_CACHE_MS) {
    return gameCache.sample;
  }
  if (gameInFlight) return gameInFlight;

  gameInFlight = (async () => {
    const output = await run(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", GAME_QUERY],
      { TYPUS_PROC: exe.replace(/\.exe$/i, "") },
    );

    let sample: GameSample | null = null;
    try {
      const data = JSON.parse(output.trim());
      const percent = (value: unknown) =>
        typeof value === "number" ? Math.min(100, Math.round(value)) : null;
      sample = {
        running: !!data.running,
        cpu:
          Math.round(((data.cpu ?? 0) / Math.max(1, os.cpus().length)) * 10) /
          10,
        memory: Math.round((data.memory ?? 0) / 1048576),
        gpu: percent(data.gpu),
        gpuTotal: percent(data.gpuTotal),
      };
    } catch {
      // counters unavailable (old Windows, WMI disabled): nothing to show
    }

    gameCache = { exe, at: Date.now(), sample };
    return sample;
  })().finally(() => (gameInFlight = undefined));

  return gameInFlight;
}

/**
 * Wire up activity detection and Developer mode metrics
 *
 * - "activity:detect": the renderer sends the executables it knows and gets
 *   back only the first one running (the process list never leaves here)
 * - "dev:metrics": CPU and memory of the app, system network rate
 * - "dev:diagnostics": versions and GPU acceleration (no paths, user or host
 *   names)
 * - "dev:game": CPU, memory and GPU of the detected game
 */
export function initActivity() {
  ipcMain.handle("activity:detect", async (_event, known: unknown) => {
    if (!Array.isArray(known)) return null;
    const running = await runningProcesses();
    const hit = known.find(
      (name) => typeof name === "string" && running.has(name.toLowerCase()),
    );
    return hit ?? null;
  });

  ipcMain.handle("dev:metrics", async () => {
    const processes = app.getAppMetrics();
    const cpu = processes.reduce(
      (sum, p) => sum + (p.cpu?.percentCPUUsage ?? 0),
      0,
    );
    const memory =
      processes.reduce((sum, p) => sum + (p.memory?.workingSetSize ?? 0), 0) /
      1024;

    let rx = 0;
    let tx = 0;
    const totals = await networkTotals();
    if (totals) {
      const now = Date.now();
      if (lastNetwork) {
        const seconds = Math.max((now - lastNetwork.at) / 1000, 0.001);
        rx = Math.max(0, (totals.rx - lastNetwork.rx) / seconds);
        tx = Math.max(0, (totals.tx - lastNetwork.tx) / seconds);
      }
      lastNetwork = { ...totals, at: now };
    }

    return {
      cpu: Math.round(cpu * 10) / 10,
      // Electron does not expose GPU utilisation: use the last WMI sample
      // taken for the game section, when there is one
      gpu: gameCache?.sample?.gpuTotal ?? null,
      rx,
      tx,
      memory: Math.round(memory),
    };
  });

  ipcMain.handle("dev:diagnostics", () => {
    const gpu = app.getGPUFeatureStatus();
    return {
      app: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      os: `${os.type()} ${os.release()} (${process.arch})`,
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1048576),
      gpuAcceleration: gpu.gpu_compositing ?? "unknown",
      uptime: Math.round(process.uptime()),
      processes: app.getAppMetrics().length,
    };
  });

  ipcMain.handle("dev:game", (_event, exe: unknown) =>
    typeof exe === "string" ? sampleGame(exe.toLowerCase()) : null,
  );
}
