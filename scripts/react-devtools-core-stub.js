// esbuild alias stub for ink's optional react-devtools-core import (see
// scripts/build-exe.ts). Never executed: ink loads devtools only when
// DEV === 'true' AND import.meta.resolve('react-devtools-core') succeeds —
// the package is deliberately not installed, so the probe throws and the
// guarded block is skipped (node_modules/ink/build/reconciler.js).
export default {};
