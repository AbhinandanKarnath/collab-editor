import mongoose from 'mongoose'

// ═══════════════════════════════════════════
//  User Model (Mongoose / MongoDB)
//  Schema + static helper methods
// ═══════════════════════════════════════════

const userSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, unique: true },
    color:     { type: String, default: '#1a73e8' },
    last_seen: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    ret.id = ret._id.toString()
    delete ret._id
  },
})

const UserModel = mongoose.model('User', userSchema)

// ─── Helper layer (same interface the routes already use) ───

const User = {
  async findAll() {
    const users = await UserModel.find().sort({ name: 1 }).lean()
    return users.map(u => ({ ...u, id: u._id.toString(), _id: undefined, __v: undefined }))
  },

  async findByName(name) {
    const user = await UserModel.findOne({ name }).lean()
    if (!user) return null
    return { ...user, id: user._id.toString(), _id: undefined, __v: undefined }
  },

  async upsert({ name, color }) {
    const user = await UserModel.findOneAndUpdate(
      { name },
      { name, color, last_seen: new Date() },
      { new: true, upsert: true, lean: true }
    )
    return { ...user, id: user._id.toString(), _id: undefined, __v: undefined }
  },

  async updateLastSeen(name) {
    await UserModel.findOneAndUpdate({ name }, { last_seen: new Date() })
    return true
  },
}

export default User
