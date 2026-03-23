import mongoose from 'mongoose'
import crypto from 'crypto'
import * as Y from 'yjs'

const MAX_STATE_BYTES = 2 * 1024 * 1024 // 2MB

const documentSnapshotSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    state: { type: Buffer, required: true },
    userName: { type: String, default: '' },
    message: { type: String, default: '' },
    contentDigest: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
)

documentSnapshotSchema.index({ documentId: 1, created_at: -1 })

documentSnapshotSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.state
  },
})

const SnapshotModel = mongoose.model('DocumentSnapshot', documentSnapshotSchema)

/** Apply Yjs update and return markdown text from shared `content` key */
export function textFromYjsUpdate(updateBytes) {
  const yDoc = new Y.Doc()
  try {
    Y.applyUpdate(yDoc, updateBytes)
    const yText = yDoc.getText('content')
    return yText.toString()
  } catch (e) {
    const msg = e?.message || String(e)
    throw new Error(`Invalid or truncated Yjs snapshot (${msg}).`)
  } finally {
    yDoc.destroy()
  }
}

/**
 * Build a fresh Yjs snapshot from editor-visible state (small JSON over the wire; avoids proxy truncation).
 */
export function buildCheckpointBufferFromEditor(contentText, whiteboardStrokes = []) {
  const yDoc = new Y.Doc()
  try {
    yDoc.getText('content').insert(0, contentText ?? '')
    const yArr = yDoc.getArray('strokes')
    if (Array.isArray(whiteboardStrokes)) {
      for (const s of whiteboardStrokes) {
        if (s && typeof s === 'object') yArr.push([s])
      }
    }
    return Buffer.from(Y.encodeStateAsUpdate(yDoc))
  } finally {
    yDoc.destroy()
  }
}

/**
 * Build binary state from POST body.
 * Prefer contentText (+ whiteboard) first so payloads stay small through Vite's dev proxy.
 */
export function bufferFromSnapshotBody(body) {
  if (!body || typeof body !== 'object') throw new Error('Invalid checkpoint body')

  if (typeof body.contentText === 'string') {
    const wb = Array.isArray(body.whiteboard) ? body.whiteboard : []
    return buildCheckpointBufferFromEditor(body.contentText, wb)
  }

  if (typeof body.updateBase64 === 'string' && body.updateBase64.length > 0) {
    const buf = Buffer.from(body.updateBase64, 'base64')
    if (!buf.length) throw new Error('Empty checkpoint (invalid base64)')
    return buf
  }

  if (Array.isArray(body.update) && body.update.length > 0) {
    return Buffer.from(body.update)
  }

  throw new Error(
    'Checkpoint needs contentText (recommended), updateBase64, or update (byte array).'
  )
}

export function digestContent(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

const DocumentSnapshot = {
  MAX_STATE_BYTES,

  /**
   * Validate update array/Buffer, return Buffer and extracted text + digest.
   * @throws Error if invalid or too large
   */
  validateAndDigest(updateInput) {
    let buf
    if (Buffer.isBuffer(updateInput)) buf = updateInput
    else if (updateInput instanceof Uint8Array) buf = Buffer.from(updateInput)
    else buf = Buffer.from(updateInput)
    if (buf.length === 0) throw new Error('Empty snapshot state')
    if (buf.length > MAX_STATE_BYTES) throw new Error(`Snapshot exceeds ${MAX_STATE_BYTES} bytes`)
    const text = textFromYjsUpdate(new Uint8Array(buf))
    return { buffer: buf, text, digest: digestContent(text) }
  },

  async listByDocument(documentId) {
    const rows = await SnapshotModel.find({ documentId })
      .sort({ created_at: -1 })
      .select('-state')
      .lean()
    return rows.map((d) => ({
      ...d,
      id: d._id.toString(),
      documentId: d.documentId.toString(),
      _id: undefined,
    }))
  },

  /** Metadata only (no binary state) */
  async findById(snapshotId) {
    const row = await SnapshotModel.findById(snapshotId).select('-state').lean()
    if (!row) return null
    return {
      ...row,
      id: row._id.toString(),
      documentId: row.documentId.toString(),
      _id: undefined,
    }
  },

  async findRawById(snapshotId) {
    return SnapshotModel.findById(snapshotId).lean()
  },

  async create({ documentId, state, userName, message }) {
    const { buffer, digest } = DocumentSnapshot.validateAndDigest(state)
    const doc = await SnapshotModel.create({
      documentId,
      state: buffer,
      userName: userName || '',
      message: message || '',
      contentDigest: digest,
    })
    const json = doc.toJSON()
    return {
      ...json,
      id: doc._id.toString(),
      documentId: doc.documentId.toString(),
    }
  },

  /** Decode snapshot to plain text (for preview / diff) */
  getTextFromSnapshotRow(row) {
    if (!row?.state) return ''
    return textFromYjsUpdate(new Uint8Array(row.state))
  },

  async getPreviewText(snapshotId) {
    const row = await SnapshotModel.findById(snapshotId).select('state').lean()
    if (!row) return null
    return DocumentSnapshot.getTextFromSnapshotRow(row)
  },

  async deleteByDocumentId(documentId) {
    await SnapshotModel.deleteMany({ documentId })
  },
}

export default DocumentSnapshot
