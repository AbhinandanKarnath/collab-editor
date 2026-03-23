# Collab Docs — VS Code companion

Minimal sync with the same REST API the web app uses (`/api/documents/:id`).

## Setup

1. In VS Code: **File → Open Folder** and select this `vscode-extension` folder (or copy the folder elsewhere).
2. Run **Extensions: Install Extension from Location…** and pick this folder (or `npm install -g @vscode/vsce` and package later).
3. Open **Settings** and configure:
   - `Collab Docs: Api Base` — e.g. `http://localhost:3001` (or your LAN IP + port).
   - `Collab Docs: Document Id` — the MongoDB id of the document (copy from the URL when the doc is open in the browser).

## Commands

- **Collab Docs: Pull document from server** — opens the current Markdown in a new editor tab.
- **Collab Docs: Push active file to server** — `PATCH`es the document `content` field.

## Notes

- Push updates **MongoDB `content` only**. The web client also uses **Yjs over Socket.io**; after a push, collaborators may need a refresh or a reconnect to see changes, or wait for the next full sync.
- For true CRDT parity you would embed a Yjs provider in the extension; this extension is a simple **REST bridge** for editing the same document in VS Code.
