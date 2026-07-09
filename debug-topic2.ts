import { isGenericTopic } from './src/topics/index.js';

const names = [
  'Harold Varmus',
  'Kathi Canese',
  'Sarah Weis',
  'Ghz Intel Nehalem',
  'Intel Nehalem Cpus',
  'Language System',
  'Literature Selection Technical',
  'Med Journal Name',
  'Medical Language System Umls',
  'National Center',
  'National Institutes',
  'National Library',
  'Publication Types',
  'Related Articles',
  'Subheadings Publication',
  'Support Center',
];

for (const n of names) {
  console.log(n, '->', isGenericTopic(n));
}
