const text = 'hnology Information (NCBI), a division of the U.S. National Library of Medicine\n(NLM), at ';
const pattern = /\b[A-Z][a-zA-Z\s]+ \(NLM\)/g;
console.log(text.match(pattern));
