const entities = [
  { name: 'Harold Varmus', canonical: 'harold-varmus', aliases: [], type: 'person', count: 2, mentions: [], confidence: 0.9 },
  { name: 'National Institutes of Health', canonical: 'national-institutes-of-health', aliases: ['NIH'], type: 'organization', count: 3, mentions: [], confidence: 0.9 },
];

function shouldKeepTopic(title: string) {
  const topicName = title.replace(/^Topic:\s*/i, '').trim();
  const topicLower = topicName.toLowerCase();
  const matchingEntity = entities.find(
    (e) => e.name.toLowerCase() === topicLower || e.aliases.some((a) => a.toLowerCase() === topicLower),
  );
  console.log(title, 'matchingEntity:', matchingEntity?.name);
  return !matchingEntity;
}

shouldKeepTopic('Topic: Harold Varmus');
shouldKeepTopic('Topic: National Institutes');
shouldKeepTopic('Topic: National Institutes of Health');
shouldKeepTopic('Topic: Foo Bar');
