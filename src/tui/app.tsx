import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { MenuScreen } from './menu';
import { InitScreen } from './init-screen';
import { IngestScreen } from './ingest-screen';
import { AddPdfsScreen } from './add-pdfs-screen';
import { TestScreen } from './test-screen';
import { SettingsScreen } from './settings-screen';

export type Screen = 'menu' | 'init' | 'ingest' | 'add-pdfs' | 'test' | 'settings' | 'exit';

export function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [lastResult, setLastResult] = useState<string>('');

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
      {screen === 'ingest' && <IngestScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
      {screen === 'add-pdfs' && <AddPdfsScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
      {screen === 'test' && <TestScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
      {screen === 'settings' && <SettingsScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
    </Box>
  );
}
