// Every way of adding matcha uses the same scoop-and-sift preparation.
export function preparationAction(key) {
  return ['powder', 'scoop', 'sieve'].includes(key) ? 'sieve' : key;
}

export function toolForObject(key) {
  if (key.startsWith('milk-')) return 'milk';
  return preparationAction(({ bowl: 'transfer', holder: 'whisk' })[key] || key);
}
