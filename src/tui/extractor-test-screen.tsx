import React, { useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { LoadingSpinner } from './components/spinner';
import { ErrorBox } from './components/error-box';
import { useWikiList } from './hooks/use-wiki-list';
import { useDocumentChunks } from './hooks/use-document-chunks';
import { extractDocumentChunk, type ChunkExtraction } from '../commands/extract-chunk';
import { wikiDir } from '../utils/paths';
import type { ScreenProps } from './init-screen';

export interface ExtractorTestScreenProps extends ScreenProps {
  /** Workspace directory containing wikis/ (used by tests; default '.'). */
  workspace?: string;
  /**
   * Extraction implementation. Defaults to the real Layer 2 pipeline
   * (src/commands/extract-chunk.ts); tests inject a stub so no LLM call ever
   * happens (same pattern as the add-pdfs screen's injectable pickFiles).
   */
  extractChunkFn?: (wikiDir: string, chunkId: string) => Promise<ChunkExtraction>;
}

type Mode = 'wiki' | 'chunk' | 'action' | 'results' | 'json';
type RunStatus = 'idle' | 'running' | 'done' | 'error';
type ActionFocus = 'run' | 'back';
type ResultsFocus = 'json' | 'back';

const MAX_LISTED_ENTITIES = 10;
const JSON_VIEWER_LINES = 12;
const JSON_PAGE_STEP = 10;

/**
 * Test Extractor screen (phase doc §5.1): pick a wiki, pick a document chunk
 * (noted adaptation 6: chunks are listed from documents/, results are saved
 * to .state/extracted/), run the Layer 2 Extractor, and inspect the result —
 * entity/relationship/claim counts, entity names/types, the save path, and a
 * scrollable JSON viewer ("View JSON").
 *
 * Ink 7 conventions (src/AGENTS.md): useInput is gated on raw-mode support,
 * a static fallback renders without a TTY, Escape steps back through
 * json → results → chunk → wiki → menu.
 */
export function ExtractorTestScreen({ onBack, onResult, workspace = '.', extractChunkFn }: ExtractorTestScreenProps) {
  const { isRawModeSupported } = useStdin();
  const wikis = useWikiList(workspace);
  const [mode, setMode] = useState<Mode>('wiki');
  const [wikiIndex, setWikiIndex] = useState(0);
  const selectedWiki = wikis.length > 0 ? wikis[Math.min(wikiIndex, wikis.length - 1)] : undefined;
  const [activeWiki, setActiveWiki] = useState<string | undefined>(undefined);
  const chunks = useDocumentChunks(workspace, mode === 'wiki' ? selectedWiki : activeWiki);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [activeChunk, setActiveChunk] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [extraction, setExtraction] = useState<ChunkExtraction | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionFocus, setActionFocus] = useState<ActionFocus>('run');
  const [resultsFocus, setResultsFocus] = useState<ResultsFocus>('json');
  const [scrollOffset, setScrollOffset] = useState(0);

  const jsonLines = extraction ? JSON.stringify(extraction.result, null, 2).split('\n') : [];
  const maxScroll = Math.max(0, jsonLines.length - JSON_VIEWER_LINES);

  const runExtraction = async (wiki: string, chunkId: string) => {
    setStatus('running');
    setExtraction(null);
    setErrorMessage('');
    try {
      const run = extractChunkFn ?? extractDocumentChunk;
      const outcome = await run(wikiDir(workspace, wiki), chunkId);
      setExtraction(outcome);
      setScrollOffset(0);
      setStatus('done');
      setMode('results');
      setResultsFocus('json');
      const summary =
        `Extracted ${outcome.result.entities.length} entities, ${outcome.result.relationships.length} relationships, ` +
        `${outcome.result.claims.length} claims from chunk ${chunkId}.`;
      onResult?.(summary);
    } catch (err) {
      setStatus('error');
      setErrorMessage((err as Error).message);
      onResult?.(`Error: ${(err as Error).message}`);
    }
  };

  useInput(
    (_input, key) => {
      if (status === 'running') {
        return; // input gated while the LLM call is in flight
      }
      if (key.escape) {
        if (mode === 'json') {
          setMode('results');
        } else if (mode === 'results' || mode === 'action') {
          setMode('chunk');
          setStatus('idle');
          setExtraction(null);
          setErrorMessage('');
        } else if (mode === 'chunk') {
          setMode('wiki');
        } else {
          onBack();
        }
        return;
      }
      if (mode === 'wiki') {
        if (wikis.length === 0) {
          return;
        }
        if (key.upArrow) {
          setWikiIndex((wikiIndex + wikis.length - 1) % wikis.length);
        } else if (key.downArrow) {
          setWikiIndex((wikiIndex + 1) % wikis.length);
        } else if (key.return && selectedWiki) {
          setActiveWiki(selectedWiki);
          setChunkIndex(0);
          setMode('chunk');
        }
        return;
      }
      if (mode === 'chunk') {
        const list = chunks ?? [];
        if (list.length === 0) {
          return;
        }
        if (key.upArrow) {
          setChunkIndex((chunkIndex + list.length - 1) % list.length);
        } else if (key.downArrow) {
          setChunkIndex((chunkIndex + 1) % list.length);
        } else if (key.return && activeWiki) {
          setActiveChunk(list[Math.min(chunkIndex, list.length - 1)]);
          setActionFocus('run');
          setMode('action');
        }
        return;
      }
      if (mode === 'action') {
        if (key.upArrow || key.downArrow || key.tab) {
          setActionFocus(actionFocus === 'run' ? 'back' : 'run');
        } else if (key.return) {
          if (actionFocus === 'run' && activeWiki && activeChunk) {
            void runExtraction(activeWiki, activeChunk);
          } else {
            setMode('chunk');
          }
        }
        return;
      }
      if (mode === 'results') {
        if (key.upArrow || key.downArrow || key.tab) {
          setResultsFocus(resultsFocus === 'json' ? 'back' : 'json');
        } else if (key.return) {
          if (resultsFocus === 'json') {
            setMode('json');
          } else {
            setMode('chunk');
            setStatus('idle');
            setExtraction(null);
          }
        }
        return;
      }
      // mode === 'json': scrollable viewer
      if (key.upArrow) {
        setScrollOffset(Math.max(0, scrollOffset - 1));
      } else if (key.downArrow) {
        setScrollOffset(Math.min(maxScroll, scrollOffset + 1));
      } else if (key.pageUp) {
        setScrollOffset(Math.max(0, scrollOffset - JSON_PAGE_STEP));
      } else if (key.pageDown) {
        setScrollOffset(Math.min(maxScroll, scrollOffset + JSON_PAGE_STEP));
      }
    },
    { isActive: isRawModeSupported === true },
  );

  const footerText =
    mode === 'json'
      ? 'Up/Down: scroll | PageUp/PageDown: page | Escape: back to results'
      : mode === 'results'
        ? 'Up/Down: switch control | Enter: select | Escape: back to chunk list'
        : mode === 'action'
          ? 'Up/Down: switch control | Enter: select | Escape: back to chunk list'
          : 'Up/Down: select | Enter: choose | Press Escape to go back';

  return (
    <Box flexDirection="column">
      <Header />
      <Text bold>Test Extractor</Text>
      {!isRawModeSupported ? (
        // Non-TTY fallback (piped output, test runner): selection, the run
        // button, and the JSON viewer require raw mode, so render the same
        // information statically instead of crashing (contract per menu.tsx).
        <Box flexDirection="column" marginTop={1}>
          <Text>Select Wiki:</Text>
          {wikis.length === 0 ? (
            <Text dimColor> No wikis found in {workspace}/wikis. Create one first (init).</Text>
          ) : (
            wikis.map((wiki) => <Text key={wiki}> {wiki}</Text>)
          )}
          <Text> [ Run Extraction ] [ Back ]</Text>
          <Text dimColor>Interactive extractor test requires a TTY.</Text>
        </Box>
      ) : mode === 'wiki' ? (
        <Box flexDirection="column" marginTop={1}>
          {wikis.length === 0 ? (
            <Text dimColor>No wikis found in {workspace}/wikis. Create one first (init).</Text>
          ) : (
            <>
              <Text>Select Wiki:</Text>
              {wikis.map((wiki, index) => (
                <Text key={wiki} color={index === wikiIndex ? 'cyan' : undefined}>
                  {index === wikiIndex ? '> ' : '  '}
                  {wiki}
                </Text>
              ))}
            </>
          )}
        </Box>
      ) : mode === 'chunk' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>Select Chunk ({activeWiki}/documents/):</Text>
          {chunks === null ? (
            <Text dimColor> loading...</Text>
          ) : chunks.length === 0 ? (
            <Text dimColor> (no document pages yet — run ingest first)</Text>
          ) : (
            chunks.map((chunk, index) => (
              <Text key={chunk} color={index === chunkIndex ? 'cyan' : undefined}>
                {index === chunkIndex ? '> ' : '  '}
                {chunk}
              </Text>
            ))
          )}
        </Box>
      ) : mode === 'action' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>Select Wiki: {activeWiki}</Text>
          <Text>Select Chunk: {activeChunk}</Text>
          <Box marginTop={1} gap={2}>
            <Text inverse={actionFocus === 'run'} color={actionFocus === 'run' ? 'cyan' : undefined}>
              [ Run Extraction ]
            </Text>
            <Text inverse={actionFocus === 'back'} color={actionFocus === 'back' ? 'cyan' : undefined}>
              [ Back ]
            </Text>
          </Box>
        </Box>
      ) : null}
      {isRawModeSupported && status === 'running' && <LoadingSpinner label="Running extraction..." />}
      {isRawModeSupported && status === 'error' && <ErrorBox message={errorMessage} />}
      {isRawModeSupported && (mode === 'results' || mode === 'json') && extraction && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Extraction Results</Text>
          <Text>Entities: {extraction.result.entities.length}</Text>
          {extraction.result.entities.slice(0, MAX_LISTED_ENTITIES).map((entity) => (
            <Text key={entity.slug}>
              {'  '}- {entity.name} ({entity.type})
            </Text>
          ))}
          {extraction.result.entities.length > MAX_LISTED_ENTITIES ? (
            <Text dimColor>   ... +{extraction.result.entities.length - MAX_LISTED_ENTITIES} more</Text>
          ) : null}
          <Text>Relationships: {extraction.result.relationships.length}</Text>
          <Text>Claims: {extraction.result.claims.length}</Text>
          <Text>JSON saved to {extraction.jsonRelativePath}</Text>
          {mode === 'results' ? (
            <Box marginTop={1} gap={2}>
              <Text inverse={resultsFocus === 'json'} color={resultsFocus === 'json' ? 'cyan' : undefined}>
                [ View JSON ]
              </Text>
              <Text inverse={resultsFocus === 'back'} color={resultsFocus === 'back' ? 'cyan' : undefined}>
                [ Back ]
              </Text>
            </Box>
          ) : (
            <Box flexDirection="column" marginTop={1}>
              <Text dimColor>
                JSON viewer — lines {scrollOffset + 1}-{Math.min(scrollOffset + JSON_VIEWER_LINES, jsonLines.length)} of{' '}
                {jsonLines.length}
              </Text>
              {jsonLines.slice(scrollOffset, scrollOffset + JSON_VIEWER_LINES).map((line, index) => (
                <Text key={scrollOffset + index}>{line}</Text>
              ))}
            </Box>
          )}
        </Box>
      )}
      <Footer helpText={footerText} />
    </Box>
  );
}
