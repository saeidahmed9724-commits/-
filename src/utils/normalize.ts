/**
 * Arabic and English text normalization and fuzzy matching for guessing.
 */

export function normalizeText(text: string): string {
  if (!text) return '';
  let str = text.toLowerCase().trim();

  // Remove English punctuation
  str = str.replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, '');

  // Arabic Tashkeel (harakat) removal
  str = str.replace(/[\u064B-\u065F\u0670]/g, '');

  // Tatweel removal
  str = str.replace(/\u0640/g, '');

  // Normalize Arabic Alef variants: أ, إ, آ, ٱ -> ا
  str = str.replace(/[أإآٱ]/g, 'ا');

  // Normalize Taa Marbuta: ة -> ه
  str = str.replace(/ة/g, 'ه');

  // Normalize Yaa / Alef Maksura: ى -> ي
  str = str.replace(/ى/g, 'ي');

  // Normalize Hamza variants: ؤ, ئ -> ء or ignore
  str = str.replace(/[ؤئ]/g, 'ء');

  // Remove leading Arabic definite article "ال" if the word is longer than 3 letters
  const words = str.split(/\s+/).map((w) => {
    if (w.startsWith('ال') && w.length > 3) {
      return w.substring(2);
    }
    return w;
  });

  return words.join(' ').trim();
}

/**
 * Checks if a guess matches the target word/phrase.
 */
export function isCorrectGuess(guess: string, targetTitle: string, synonyms?: string[]): boolean {
  const normGuess = normalizeText(guess);
  const normTarget = normalizeText(targetTitle);

  if (!normGuess || !normTarget) return false;

  // Exact match after normalization
  if (normGuess === normTarget) return true;

  // Check if target is contained in guess (e.g. "أنا معايا بيتزا" -> contains "بيتزا")
  if (normGuess.includes(normTarget) || normTarget.includes(normGuess)) {
    // If length ratio is reasonable (not just single letter)
    if (normGuess.length >= 3 && normTarget.length >= 3) {
      return true;
    }
  }

  // Check synonyms if provided
  if (synonyms && synonyms.length > 0) {
    for (const syn of synonyms) {
      const normSyn = normalizeText(syn);
      if (normGuess === normSyn || normGuess.includes(normSyn) || normSyn.includes(normGuess)) {
        return true;
      }
    }
  }

  // Check simple Levenshtein distance for typos (tolerance of 1 edit for words >= 4 chars)
  const dist = levenshteinDistance(normGuess, normTarget);
  if (dist <= 1 && normTarget.length >= 4) {
    return true;
  }

  return false;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
