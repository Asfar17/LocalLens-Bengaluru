import mongoose, { Schema, Document } from 'mongoose'
import { Persona } from './SessionDocument'

export interface IQueryLogDocument extends Document {
  sessionId: string
  query: string
  persona: Persona
  contextsUsed: string[]
  bangaloreContextEnabled: boolean
  timestamp: Date
}

const QueryLogDocumentSchema = new Schema<IQueryLogDocument>(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    query: {
      type: String,
      required: true,
    },
    persona: {
      type: String,
      enum: ['newbie', 'student', 'it-professional', 'tourist'],
      required: true,
    },
    contextsUsed: {
      type: [String],
      default: [],
    },
    bangaloreContextEnabled: {
      type: Boolean,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
)

export const QueryLogDocumentModel = mongoose.model<IQueryLogDocument>(
  'QueryLogDocument',
  QueryLogDocumentSchema
)
