import { render, renderToString } from 'ink';
import React from 'react';
import { createElement } from 'react';
import { App } from './app.js';

export interface TuiOptions {
  workspace: string;
  nonInteractive?: boolean;
}

export function runTui(options: TuiOptions): void {
  if (options.nonInteractive) {
    // In non-interactive mode, render one frame to a string and exit.
    const output = renderToString(createElement(App, { workspace: options.workspace, nonInteractive: true }));
    console.log(output);
    process.exit(0);
  }

  render(createElement(App, { workspace: options.workspace }));
}
