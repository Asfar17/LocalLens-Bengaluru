import mongoose, { Schema, Document } from 'mongoose'

export type Persona = 'newbie' | 'student' | 'it-professional' | 'tourist'

export interface ISessionDocument extends Document {
  sessionId: string
  persona: Persona
  loadedContexts: string[]
  bangaloreContextEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

const SessionDocumentSchema = new Schema<ISessionDocument>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    persona: {
      type: String,
      enum: ['newbie', 'student', 'it-professional', 'tourist'],
      default: 'newbie',
    },
    loadedContexts: {
      type: [String],
      default: [],
    },
    bangaloreContextEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

export const SessionDocumentModel = mongoose.model<ISessionDocument>(
  'SessionDocument',
  SessionDocumentSchema
)
