const maxPatternLength = 128;
const maxInputLength = 512;
const repeat = /^\{(\d{1,2})(?:,(\d{0,2}))?\}/;

// Disallow repeated groups and combinations that multiply backtracking paths.
export function compileRegex(pattern: string): ((input: string) => boolean) | undefined {
  if (!pattern.length || pattern.length > maxPatternLength) return;
  let variableRepeats = 0;
  let repeatable = false;
  let inClass = false;
  let nextGroup = 0;
  let alternateGroup: number | undefined;
  const groups: number[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '\\') {
      const escaped = pattern[++i];
      if (!escaped || /[1-9k]/.test(escaped)) return;
      repeatable = true;
      continue;
    }
    if (inClass) {
      if (char === ']') inClass = false;
      continue;
    }
    if (char === '[') {
      inClass = true;
      repeatable = true;
      continue;
    }
    if (char === '?' || char === '+' || char === '*' || char === '{') {
      if (!repeatable) return;
      if (char === '{') {
        const bounds = repeat.exec(pattern.slice(i));
        if (!bounds || Number(bounds[1]) > 64 || Number(bounds[2]) > 64) return;
        if (bounds[2] !== undefined && bounds[1] !== bounds[2]) variableRepeats++;
        i += bounds[0].length - 1;
      } else {
        variableRepeats++;
      }
      if (variableRepeats > 1) return;
      if (pattern[i + 1] === '?') i++;
      repeatable = false;
      continue;
    }
    if (char === '(') {
      groups.push(nextGroup++);
      if (pattern[i + 1] === '?') {
        if (pattern[i + 2] !== ':') return;
        i += 2;
      }
    }
    if (char === ')') groups.pop();
    if (char === '|' && groups.length) {
      const group = groups[groups.length - 1];
      if (alternateGroup !== undefined && group !== alternateGroup) return;
      alternateGroup = group;
    }
    repeatable = !'()|^$'.includes(char);
  }

  try {
    const regex = new RegExp(pattern);
    return input => input.length <= maxInputLength && regex.test(input);
  } catch {
    return;
  }
}
