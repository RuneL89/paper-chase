import { looksLikePerson } from './src/entities/index.js';

const names = ['Acme Corp', 'Globex Inc', 'Earnings Growth', 'Market Expansion', 'Acme Corporation'];
for (const n of names) {
  console.log(n, '->', looksLikePerson(n));
}
