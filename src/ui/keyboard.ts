export type KeyboardEvent = {
  ctrl: boolean
  name: string
  preventDefault(): void
}

export function handleCtrlC(key: KeyboardEvent, selectedText: string, copy: (text: string) => void) {
  if (!key.ctrl || key.name !== "c") return false
  key.preventDefault()
  if (selectedText) copy(selectedText)
  return true
}

export function handleCtrlA(key: KeyboardEvent, selectAll: () => void) {
  if (!key.ctrl || key.name !== "a") return false
  key.preventDefault()
  selectAll()
  return true
}

export type CompletionEntryLike = { insert: string }

export function completeFromList<T extends CompletionEntryLike>(items: T[], selected: number): T | undefined {
  return items[selected] ?? items[0]
}
