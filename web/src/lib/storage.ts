/** Per-browser settings in localStorage under `bothq.<name>`. Values saved before the project was renamed (`grokbot.<name>`) are still read. */
export function lsGet(name: string): string | null {
  try { return localStorage.getItem(`bothq.${name}`) ?? localStorage.getItem(`grokbot.${name}`); } catch { return null; }
}

export function lsSet(name: string, value: string) {
  try { localStorage.setItem(`bothq.${name}`, value); } catch { /* storage unavailable */ }
}
