import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface ContextContent {
  fileId: string
  domain: string
  content: string
  sections: Record<string, string>
  loadedAt: Date
}

export interface ContextFileInfo {
  id: string
  name: string
  domain: string
  isLoaded: boolean
}

export class ContextManager {
  private contextDir: string
  private loadedContexts: Map<string, ContextContent> = new Map()
  private contextFiles: ContextFileInfo[] = [
    { id: 'city', name: 'city.md', domain: 'city', isLoaded: true },
    { id: 'slang', name: 'slang.md', domain: 'slang', isLoaded: true },
    { id: 'food', name: 'food.md', domain: 'food', isLoaded: true },
    { id: 'traffic', name: 'traffic.md', domain: 'traffic', isLoaded: true },
    { id: 'etiquette', name: 'etiquette.md', domain: 'etiquette', isLoaded: true },
  ]

  private possiblePaths: string[]
  private contextDirResolved: boolean = false

  constructor() {
    // In Vercel serverless, process.cwd() is the project root
    // Try multiple paths to find the context directory
    this.possiblePaths = [
      path.resolve(process.cwd(), 'context'),
      path.resolve(process.cwd(), '..', 'context'),
      path.resolve(__dirname, '..', '..', '..', 'context'),
      path.resolve(__dirname, '..', '..', '..', '..', 'context'),
      '/var/task/context' // Vercel serverless path
    ]
    
    // Default to the first path, will be validated when loading
    this.contextDir = this.possiblePaths[0]
  }

  private async ensureContextDir(): Promise<void> {
    if (this.contextDirResolved) return
    
    for (const p of this.possiblePaths) {
      try {
        await fs.access(p)
        this.contextDir = p
        this.contextDirResolved = true
        console.log(`Context directory found at: ${p}`)
        return
      } catch {
        // Path doesn't exist, try next
        console.log(`Context path not found: ${p}`)
      }
    }
    console.warn('Context directory not found in any expected location')
    this.contextDirResolved = true
  }

  async loadContext(fileId: string): Promise<ContextContent | null> {
    await this.ensureContextDir()
    
    const fileInfo = this.contextFiles.find(f => f.id === fileId)
    if (!fileInfo) return null

    try {
      const filePath = path.join(this.contextDir, fileInfo.name)
      const content = await fs.readFile(filePath, 'utf-8')
      const sections = this.parseMarkdownSections(content)

      const contextContent: ContextContent = {
        fileId,
        domain: fileInfo.domain,
        content,
        sections,
        loadedAt: new Date()
      }

      this.loadedContexts.set(fileId, contextContent)
      return contextContent
    } catch (error) {
      console.error(`Failed to load context ${fileId}:`, error)
      return null
    }
  }

  async unloadContext(fileId: string): Promise<void> {
    this.loadedContexts.delete(fileId)
  }

  getLoadedContexts(): ContextContent[] {
    return Array.from(this.loadedContexts.values())
  }

  isContextLoaded(fileId: string): boolean {
    return this.loadedContexts.has(fileId)
  }


  getContextForDomain(domain: string): ContextContent | null {
    for (const context of this.loadedContexts.values()) {
      if (context.domain === domain) return context
    }
    return null
  }

  async getAvailableContexts(): Promise<ContextFileInfo[]> {
    return this.contextFiles.map(f => ({
      ...f,
      isLoaded: this.loadedContexts.has(f.id)
    }))
  }

  async toggleContext(fileId: string): Promise<{ id: string; isLoaded: boolean }> {
    if (this.loadedContexts.has(fileId)) {
      await this.unloadContext(fileId)
      return { id: fileId, isLoaded: false }
    } else {
      await this.loadContext(fileId)
      return { id: fileId, isLoaded: true }
    }
  }

  async loadAllContexts(): Promise<void> {
    for (const file of this.contextFiles) {
      if (file.isLoaded) {
        await this.loadContext(file.id)
      }
    }
  }

  private parseMarkdownSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {}
    const lines = content.split('\n')
    let currentSection = 'intro'
    let currentContent: string[] = []

    for (const line of lines) {
      const h2Match = line.match(/^## (.+)$/)
      const h3Match = line.match(/^### (.+)$/)

      if (h2Match || h3Match) {
        if (currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n').trim()
        }
        currentSection = (h2Match?.[1] || h3Match?.[1] || '').toLowerCase().replace(/\s+/g, '-')
        currentContent = []
      } else {
        currentContent.push(line)
      }
    }

    if (currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim()
    }

    return sections
  }

  searchInContexts(query: string, contextIds: string[]): string[] {
    const results: string[] = []
    const queryLower = query.toLowerCase()

    for (const contextId of contextIds) {
      const context = this.loadedContexts.get(contextId)
      if (!context) continue

      for (const [sectionName, sectionContent] of Object.entries(context.sections)) {
        if (sectionContent.toLowerCase().includes(queryLower)) {
          results.push(`[${context.domain}/${sectionName}]: ${sectionContent.slice(0, 500)}...`)
        }
      }
    }

    return results
  }
}
