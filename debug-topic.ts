import { isGenericTopic } from './src/topics/index.js';

const names = [
  'Earnings Growth',
  'Harold Varmus',
  'Ghz Intel Nehalem',
  'Publication Types',
  'Support Center',
];

for (const n of names) {
  console.log(n, '->', isGenericTopic(n));
}
