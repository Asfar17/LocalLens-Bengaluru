import type { Persona } from '../App'
import './PersonaSelector.css'

interface PersonaSelectorProps {
  currentPersona: Persona
  onSelectPersona: (persona: Persona) => void
}

const personas: { id: Persona; label: string; emoji: string }[] = [
  { id: 'newbie', label: 'Newbie', emoji: '🌱' },
  { id: 'student', label: 'Student', emoji: '📚' },
  { id: 'it-professional', label: 'IT Pro', emoji: '💻' },
  { id: 'tourist', label: 'Tourist', emoji: '🧳' },
]

function PersonaSelector({ currentPersona, onSelectPersona }: PersonaSelectorProps) {
  return (
    <div className="persona-selector">
      <label>I am a:</label>
      <div className="persona-buttons">
        {personas.map(p => (
          <button
            key={p.id}
            className={currentPersona === p.id ? 'active' : ''}
            onClick={() => onSelectPersona(p.id)}
          >
            <span className="emoji">{p.emoji}</span>
            <span className="label">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default PersonaSelector
