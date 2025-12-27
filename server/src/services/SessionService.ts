import { SessionDocumentModel, ISessionDocument, Persona } from '../models/index.js'
import crypto from 'crypto'

export interface SessionState {
  sessionId: string
  persona: Persona
  loadedContexts: string[]
  bangaloreContextEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export class SessionService {
  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return crypto.randomUUID()
  }

  /**
   * Get or create a session by sessionId
   * If sessionId is not provided, creates a new session
   */
  async getOrCreateSession(sessionId?: string): Promise<SessionState> {
    if (sessionId) {
      const existing = await SessionDocumentModel.findOne({ sessionId })
      if (existing) {
        return this.toSessionState(existing)
      }
    }

    // Create new session
    const newSessionId = sessionId || this.generateSessionId()
    const session = await SessionDocumentModel.create({
      sessionId: newSessionId,
      persona: 'newbie',
      loadedContexts: [],
      bangaloreContextEnabled: true,
    })

    return this.toSessionState(session)
  }

  /**
   * Get session by sessionId
   * Returns null if session doesn't exist
   */
  async getSession(sessionId: string): Promise<SessionState | null> {
    const session = await SessionDocumentModel.findOne({ sessionId })
    if (!session) {
      return null
    }
    return this.toSessionState(session)
  }

  /**
   * Update persona for a session
   */
  async updatePersona(sessionId: string, persona: Persona): Promise<SessionState> {
    const session = await SessionDocumentModel.findOneAndUpdate(
      { sessionId },
      { persona },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    if (!session) {
      throw new Error('Failed to update session persona')
    }

    return this.toSessionState(session)
  }

  /**
   * Update loaded contexts for a session
   */
  async updateLoadedContexts(sessionId: string, loadedContexts: string[]): Promise<SessionState> {
    const session = await SessionDocumentModel.findOneAndUpdate(
      { sessionId },
      { loadedContexts },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    if (!session) {
      throw new Error('Failed to update session contexts')
    }

    return this.toSessionState(session)
  }

  /**
   * Update Bangalore context enabled state for a session
   */
  async updateBangaloreContextEnabled(
    sessionId: string,
    bangaloreContextEnabled: boolean
  ): Promise<SessionState> {
    const session = await SessionDocumentModel.findOneAndUpdate(
      { sessionId },
      { bangaloreContextEnabled },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    if (!session) {
      throw new Error('Failed to update Bangalore context state')
    }

    return this.toSessionState(session)
  }

  /**
   * Toggle a specific context in the session's loaded contexts
   */
  async toggleContext(sessionId: string, contextId: string): Promise<SessionState> {
    const session = await this.getOrCreateSession(sessionId)
    const loadedContexts = [...session.loadedContexts]

    const index = loadedContexts.indexOf(contextId)
    if (index === -1) {
      loadedContexts.push(contextId)
    } else {
      loadedContexts.splice(index, 1)
    }

    return this.updateLoadedContexts(sessionId, loadedContexts)
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await SessionDocumentModel.deleteOne({ sessionId })
    return result.deletedCount > 0
  }

  /**
   * Convert MongoDB document to SessionState
   */
  private toSessionState(doc: ISessionDocument): SessionState {
    return {
      sessionId: doc.sessionId,
      persona: doc.persona,
      loadedContexts: doc.loadedContexts,
      bangaloreContextEnabled: doc.bangaloreContextEnabled,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
  }
}
