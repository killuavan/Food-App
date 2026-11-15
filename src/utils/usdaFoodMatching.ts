const descriptiveWords = new Set([
  'and', 'as', 'fresh', 'raw', 'cooked', 'boiled', 'baked', 'roasted', 'grilled',
  'fried', 'steamed', 'dry', 'dried', 'uncooked', 'unprepared', 'whole', 'with',
  'skin', 'unpeeled', 'peeled', 'medium', 'large', 'small', 'long', 'short', 'grain',
]);

function words(value: string): string[] {
  return value.toLocaleLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function isConfidentFoodMatch(query: string, description: string): boolean {
  const queryWords = [...new Set(words(query))];
  const descriptionWords = new Set(words(description));
  if (!queryWords.length) return false;
  const queryMatches = queryWords.every((word) => (
    descriptionWords.has(word)
    || (word.endsWith('s') && descriptionWords.has(word.slice(0, -1)))
    || descriptionWords.has(`${word}s`)
  ));
  const unexpectedWords = [...descriptionWords].filter((word) => (
    !queryWords.includes(word)
    && !queryWords.includes(word.endsWith('s') ? word.slice(0, -1) : `${word}s`)
    && !descriptiveWords.has(word)
  ));
  return queryMatches && unexpectedWords.length === 0;
}
