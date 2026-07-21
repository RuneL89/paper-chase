import { spawn } from 'node:child_process';

/**
 * Phase 10: PDF text-extraction engine seam.
 *
 * `pdfjs` (pdfjs-dist) is the default engine everywhere — pure JS, no system
 * dependencies, and byte-identical to the pre-Phase-10 implementation.
 * `opendataloader` (@opendataloader/pdf) is a strictly opt-in alternative
 * backed by a Java CLI; it requires a JRE (Java 11+) on PATH.
 */
export type PdfEngine = 'pdfjs' | 'opendataloader';

export const VALID_PDF_ENGINES: readonly PdfEngine[] = ['pdfjs', 'opendataloader'];

/**
 * Resolve which PDF engine to use. Precedence (highest wins):
 * CLI flag → env var (`PDF_ENGINE`) → settings file value → default 'pdfjs'.
 *
 * Resolution happens per call by the callers (nothing here caches the result)
 * because tests flip `process.env.PDF_ENGINE` between runs. Unknown values
 * throw immediately — a misspelled engine must never silently fall back.
 */
export function resolvePdfEngine(opts?: {
  flag?: string | undefined;
  env?: string | undefined;
  settings?: string | undefined;
}): PdfEngine {
  const candidate = opts?.flag ?? opts?.env ?? opts?.settings;
  if (candidate === undefined || candidate === '') {
    return 'pdfjs';
  }
  if ((VALID_PDF_ENGINES as readonly string[]).includes(candidate)) {
    return candidate as PdfEngine;
  }
  throw new Error(
    `Unknown PDF engine '${candidate}'. Valid engines: ${VALID_PDF_ENGINES.join(', ')}.`,
  );
}

/**
 * Exact, actionable error thrown when opendataloader is explicitly selected
 * but no Java runtime is available. Kept in one place so the engine module
 * and tests share the documented message verbatim.
 */
export const MISSING_JAVA_MESSAGE =
  "PDF engine 'opendataloader' requires Java 11+. Install a JRE and ensure 'java' is on PATH, " +
  'or switch the PDF engine to pdfjs (default, no system dependencies).';

let javaRuntimeCache: Promise<boolean> | null = null;
let javaRuntimeOverride: boolean | null = null;

/**
 * Probe for a Java runtime by spawning `java -version` (args array,
 * `shell: false` per the Windows shellout rule). The result is cached per
 * process — the JRE cannot appear or disappear mid-run in any meaningful
 * sense, and probing per page would spawn a process per call.
 *
 * `pathOverride` (test-only) replaces the PATH environment for the probe so
 * tests can simulate Java absence hermetically; when given, the cache is
 * bypassed. A test-only forced value (setJavaRuntimeOverrideForTests) takes
 * precedence over the real probe so downstream code paths (the engine's JRE
 * gate) can be exercised without manipulating PATH.
 */
export function hasJavaRuntime(pathOverride?: string): Promise<boolean> {
  if (javaRuntimeOverride !== null && pathOverride === undefined) {
    return Promise.resolve(javaRuntimeOverride);
  }
  if (pathOverride !== undefined) {
    return probeJava(pathOverride);
  }
  if (javaRuntimeCache === null) {
    javaRuntimeCache = probeJava(undefined);
  }
  return javaRuntimeCache;
}

function probeJava(pathOverride: string | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn('java', ['-version'], {
        shell: false,
        stdio: 'ignore',
        ...(pathOverride !== undefined ? { env: { ...process.env, PATH: pathOverride, Path: pathOverride } } : {}),
      });
    } catch {
      resolve(false);
      return;
    }
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

/** Test-only: clear the cached JRE probe result so tests can re-probe. */
export function resetJavaRuntimeCache(): void {
  javaRuntimeCache = null;
}

/** Test-only: force the JRE probe result (null restores the real probe). */
export function setJavaRuntimeOverrideForTests(value: boolean | null): void {
  javaRuntimeOverride = value;
}
