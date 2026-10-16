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

export type CommandArgMeta = { name: string; required?: boolean; description?: string }

// 补齐后是否可以直接执行：声明了 args 元数据时，仅当所有声明参数位
// （含可选参数）都已填满才可执行——剩余未填的可选参数位（如 /quota 的
// 金额）要给用户留出输入机会；未声明元数据（meta 为 undefined）时视为
// 可执行，由「补齐后是否还有候选菜单」兜底（如 /tools /help）。
export function isCommandComplete(value: string, meta: CommandArgMeta[] | undefined): boolean {
  if (!meta) return true
  const trimmed = value.trim()
  if (!trimmed.startsWith("/")) return false
  const parts = trimmed.slice(1).split(/\s+/)
  if (parts.length === 0 || !parts[0]) return false
  const args = parts.slice(1)
  return args.length >= meta.length
}
