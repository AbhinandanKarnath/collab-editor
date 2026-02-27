import mongoose from 'mongoose'

// ═══════════════════════════════════════════
//  Document Model (Mongoose / MongoDB)
//  Schema + static helper methods
// ═══════════════════════════════════════════

const documentSchema = new mongoose.Schema(
  {
    title:       { type: String, default: 'Untitled Document' },
    content:     { type: String, default: '' },
    owner:       { type: String, default: null },
    visibility:  { type: String, enum: ['public', 'private', 'shared'], default: 'public' },
    shared_with: { type: [String], default: [] },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

// Virtual to map _id → id in JSON output (keeps frontend compatible)
documentSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    ret.id = ret._id.toString()
    delete ret._id
  },
})

const DocumentModel = mongoose.model('Document', documentSchema)

// ─── Helper layer (same interface the routes/sockets already use) ───

const Document = {
  async findAll(owner = null) {
    const filter = owner ? { owner } : {}
    return DocumentModel.find(filter).sort({ updated_at: -1 }).lean().then(docs =>
      docs.map(d => ({ ...d, id: d._id.toString(), _id: undefined, __v: undefined }))
    )
  },

  async findById(id) {
    const doc = await DocumentModel.findById(id).lean()
    if (!doc) return null
    return { ...doc, id: doc._id.toString(), _id: undefined, __v: undefined }
  },

  async create({ title, content, owner, visibility }) {
    const doc = await DocumentModel.create({
      title: title || 'Untitled Document',
      content: content || '',
      owner: owner || null,
      visibility: visibility || 'public',
      shared_with: [],
    })
    return doc.toJSON()
  },

  async update(id, updates) {
    const doc = await DocumentModel.findByIdAndUpdate(
      id,
      { ...updates, updated_at: new Date() },
      { new: true, lean: true }
    )
    if (!doc) return null
    return { ...doc, id: doc._id.toString(), _id: undefined, __v: undefined }
  },

  async delete(id) {
    await DocumentModel.findByIdAndDelete(id)
    return true
  },

  async updateContent(id, content) {
    await DocumentModel.findByIdAndUpdate(id, { content, updated_at: new Date() })
    return true
  },

  async getContent(id) {
    const doc = await DocumentModel.findById(id).select('content').lean()
    return doc?.content || null
  },

  async share(id, sharedWith) {
    const doc = await DocumentModel.findByIdAndUpdate(
      id,
      { shared_with: sharedWith, visibility: 'shared', updated_at: new Date() },
      { new: true, lean: true }
    )
    if (!doc) return null
    return { ...doc, id: doc._id.toString(), _id: undefined, __v: undefined }
  },

  async unshare(id, userName) {
    const existing = await DocumentModel.findById(id).select('shared_with').lean()
    if (!existing) return null

    const updatedList = (existing.shared_with || []).filter(u => u !== userName)

    const doc = await DocumentModel.findByIdAndUpdate(
      id,
      {
        shared_with: updatedList,
        visibility: updatedList.length > 0 ? 'shared' : 'public',
        updated_at: new Date(),
      },
      { new: true, lean: true }
    )
    if (!doc) return null
    return { ...doc, id: doc._id.toString(), _id: undefined, __v: undefined }
  },

  async findSharedWith(userName) {
    const docs = await DocumentModel.find({ shared_with: userName })
      .sort({ updated_at: -1 })
      .lean()
    return docs.map(d => ({ ...d, id: d._id.toString(), _id: undefined, __v: undefined }))
  },
}

export default Document
