/** Open a web page in a new tab. */
export function openExternal(url: string) {
  window.open(url, '_blank', 'noopener');
}
