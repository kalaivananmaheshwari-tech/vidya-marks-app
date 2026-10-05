/** Split PostgreSQL migrations without breaking PL/pgSQL dollar-quoted bodies. */
export function sqlStatements(source: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote: "'" | '"' | null = null;
  let dollar: string | null = null;
  let lineComment = false;
  let blockDepth = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]; const next = source[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockDepth) {
      if (c === "/" && next === "*") { blockDepth++; i++; }
      else if (c === "*" && next === "/") { blockDepth--; i++; }
      continue;
    }
    if (dollar) {
      if (source.startsWith(dollar, i)) { i += dollar.length - 1; dollar = null; }
      continue;
    }
    if (quote) {
      if (c === quote && next === quote) { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "-" && next === "-") { lineComment = true; i++; continue; }
    if (c === "/" && next === "*") { blockDepth = 1; i++; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === "$") {
      const match = source.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z_0-9]*)?\$/);
      if (match) { dollar = match[0]; i += dollar.length - 1; continue; }
    }
    if (c === ";") { const chunk = source.slice(start, i).trim(); if (chunk) statements.push(chunk); start = i + 1; }
  }
  const last = source.slice(start).trim();
  if (last.replace(/--[^\n]*/g, "").trim()) statements.push(last);
  if (quote || dollar || blockDepth) throw new Error("Unterminated migration statement.");
  return statements;
}
