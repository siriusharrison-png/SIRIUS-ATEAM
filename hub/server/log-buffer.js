export function createLogBuffer(maxLines = 200) {
  const lines = [];
  return {
    push(line) {
      lines.push(line);
      while (lines.length > maxLines) lines.shift();
    },
    lines() {
      return [...lines];
    },
  };
}
