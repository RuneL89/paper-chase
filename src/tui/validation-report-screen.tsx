import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { useWikiList } from './hooks/use-wiki-list';
import { validateWiki, writeValidationReport, type ValidationSummary } from '../validation';
import { wikiDir } from '../utils/paths';
import type { ScreenProps } from './init-screen';

export interface ValidationReportScreenProps extends ScreenProps {
  /** Workspace directory containing wikis/ (used by tests; default '.'). */
  workspace?: string;
  /** If provided, validation runs automatically for this wiki. */
  wiki?: string;
  /**
   * Injectable validation implementation. Defaults to the real validators;
   * tests inject a stub to avoid depending on disk contents.
   */
  validateFn?: (slug: string, workspace: string) => Promise<ValidationSummary>;
}

type ReportStatus = 'idle' | 'running' | 'done' | 'error';

const REPORT_VIEWPORT_LINES = 10;
const REPORT_LINE_STEP = 3;

function isOk(summary: ValidationSummary): boolean {
  return (
    summary.links.broken.length === 0 &&
    summary.citations.invalid.length === 0 &&
    summary.citations.missingSource.length === 0 &&
    summary.schema.invalid.length === 0
  );
}

/**
 * Validation Report screen (phase doc §5.1): pick a wiki (or receive one from
 * the ingest flow) and display deterministic link, citation, and schema
 * checks. Green checkmarks mark passing checks; red X marks and details show
 * failures. Long reports can be scrolled with Up/Down.
 *
 * Ink 7 conventions (src/AGENTS.md): useInput is gated on raw-mode support,
 * a static fallback renders without a TTY, Escape returns to the menu.
 */
export function ValidationReportScreen({
  onBack,
  onResult,
  workspace = '.',
  wiki: initialWiki,
  validateFn,
}: ValidationReportScreenProps) {
  const { isRawModeSupported } = useStdin();
  const wikis = useWikiList(workspace);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedWiki = wikis.length > 0 ? wikis[Math.min(selectedIndex, wikis.length - 1)] : undefined;
  const [activeWiki, setActiveWiki] = useState(initialWiki);
  const [status, setStatus] = useState<ReportStatus>('idle');
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);

  const run = validateFn ?? validateWiki;

  const runValidation = async (slug: string) => {
    setStatus('running');
    setSummary(null);
    setErrorMessage('');
    setScrollOffset(0);
    try {
      const result = await run(slug, workspace);
      setSummary(result);
      setStatus('done');
      onResult?.(isOk(result) ? `Validation passed for ${slug}.` : `Validation found issues in ${slug}.`);
      await writeValidationReport(wikiDir(workspace, slug), result);
    } catch (err) {
      const message = (err as Error).message;
      setErrorMessage(message);
      setStatus('error');
      onResult?.(`Error: ${message}`);
    }
  };

  useEffect(() => {
    if (initialWiki && wikis.length > 0) {
      if (wikis.includes(initialWiki)) {
        setActiveWiki(initialWiki);
      }
    }
  }, [initialWiki, wikis]);

  useEffect(() => {
    if (activeWiki) {
      void runValidation(activeWiki);
    }
  }, [activeWiki]); // eslint-disable-line react-hooks/exhaustive-deps

  const reportLines: string[] = [];
  if (summary) {
    const linkOk = summary.links.broken.length === 0;
    const citeOk = summary.citations.invalid.length === 0 && summary.citations.missingSource.length === 0;
    const schemaOk = summary.schema.invalid.length === 0;
    reportLines.push(`${linkOk ? '✓' : '✗'} Link check: ${summary.links.totalLinks} links, ${summary.links.broken.length} broken, ${summary.links.orphaned.length} orphaned`);
    reportLines.push(`${citeOk ? '✓' : '✗'} Citation check: ${summary.citations.totalCitations} citations, ${summary.citations.invalid.length + summary.citations.missingSource.length} invalid`);
    reportLines.push(`${schemaOk ? '✓' : '✗'} Schema check: ${summary.schema.totalPages} pages, ${summary.schema.invalid.length} invalid`);
    for (const broken of summary.links.broken) {
      reportLines.push(`  - ${broken.page}: broken [[${broken.link}]]`);
    }
    for (const orphan of summary.links.orphaned) {
      reportLines.push(`  - Orphaned: ${orphan}`);
    }
    for (const invalid of summary.citations.invalid) {
      reportLines.push(`  - ${invalid.page}: invalid ${invalid.citation}`);
    }
    for (const missing of summary.citations.missingSource) {
      reportLines.push(`  - ${missing.page}: missing source ${missing.citation}`);
    }
    for (const violation of summary.schema.invalid) {
      reportLines.push(`  - ${violation.page}: ${violation.issue}`);
    }
  }

  const maxScroll = Math.max(0, reportLines.length - REPORT_VIEWPORT_LINES);

  useInput(
    (_input, key) => {
      if (status === 'running') {
        return;
      }
      if (key.escape) {
        onBack();
        return;
      }
      if (status === 'done' || status === 'error') {
        if (key.upArrow) {
          setScrollOffset((offset) => Math.max(0, offset - REPORT_LINE_STEP));
        } else if (key.downArrow) {
          setScrollOffset((offset) => Math.min(maxScroll, offset + REPORT_LINE_STEP));
        }
        return;
      }
      if (status === 'idle' && selectedWiki) {
        if (key.upArrow) {
          setSelectedIndex((idx) => (idx + wikis.length - 1) % wikis.length);
        } else if (key.downArrow) {
          setSelectedIndex((idx) => (idx + 1) % wikis.length);
        } else if (key.return) {
          setActiveWiki(selectedWiki);
        }
      }
    },
    { isActive: isRawModeSupported === true },
  );

  const visibleLines = reportLines.slice(scrollOffset, scrollOffset + REPORT_VIEWPORT_LINES);

  return (
    <Box flexDirection="column" minHeight={12}>
      <Header />
      <Text bold>Validation Report</Text>
      {activeWiki ? (
        <Text>Wiki: {activeWiki}</Text>
      ) : wikis.length === 0 ? (
        <Text dimColor>No wikis found in {workspace}/wikis.</Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text>Select Wiki:</Text>
          {isRawModeSupported ? (
            wikis.map((wiki, index) => (
              <Text key={wiki} color={index === selectedIndex ? 'cyan' : undefined}>
                {index === selectedIndex ? '> ' : '  '}
                {wiki}
              </Text>
            ))
          ) : (
            wikis.map((wiki) => <Text key={wiki}> {wiki}</Text>)
          )}
        </Box>
      )}
      {status === 'running' && <LoadingSpinner label="Running validation..." />}
      {status === 'error' && <ErrorBox message={errorMessage} />}
      {summary && (
        <Box flexDirection="column" marginTop={1}>
          {visibleLines.map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
          {reportLines.length > REPORT_VIEWPORT_LINES && (
            <Text dimColor>
              (showing {scrollOffset + 1}-{Math.min(scrollOffset + REPORT_VIEWPORT_LINES, reportLines.length)} of {reportLines.length})
            </Text>
          )}
        </Box>
      )}
      <Footer helpText={activeWiki ? 'Up/Down: scroll | Escape: back' : 'Up/Down: select wiki | Enter: run validation | Escape: back'} />
    </Box>
  );
}
