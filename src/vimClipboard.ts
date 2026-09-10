type RegisterController = ReturnType<typeof import('@replit/codemirror-vim').Vim.getRegisterController>
type PushText = RegisterController['pushText']

export interface ClipboardResult {
  ok: boolean
  operation: string
}

export function attachSystemClipboard(
  controller: RegisterController,
  writeText: (text: string) => Promise<void>,
  report: (result: ClipboardResult) => void,
) {
  const originalPushText = controller.pushText

  const synchronizedPushText: PushText = function (registerName, operator, text, linewise, blockwise) {
    originalPushText.call(controller, registerName, operator, text, linewise, blockwise)
    if (registerName === '_') return

    const registerText = controller.unnamedRegister.toString()
    void writeText(registerText).then(
      () => report({ ok: true, operation: operator }),
      () => report({ ok: false, operation: operator }),
    )
  }

  controller.pushText = synchronizedPushText
  return () => {
    if (controller.pushText === synchronizedPushText) controller.pushText = originalPushText
  }
}
