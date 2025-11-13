/**
 * Text analysis utilities for qualitative responses
 */

export type WordFrequency = {
  word: string;
  count: number;
  frequency: number; // 0-1 scale
};

export type TextAnalysis = {
  wordFrequencies: WordFrequency[];
  topWords: string[];
  totalWords: number;
  uniqueWords: number;
};

/**
 * Simple word tokenization (removes punctuation, lowercases)
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(word => word.length > 2); // Filter out very short words
}

/**
 * Common stop words to filter out
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'just', 'about'
]);

/**
 * Analyze word frequency in text responses
 */
export function analyzeWordFrequency(responses: string[]): TextAnalysis {
  const wordCounts: { [word: string]: number } = {};
  let totalWords = 0;

  // Count words across all responses
  responses.forEach(response => {
    const words = tokenize(response);
    words.forEach(word => {
      if (!STOP_WORDS.has(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
        totalWords++;
      }
    });
  });

  // Convert to array and sort by frequency
  const wordFrequencies: WordFrequency[] = Object.entries(wordCounts)
    .map(([word, count]) => ({
      word,
      count,
      frequency: totalWords > 0 ? count / totalWords : 0
    }))
    .sort((a, b) => b.count - a.count); // Sort by count descending

  // Get top words (top 30)
  const topWords = wordFrequencies.slice(0, 30).map(w => w.word);

  return {
    wordFrequencies,
    topWords,
    totalWords,
    uniqueWords: wordFrequencies.length
  };
}

/**
 * Extract common phrases (2-3 word combinations)
 */
export function extractCommonPhrases(responses: string[], minOccurrences: number = 2): string[] {
  const phraseCounts: { [phrase: string]: number } = {};

  responses.forEach(response => {
    const words = tokenize(response);
    
    // Extract 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1])) {
        phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
      }
    }
    
    // Extract 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1]) && !STOP_WORDS.has(words[i + 2])) {
        phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
      }
    }
  });

  // Filter by minimum occurrences and sort
  return Object.entries(phraseCounts)
    .filter(([_, count]) => count >= minOccurrences)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, 20) // Top 20 phrases
    .map(([phrase]) => phrase);
}

/**
 * Group similar responses (simple similarity based on common words)
 */
export function groupSimilarResponses(
  responses: string[],
  similarityThreshold: number = 0.3
): Array<{ responses: string[]; representative: string }> {
  const groups: Array<{ responses: string[]; representative: string; words: Set<string> }> = [];

  responses.forEach(response => {
    const words = new Set(tokenize(response).filter(w => !STOP_WORDS.has(w)));
    
    // Find best matching group
    let bestMatch = -1;
    let bestSimilarity = 0;

    groups.forEach((group, index) => {
      const intersection = new Set([...words].filter(w => group.words.has(w)));
      const union = new Set([...words, ...group.words]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      if (similarity > bestSimilarity && similarity >= similarityThreshold) {
        bestSimilarity = similarity;
        bestMatch = index;
      }
    });

    if (bestMatch >= 0) {
      // Add to existing group
      groups[bestMatch].responses.push(response);
      // Update words set
      groups[bestMatch].words = new Set([...groups[bestMatch].words, ...words]);
    } else {
      // Create new group
      groups.push({
        responses: [response],
        representative: response,
        words: new Set(words)
      });
    }
  });

  return groups.map(group => ({
    responses: group.responses,
    representative: group.representative
  }));
}

/**
 * Generate word cloud data structure
 */
export function generateWordCloudData(
  wordFrequencies: WordFrequency[],
  maxWords: number = 30
): Array<{ text: string; value: number }> {
  return wordFrequencies
    .slice(0, maxWords)
    .map(({ word, count }) => ({
      text: word,
      value: count
    }));
}

