/**
 * Calculates the Levenshtein distance of two strings
 * @see https://en.wikipedia.org/wiki/Levenshtein_distance
 */
function getLevenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = [];

	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}
	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b[i - 1] === a[j - 1]) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1, // substitution
					matrix[i][j - 1] + 1, // insertion
					matrix[i - 1][j] + 1 // deletion
				);
			}
		}
	}

	return matrix[b.length][a.length];
}

export function getSimilarityScore(a: string, b: string): number {
	[a, b] = [a, b].map((string) => string.toLowerCase().trim());
	const distance = getLevenshteinDistance(a, b);
	const maxLength = Math.max(a.length, b.length);
	if (maxLength === 0) return 1.0; // In such a case, don't even bother checking
	return 1.0 - distance / maxLength;
}
