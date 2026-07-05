import { stdin, stdout } from 'process';

export async function prompt(question: string, defaultValue?: string): Promise<string> {
  return new Promise((resolve) => {
    const promptText = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
    stdout.write(promptText);

    let input = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (key: string) => {
      if (key === '\r' || key === '\n') {
        stdin.removeListener('data', onData);
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write('\n');
        resolve(input.trim() || defaultValue || '');
        return;
      }
      if (key === '\u0003') {
        // Ctrl+C
        process.exit();
      }
      if (key === '\u007f') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          stdout.write('\b \b');
        }
      } else {
        input += key;
        stdout.write(key);
      }
    };

    stdin.on('data', onData);
  });
}

export async function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    stdout.write(`${question}: `);

    let input = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (key: string) => {
      if (key === '\r' || key === '\n') {
        stdin.removeListener('data', onData);
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write('\n');
        resolve(input.trim());
        return;
      }
      if (key === '\u0003') {
        // Ctrl+C
        process.exit();
      }
      if (key === '\u007f') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          stdout.write('\b \b');
        }
      } else {
        input += key;
        stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${hint}`, defaultYes ? 'Y' : 'N');
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

export function isInteractive(): boolean {
  return Boolean(stdin.isTTY);
}
