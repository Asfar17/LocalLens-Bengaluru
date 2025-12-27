import { ContextContent } from './ContextManager.js'

export type SlangTone = 'friendly' | 'rude' | 'sarcastic' | 'neutral' | 'affectionate' | 'respectful' | 'casual' | 'enthusiastic' | 'admiring' | 'direct' | 'caring' | 'positive' | 'polite'

export interface SlangUsage {
  whoUses: string
  whenAppropriate: string
  whenInappropriate: string
}

export interface SlangExplanation {
  phrase: string
  meaning: string
  tone: SlangTone
  usage: SlangUsage
}

interface ParsedSlangEntry {
  phrase: string
  meaning: string
  tone: SlangTone
  whoUses: string
  whenAppropriate: string
  whenInappropriate: string
}

export class SlangInterpreter {
  private slangEntries: Map<string, ParsedSlangEntry> = new Map()
  private initialized: boolean = false

  /**
   * Parse slang.md content and build the slang dictionary
   */
  parseSlangContext(slangContext: ContextContent): void {
    this.slangEntries.clear()
    const content = slangContext.content

    // Parse different table formats in slang.md
    this.parseEssentialPhrases(content)
    this.parseBangaloreSpecificSlang(content)
    this.parseITSlang(content)
    this.parseAutoTaxiSlang(content)
    this.parseFoodSlang(content)

    this.initialized = true
  }


  /**
   * Detect slang phrases in the given text
   * Returns array of detected slang phrases
   */
  detectSlang(text: string): string[] {
    if (!this.initialized) {
      return []
    }

    const detected: string[] = []
    const textLower = text.toLowerCase()

    for (const [phraseLower, entry] of this.slangEntries) {
      if (textLower.includes(phraseLower)) {
        detected.push(entry.phrase)
      }
    }

    // Sort by phrase length (longer phrases first) to handle overlapping matches
    return detected.sort((a, b) => b.length - a.length)
  }

  /**
   * Explain a slang phrase with meaning, tone, and usage context
   */
  explainSlang(phrase: string, slangContext: ContextContent): SlangExplanation | null {
    // Ensure context is parsed
    if (!this.initialized) {
      this.parseSlangContext(slangContext)
    }

    const phraseLower = phrase.toLowerCase()
    const entry = this.slangEntries.get(phraseLower)

    if (!entry) {
      // Try partial match
      for (const [key, value] of this.slangEntries) {
        if (key.includes(phraseLower) || phraseLower.includes(key)) {
          return this.formatExplanation(value)
        }
      }
      return null
    }

    return this.formatExplanation(entry)
  }

  /**
   * Get all known slang phrases
   */
  getAllSlangPhrases(): string[] {
    return Array.from(this.slangEntries.values()).map(e => e.phrase)
  }

  /**
   * Check if the interpreter has been initialized with slang data
   */
  isInitialized(): boolean {
    return this.initialized
  }

  private formatExplanation(entry: ParsedSlangEntry): SlangExplanation {
    return {
      phrase: entry.phrase,
      meaning: entry.meaning,
      tone: entry.tone,
      usage: {
        whoUses: entry.whoUses,
        whenAppropriate: entry.whenAppropriate,
        whenInappropriate: entry.whenInappropriate
      }
    }
  }


  private parseEssentialPhrases(content: string): void {
    // Parse Essential Phrases table
    // Format: | Phrase | Pronunciation | Meaning | Tone | Usage |
    const essentialSection = this.extractSection(content, 'Essential Phrases')
    if (!essentialSection) return

    const rows = this.parseTableRows(essentialSection)
    for (const row of rows) {
      if (row.length >= 5) {
        const phrase = row[0].trim()
        const meaning = row[2].trim()
        const tone = this.normalizeTone(row[3].trim())
        const usage = row[4].trim()

        this.slangEntries.set(phrase.toLowerCase(), {
          phrase,
          meaning,
          tone,
          whoUses: 'Everyone',
          whenAppropriate: usage,
          whenInappropriate: '-'
        })
      }
    }
  }

  private parseBangaloreSpecificSlang(content: string): void {
    // Parse Bangalore-Specific Slang table
    // Format: | Phrase | Meaning | Tone | Who Uses | When Appropriate | When NOT Appropriate |
    const section = this.extractSection(content, 'Bangalore-Specific Slang')
    if (!section) return

    const rows = this.parseTableRows(section)
    for (const row of rows) {
      if (row.length >= 6) {
        const phrase = row[0].trim()
        const meaning = row[1].trim()
        const tone = this.normalizeTone(row[2].trim())
        const whoUses = row[3].trim()
        const whenAppropriate = row[4].trim()
        const whenInappropriate = row[5].trim()

        this.slangEntries.set(phrase.toLowerCase(), {
          phrase,
          meaning,
          tone,
          whoUses,
          whenAppropriate,
          whenInappropriate
        })
      }
    }
  }

  private parseITSlang(content: string): void {
    // Parse IT/Startup Slang table
    // Format: | Phrase | Meaning | Context |
    const section = this.extractSection(content, 'IT/Startup Slang')
    if (!section) return

    const rows = this.parseTableRows(section)
    for (const row of rows) {
      if (row.length >= 3) {
        const phrase = row[0].trim()
        const meaning = row[1].trim()
        const context = row[2].trim()

        this.slangEntries.set(phrase.toLowerCase(), {
          phrase,
          meaning,
          tone: 'neutral',
          whoUses: 'IT professionals, startup employees',
          whenAppropriate: context,
          whenInappropriate: 'Outside professional settings'
        })
      }
    }
  }


  private parseAutoTaxiSlang(content: string): void {
    // Parse Auto/Taxi Slang table
    // Format: | Phrase | Meaning | When to Use |
    const section = this.extractSection(content, 'Auto/Taxi Slang')
    if (!section) return

    const rows = this.parseTableRows(section)
    for (const row of rows) {
      if (row.length >= 3) {
        const phrase = row[0].trim()
        const meaning = row[1].trim()
        const whenToUse = row[2].trim()

        this.slangEntries.set(phrase.toLowerCase(), {
          phrase,
          meaning,
          tone: 'casual',
          whoUses: 'Commuters, auto/taxi users',
          whenAppropriate: whenToUse,
          whenInappropriate: '-'
        })
      }
    }
  }

  private parseFoodSlang(content: string): void {
    // Parse Food-Related Slang table
    // Format: | Phrase | Meaning | Context |
    const section = this.extractSection(content, 'Food-Related Slang')
    if (!section) return

    const rows = this.parseTableRows(section)
    for (const row of rows) {
      if (row.length >= 3) {
        const phrase = row[0].trim()
        const meaning = row[1].trim()
        const context = row[2].trim()

        this.slangEntries.set(phrase.toLowerCase(), {
          phrase,
          meaning,
          tone: 'neutral',
          whoUses: 'Everyone',
          whenAppropriate: context,
          whenInappropriate: '-'
        })
      }
    }
  }

  private extractSection(content: string, sectionName: string): string | null {
    // Find section by heading (### or ##)
    const regex = new RegExp(`###?\\s*${sectionName}[\\s\\S]*?(?=###?\\s|$)`, 'i')
    const match = content.match(regex)
    return match ? match[0] : null
  }

  private parseTableRows(section: string): string[][] {
    const rows: string[][] = []
    const lines = section.split('\n')

    for (const line of lines) {
      // Skip header separator lines (|---|---|)
      if (line.includes('---')) continue
      
      // Parse table rows
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const cells = line
          .split('|')
          .slice(1, -1) // Remove empty first and last elements
          .map(cell => cell.trim())
        
        // Skip header row (usually first row with column names)
        if (cells.some(cell => cell.toLowerCase() === 'phrase' || cell.toLowerCase() === 'meaning')) {
          continue
        }
        
        if (cells.length > 0 && cells[0]) {
          rows.push(cells)
        }
      }
    }

    return rows
  }

  private normalizeTone(tone: string): SlangTone {
    const toneLower = tone.toLowerCase()
    
    const toneMap: Record<string, SlangTone> = {
      'friendly': 'friendly',
      'rude': 'rude',
      'sarcastic': 'sarcastic',
      'neutral': 'neutral',
      'affectionate': 'affectionate',
      'respectful': 'respectful',
      'casual': 'casual',
      'enthusiastic': 'enthusiastic',
      'admiring': 'admiring',
      'direct': 'direct',
      'caring': 'caring',
      'positive': 'positive',
      'polite': 'polite',
      'warm': 'affectionate',
      'requesting': 'polite'
    }

    // Handle compound tones like "Polite, requesting"
    for (const [key, value] of Object.entries(toneMap)) {
      if (toneLower.includes(key)) {
        return value
      }
    }

    return 'neutral'
  }
}
