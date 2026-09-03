/**
 * Phase 27 (vision `04` §1 Worker-process isolation amendment, user-ratified
 * 2026-09-02): the JSONL event protocol between a per-PDF worker process and
 * the TUI conductor.
 *
 * The worker speaks ONE JSON object per line on stdout:
 *
 *   {"type":"progress","line":"Chunk 3/24 (pages 11-15) ..."}   — streamed
 *   {"type":"stall","info":{...StallWaitInfo...}}               — streamed (v1.0.1; a transport stall wait started)
 *   {"type":"result","result":{...IngestResult...}}             — LAST line on success
 *   {"type":"fatal","error":"...","stack":"..."}                — LAST line on a caught error
 *
 * Exactly one terminal event (`result` or `fatal`) is ever emitted — never
 * both, never none on a clean exit. Worker stderr stays RAW diagnostics: the
 * conductor captures it separately and never parses it as events, so a
 * stray `console.log` (or a native crash banner) cannot corrupt the channel.
 *
 * Why stdout-JSONL rather than node IPC: the channel is runtime-agnostic
 * (same stream shape under dev `tsx` and the packaged runtime bundle),
 * trivially unit-testable with fixture lines, and identical to what a
 * future supervisor would consume.
 */

import type { StallWaitInfo } from '../llm/client';

/** Every event shape that can appear on the worker's stdout. */
export type WorkerEvent =
  | { type: 'progress'; line: string }
  | { type: 'stall'; info: StallWaitInfo }
  | { type: 'result'; result: unknown }
  | { type: 'fatal'; error: string; stack?: string };

/** Serialize one event as a single JSONL line (newline-terminated). */
export function serializeWorkerEvent(event: WorkerEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Parse one buffered stdout line into an event. Returns null for blank
 * lines and anything that is not a recognized event object — the conductor
 * treats unrecognized stdout as noise it must NOT relay (only real
 * `progress` lines reach the screen), while stderr is carried separately.
 */
export function parseWorkerEventLine(line: string): WorkerEvent | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || !trimmed.startsWith('{')) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const candidate = parsed as Record<string, unknown>;
  if (candidate.type === 'progress' && typeof candidate.line === 'string') {
    return { type: 'progress', line: candidate.line };
  }
  // Phase 27 v1.0.1: structured stall event — the conductor relays it to the
  // screen for the live countdown row. The payload is a StallWaitInfo
  // (label/waitSeconds/attempt/maxAttempts/statusCode); unknown shapes fall
  // back to noise (never relayed), same as every other event type.
  if (candidate.type === 'stall' && typeof candidate.info === 'object' && candidate.info !== null) {
    return { type: 'stall', info: candidate.info as StallWaitInfo };
  }
  if (candidate.type === 'result') {
    return { type: 'result', result: candidate.result };
  }
  if (candidate.type === 'fatal' && typeof candidate.error === 'string') {
    return { type: 'fatal', error: candidate.error, stack: typeof candidate.stack === 'string' ? candidate.stack : undefined };
  }
  return null;
}

/**
 * Line-buffered stdout assembler: feed raw string chunks (a child process's
 * stdout data events decoded as UTF-8), collect complete lines, and invoke
 * `onEvent` for each parseable event. Splitting on `\n` only — a partially
 * received line is retained until its newline arrives.
 */
export function createWorkerEventReader(onEvent: (event: WorkerEvent) => void): {
  push(chunk: string): void;
  /** Flush any trailing line that lacked a final newline (a worker that
   * died mid-write — the conductor still sees the last complete event). */
  flush(): void;
} {
  let buffer = '';
  const handleLine = (line: string): void => {
    const event = parseWorkerEventLine(line);
    if (event !== null) {
      onEvent(event);
    }
  };
  return {
    push(chunk: string): void {
      buffer += chunk;
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        handleLine(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
      }
    },
    flush(): void {
      if (buffer.length > 0) {
        handleLine(buffer);
        buffer = '';
      }
    },
  };
}

/**
 * Phase 27 (§2.2, test-only fault injection): the deterministic crash used
 * by the crash gates. `PAPER_CHASE_WORKER_FAULT` names the point at which
 * the worker dies WITHOUT emitting its terminal event:
 *
 *   pre-result — after all pipeline work, just before the result event
 *                (simulates a death at the run's edge)
 *   mid-pdf    — after the 2nd progress line (simulates a mid-pipeline
 *                death; in-flight work is lost by construction)
 *
 * The exit is a hard `process.exit(1)` — the same shape as an unhandled
 * rejection crash: no terminal event, non-zero code, stderr intact.
 * Never active in production (the variable is never set outside tests).
 */
export const WORKER_FAULT_ENV = 'PAPER_CHASE_WORKER_FAULT';

/** Count of progress lines emitted so far (the mid-pdf fault trigger). */
let faultProgressCount = 0;

/** Called by the worker for EVERY progress line BEFORE it is emitted. */
export function workerFaultAfterProgress(): void {
  faultProgressCount += 1;
  if (process.env[WORKER_FAULT_ENV] === 'mid-pdf' && faultProgressCount >= 2) {
    process.exit(1);
  }
}

/** Called by the worker just BEFORE emitting the terminal result event. */
export function workerFaultBeforeResult(): void {
  if (process.env[WORKER_FAULT_ENV] === 'pre-result') {
    process.exit(1);
  }
}
