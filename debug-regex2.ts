const text = 'U.S. National Library of\nMedicine (NLM), at the National Institutes of Health (NIH).';
const pattern = /\b[A-Z][a-zA-Z\s]+ \(NLM\)/g;
console.log(pattern);
console.log(text.match(pattern));
