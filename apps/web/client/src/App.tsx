import React, { useState } from 'react'
import { BookBuilder } from './components/BookBuilder'
import { WordManager } from './components/WordManager'

type Tab = 'build' | 'words'

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('build')

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.logo}>🧩 Puzzle Book Generator</h1>
        <nav style={styles.nav}>
          <button
            style={{ ...styles.tab, ...(activeTab === 'build' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('build')}
          >
            Book Builder
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'words' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('words')}
          >
            Word Manager
          </button>
        </nav>
      </header>

      {/* Main content */}
      <main style={styles.main}>
        {activeTab === 'build' && <BookBuilder />}
        {activeTab === 'words' && <WordManager />}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    background: '#1a1a2e',
    color: '#ffffff',
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  logo: {
    fontSize: '1.4rem',
    fontWeight: 700,
    letterSpacing: '-0.5px',
  },
  nav: {
    display: 'flex',
    gap: '8px',
  },
  tab: {
    background: 'transparent',
    color: '#aaaacc',
    border: '1px solid #aaaacc44',
    borderRadius: '6px',
    padding: '8px 18px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#ffffff22',
    color: '#ffffff',
    borderColor: '#ffffff66',
  },
  main: {
    flex: 1,
    padding: '32px',
    maxWidth: '960px',
    margin: '0 auto',
    width: '100%',
  },
}
