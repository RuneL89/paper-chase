import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { spawn } from 'node:child_process';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { SuccessBox } from './components/success-box';
import type { ScreenProps } from './init-screen';

export interface TestScreenProps extends ScreenProps {
  /**
   * When false, the test run is not started automatically on mount.
   * Used by tests so rendering this screen does not spawn `npm test`
   * recursively inside the test runner.
   */
  autoRun?: boolean;
}

const MAX_OUTPUT_LINES = 15;

export function TestScreen({ onBack, onResult, autoRun = true }: TestScreenProps) {
  const [running, setRunning] = useState(false);
  const [succeeded, setSucceeded] = useState<boolean | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const startedRef = useRef(false);

  const { isRawModeSupported } = useStdin();
  useInput(
    (_input, key) => {
      if (key.escape) {
        onBack();
      }
    },
    { isActive: isRawModeSupported === true },
  );

  useEffect(() => {
    if (!autoRun || startedRef.current) {
      return;
    }
    startedRef.current = true;
    setRunning(true);

    // shell: true is mandatory on Windows — Node >= 20.12.2 refuses to spawn
    // .cmd files (npm is npm.cmd) without a shell and throws EINVAL.
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCmd, ['test'], { cwd: process.cwd(), shell: true });

    const append = (chunk: unknown) => {
      const lines = String(chunk).split(/\r?\n/).filter((line) => line.length > 0);
      setOutput((prev) => [...prev, ...lines].slice(-MAX_OUTPUT_LINES));
    };

    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (err) => {
      setRunning(false);
      setSucceeded(false);
      setOutput((prev) => [...prev, err.message].slice(-MAX_OUTPUT_LINES));
      onResult?.(`Tests failed to start: ${err.message}`);
    });
    child.on('close', (code) => {
      const ok = code === 0;
      setRunning(false);
      setSucceeded(ok);
      onResult?.(ok ? 'Tests passed' : `Tests failed (exit code ${code ?? 'unknown'})`);
    });

    return () => {
      child.kill();
    };
  }, [autoRun, onResult]);

  return (
    <Box flexDirection="column">
      <Header />
      <Text bold>Run Tests</Text>
      {running && <LoadingSpinner label="Running npm test..." />}
      {!running && succeeded === true && <SuccessBox message="All tests passed." />}
      {!running && succeeded === false && <ErrorBox message="Tests failed. See output above." />}
      {!running && succeeded === null && <Text dimColor>Test run not started.</Text>}
      {output.map((line, i) => (
        <Text key={i} dimColor={succeeded !== false}>
          {line}
        </Text>
      ))}
      <Footer helpText="Press Escape to go back" />
    </Box>
  );
}
