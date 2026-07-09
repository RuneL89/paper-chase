import { extractEntities } from './src/entities/index.js';
import { extractTopics } from './src/topics/index.js';
const text = 'Electronic citation and abstract data are submitted via File Transfer Protocol (FTP) in XML, following the PubMed Document Type Definition (DTD). Electronic Data Submission is the central workflow described for adding citations to PubMed, supported by the broader Electronic Data Submission topic.';
console.log('entities:', extractEntities(text, { max: 20 }));
console.log('topics:', extractTopics(text, { max: 20 }));
