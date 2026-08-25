// Shared by Apollo/Muse/Sage: each asks Claude for a JSON array and needs to
// pull it out of a response that may still have stray prose around it.
export function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in response');
  }
  return JSON.parse(text.slice(start, end + 1)) as unknown[];
}
