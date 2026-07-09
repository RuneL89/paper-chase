const text = 'hnology Information (NCBI), a division of the U.S. National Library of Medicine\n(NLM), at ';
const pattern1 = /[A-Z][a-zA-Z\s]+ \(NLM\)/g;
console.log('no wb:', text.match(pattern1));
const pattern2 = /[A-Z][a-zA-Z\s]* \(NLM\)/g;
console.log('zero or more:', text.match(pattern2));
