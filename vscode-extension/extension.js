// @ts-check
const vscode = require('vscode')

/**
 * @param {string} base
 * @param {string} path
 */
async function apiGet(base, path) {
  const url = `${base.replace(/\/$/, '')}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`GET ${path} failed: ${res.status} ${t}`)
  }
  return res.json()
}

/**
 * @param {string} base
 * @param {string} path
 * @param {object} body
 */
async function apiPatch(base, path, body) {
  const url = `${base.replace(/\/$/, '')}${path}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`PATCH ${path} failed: ${res.status} ${t}`)
  }
  return res.json()
}

function getConfig() {
  const c = vscode.workspace.getConfiguration('collabDocs')
  const apiBase = c.get('apiBase') || 'http://localhost:3001'
  const documentId = (c.get('documentId') || '').trim()
  return { apiBase, documentId }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('collabDocs.pullFromServer', async () => {
      try {
        const { apiBase, documentId } = getConfig()
        if (!documentId) {
          vscode.window.showErrorMessage('Set collabDocs.documentId in Settings.')
          return
        }
        const doc = await apiGet(apiBase, `/api/documents/${documentId}`)
        const text = doc.content || ''
        const td = await vscode.workspace.openTextDocument({
          content: text,
          language: 'markdown',
        })
        await vscode.window.showTextDocument(td, { preview: false })
        vscode.window.showInformationMessage(
          `Pulled "${doc.title || 'Untitled'}" — save this buffer to a .md file if you want a local copy.`
        )
      } catch (e) {
        vscode.window.showErrorMessage(String(e.message || e))
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('collabDocs.pushToServer', async () => {
      try {
        const { apiBase, documentId } = getConfig()
        if (!documentId) {
          vscode.window.showErrorMessage('Set collabDocs.documentId in Settings.')
          return
        }
        const editor = vscode.window.activeTextEditor
        if (!editor) {
          vscode.window.showErrorMessage('Open a file to push.')
          return
        }
        const content = editor.document.getText()
        await apiPatch(apiBase, `/api/documents/${documentId}`, { content })
        vscode.window.showInformationMessage('Pushed content to server. Refresh the web editor to pull changes via Yjs sync.')
      } catch (e) {
        vscode.window.showErrorMessage(String(e.message || e))
      }
    })
  )
}

function deactivate() {}

module.exports = { activate, deactivate }
