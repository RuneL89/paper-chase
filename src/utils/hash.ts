import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/**
 * Compute the SHA-256 hex digest of a file, streaming its contents.
 */
export async function sha256(filePath: string): Promise<string> {
  return new Promise<string>((resolvePromise, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolvePromise(hash.digest('hex')));
  });
}
