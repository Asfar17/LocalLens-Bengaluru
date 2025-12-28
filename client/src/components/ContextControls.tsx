import type { ContextFile } from '../App'
import './ContextControls.css'

interface ContextControlsProps {
  contextFiles: ContextFile[]
  bangaloreContextEnabled: boolean
  onToggleContext: (fileId: string) => void
  onToggleBangaloreContext: (enabled: boolean) => void
}

function ContextControls({
  contextFiles,
  bangaloreContextEnabled,
  onToggleContext,
  onToggleBangaloreContext
}: ContextControlsProps) {
  return (
    <div className="context-controls">
      <div className="master-toggle">
        <label>Bengaluru Context:</label>
        <button
          className={`toggle-btn ${bangaloreContextEnabled ? 'on' : 'off'}`}
          onClick={() => onToggleBangaloreContext(!bangaloreContextEnabled)}
        >
          {bangaloreContextEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {bangaloreContextEnabled && (
        <div className="context-files">
          {contextFiles.map(file => (
            <button
              key={file.id}
              className={`context-chip ${file.isLoaded ? 'loaded' : ''}`}
              onClick={() => onToggleContext(file.id)}
              title={file.name}
            >
              {file.domain}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ContextControls
