import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { MenuScreen } from './menu';
import { InitScreen } from './init-screen';
import { IngestScreen } from './ingest-screen';
import { AddPdfsScreen } from './add-pdfs-screen';
import { ExtractorTestScreen } from './extractor-test-screen';
import { TestScreen } from './test-screen';
import { SettingsScreen } from './settings-screen';
import { EntityBrowser } from './entity-browser';
import { TopicBrowser } from './topic-browser';
import { ValidationReportScreen } from './validation-report-screen';
import { DoxBrowser } from './dox-browser';

export type Screen = 'menu' | 'init' | 'ingest' | 'add-pdfs' | 'extractor-test' | 'entity-browser' | 'topic-browser' | 'dox-browser' | 'validation-report' | 'test' | 'settings' | 'exit';

export function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [lastResult, setLastResult] = useState<string>('');
  const [lastWiki, setLastWiki] = useState<string | undefined>(undefined);

  if (screen === 'exit') {
    return (
      <Box>
        <Text>Goodbye!</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {screen === 'menu' && <MenuScreen onSelect={setScreen} lastResult={lastResult} />}
      {screen === 'init' && <InitScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
      {screen === 'ingest' && (
        <IngestScreen
          onBack={() => setScreen('menu')}
          onResult={setLastResult}
          onViewReport={(wiki) => {
            setLastWiki(wiki);
            setScreen('validation-report');
          }}
        />
      )}
      {screen === 'add-pdfs' && <AddPdfsScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
      {screen === 'extractor-test' && <ExtractorTestScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
      {screen === 'entity-browser' && <EntityBrowser onBack={() => setScreen('menu')} />}
      {screen === 'topic-browser' && <TopicBrowser onBack={() => setScreen('menu')} />}
      {screen === 'dox-browser' && <DoxBrowser onBack={() => setScreen('menu')} />}
      {screen === 'validation-report' && (
        <ValidationReportScreen
          onBack={() => setScreen('menu')}
          onResult={setLastResult}
          wiki={lastWiki}
        />
      )}
      {screen === 'test' && <TestScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
      {screen === 'settings' && <SettingsScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
    </Box>
  );
}
