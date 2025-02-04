import { PreparedQuery, SearchMatches, SearchResult } from 'obsidian';

export function makePreparedQuery(filterText = ''): PreparedQuery {
  // WARNING: this is obviously not a faithful representation of the core obsidian
  // function that generates search tokens. Care should be taken here, only the simple
  // search text will work
  let query = '';
  let tokens: string[] = [];
  let fuzzy: string[] = [];

  if (filterText.length) {
    query = filterText;
    tokens = [filterText];
    fuzzy = filterText.toLowerCase().split('');
  }

  return {
    query,
    tokens,
    fuzzy,
  };
}

export function makeFuzzyMatch(
  matches: SearchMatches = [[0, 5]],
  score = -0.0115,
): SearchResult {
  return {
    matches,
    score,
  };
}
