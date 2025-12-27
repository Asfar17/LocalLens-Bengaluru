import mongoose, { Schema, Document } from 'mongoose'

export interface IContextDocument extends Document {
  fileId: string
  fileName: string
  domain: string
  filePath: string
  isDefault: boolean
  lastModified: Date
  checksum: string
}

const ContextDocumentSchema = new Schema<IContextDocument>(
  {
    fileId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    domain: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
    lastModified: {
      type: Date,
      default: Date.now,
    },
    checksum: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

export const ContextDocumentModel = mongoose.model<IContextDocument>(
  'ContextDocument',
  ContextDocumentSchema
)
