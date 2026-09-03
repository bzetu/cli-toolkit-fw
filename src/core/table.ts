function displayWidth(value: string) {
  return [...value].reduce((width, character) => {
    const code = character.codePointAt(0) ?? 0
    const wide = code >= 0x1100 && (
      code <= 0x115f
      || code === 0x2329
      || code === 0x232a
      || (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f)
      || (code >= 0xac00 && code <= 0xd7a3)
      || (code >= 0xf900 && code <= 0xfaff)
      || (code >= 0xfe10 && code <= 0xfe19)
      || (code >= 0xfe30 && code <= 0xfe6f)
      || (code >= 0xff00 && code <= 0xff60)
      || (code >= 0xffe0 && code <= 0xffe6)
      || (code >= 0x1f300 && code <= 0x1faff)
    )
    return width + (wide ? 2 : 1)
  }, 0)
}

function padCell(value: string, width: number) {
  return `${value}${" ".repeat(Math.max(0, width - displayWidth(value)))}`
}

/** Format rows as a terminal-safe table with CJK-aware column widths. */
export function formatTable(headers: string[], rows: string[][]) {
  if (headers.length === 0) return ""
  const normalized = rows.map((row) => headers.map((_, index) => row[index] ?? ""))
  const widths = headers.map((header, column) => Math.max(
    displayWidth(header),
    ...normalized.map((row) => displayWidth(row[column] ?? "")),
  ))
  const border = (left: string, middle: string, right: string) =>
    `${left}${widths.map((width) => "─".repeat(width + 2)).join(middle)}${right}`
  const renderRow = (values: string[]) =>
    `│ ${values.map((value, column) => padCell(value, widths[column] ?? 0)).join(" │ ")} │`

  return [
    border("┌", "┬", "┐"),
    renderRow(headers),
    border("├", "┼", "┤"),
    ...normalized.map(renderRow),
    border("└", "┴", "┘"),
  ].join("\n")
}
