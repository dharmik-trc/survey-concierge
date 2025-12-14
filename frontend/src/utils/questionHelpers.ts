// Simple shuffle function that gives consistent results based on a seed
export const shuffleArrayWithSeed = <T>(array: T[], seed: string): T[] => {
  // Sort the array based on a hash of each item + seed
  // This is simple and gives the same order for the same seed every time
  return [...array].sort((a, b) => {
    // Create a simple number from the seed + item
    const getHash = (item: T) => {
      const str = seed + String(item);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash += str.charCodeAt(i);
      }
      return hash;
    };

    return getHash(a) - getHash(b);
  });
};

// Helper to chunk array into smaller arrays
export const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};
