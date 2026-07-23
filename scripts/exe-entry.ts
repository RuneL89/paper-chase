/**
 * pkg/esbuild entry for the Windows exe build ONLY (ad-hoc packaging,
 * compliance-log entry [2026-07-23 03:52]).
 *
 * Side-effect import: src/cli.ts's direct-execution guard fires inside the
 * packaged exe (pkg sets process.pkg; in the dev bundle argv[1] matches the
 * bundle path). A dedicated entry keeps the bundle EXPORT-FREE — pkg's ESM
 * transform cannot bytecode-wrap a module that combines exports with
 * top-level await (ink's yoga-layout uses TLA), so src/cli.ts's `program`
 * export must not surface in the bundle entry.
 */
import '../src/cli';
