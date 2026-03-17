import React, { useState, useRef } from 'react'
import type { WordListEntry } from '@puzzle-book/shared'
import { parseCSV } from '../utils/csv'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface BookConfig {
  title: string
  subtitle: string
  author: string
  puzzleCount: number
  printTarget: string
  screenTarget: string
}

const DEFAULT_CONFIG: BookConfig = {
  title: '',
  subtitle: '',
  author: '',
  puzzleCount: 10,
  printTarget: 'kdp-6x9-bw',
  screenTarget: 'screen-pdf-tablet',
}

export function BookBuilder() {
  const [config, setConfig] = useState<BookConfig>(DEFAULT_CONFIG)
  const [wordList, setWordList] = useState<WordListEntry[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [csvError, setCsvError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function updateConfig(field: keyof BookConfig, value: string | number) {
    setConfig((prev) => ({ ...prev, [field]: value }))
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvError('')

    try {
      const text = await file.text()
      const entries = parseCSV(text)
      setWordList(entries)
      setMessage(`Loaded ${entries.length} word/clue pairs from ${file.name}`)
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Failed to parse CSV')
    }
  }

  async function handleGenerate() {
    if (!config.title.trim()) {
      setMessage('Please enter a book title')
      return
    }
    if (wordList.length < 8) {
      setMessage('Please load a word list with at least 8 entries')
      return
    }

    setStatus('loading')
    setMessage(`Generating ${config.puzzleCount} puzzles and rendering PDFs...`)

    try {
      const response = await fetch('/api/books/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, wordList }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error ?? 'Generation failed')
      }

      // Trigger download
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${config.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`
      a.click()
      URL.revokeObjectURL(url)

      setStatus('success')
      setMessage('✅ Book generated! Your download should start automatically.')
    } catch (err) {
      setStatus('error')
      setMessage(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const canGenerate = config.title.trim().length > 0 && wordList.length >= 8

  return (
    <div>
      <h2 style={styles.heading}>Build a Crossword Book</h2>
      <p style={styles.subheading}>
        Upload a word list, configure your book, and generate print-ready and screen PDFs.
      </p>

      <div style={styles.grid}>
        {/* Left column — Book settings */}
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Book Details</h3>

          <label style={styles.label}>
            Title <span style={styles.required}>*</span>
            <input
              style={styles.input}
              type="text"
              value={config.title}
              onChange={(e) => updateConfig('title', e.target.value)}
              placeholder="My Crossword Puzzle Book"
            />
          </label>

          <label style={styles.label}>
            Subtitle
            <input
              style={styles.input}
              type="text"
              value={config.subtitle}
              onChange={(e) => updateConfig('subtitle', e.target.value)}
              placeholder="Volume 1"
            />
          </label>

          <label style={styles.label}>
            Author
            <input
              style={styles.input}
              type="text"
              value={config.author}
              onChange={(e) => updateConfig('author', e.target.value)}
              placeholder="Your Name"
            />
          </label>

          <label style={styles.label}>
            Number of Puzzles
            <input
              style={styles.input}
              type="number"
              min={1}
              max={50}
              value={config.puzzleCount}
              onChange={(e) => updateConfig('puzzleCount', parseInt(e.target.value))}
            />
          </label>

          <h3 style={{ ...styles.cardTitle, marginTop: '24px' }}>Output Formats</h3>

          <label style={styles.label}>
            Print Target
            <select
              style={styles.input}
              value={config.printTarget}
              onChange={(e) => updateConfig('printTarget', e.target.value)}
            >
              <option value="kdp-6x9-bw">Amazon KDP 6×9" B&W</option>
              <option value="kdp-8x10-bw">Amazon KDP 8×10" B&W</option>
            </select>
          </label>

          <label style={styles.label}>
            Screen Target
            <select
              style={styles.input}
              value={config.screenTarget}
              onChange={(e) => updateConfig('screenTarget', e.target.value)}
            >
              <option value="screen-pdf-tablet">Tablet / Kindle Scribe PDF</option>
            </select>
          </label>
        </section>

        {/* Right column — Word list */}
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Word List</h3>
          <p style={styles.hint}>
            Upload a CSV file with columns: <code>word</code>, <code>clue</code>,{' '}
            <code>difficulty</code> (optional)
          </p>

          <div
            style={styles.dropZone}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={styles.dropIcon}>📄</div>
            <div>
              {wordList.length > 0
                ? `${wordList.length} words loaded — click to replace`
                : 'Click to upload CSV'}
            </div>
            <div style={styles.dropHint}>word, clue, difficulty</div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleCSVUpload}
          />

          {csvError && <p style={styles.errorText}>{csvError}</p>}

          {wordList.length > 0 && (
            <div style={styles.wordPreview}>
              <div style={styles.wordPreviewHeader}>
                Preview ({Math.min(5, wordList.length)} of {wordList.length})
              </div>
              {wordList.slice(0, 5).map((entry, i) => (
                <div key={i} style={styles.wordRow}>
                  <strong>{entry.word}</strong>
                  <span style={styles.clueText}>{entry.clue}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Status message */}
      {message && (
        <div
          style={{
            ...styles.statusBox,
            background:
              status === 'error' ? '#fff0f0' : status === 'success' ? '#f0fff4' : '#f0f4ff',
            borderColor:
              status === 'error' ? '#ffaaaa' : status === 'success' ? '#aaffcc' : '#aabbff',
          }}
        >
          {message}
        </div>
      )}

      {/* Generate button */}
      <button
        style={{
          ...styles.generateBtn,
          opacity: canGenerate && status !== 'loading' ? 1 : 0.5,
          cursor: canGenerate && status !== 'loading' ? 'pointer' : 'not-allowed',
        }}
        onClick={handleGenerate}
        disabled={!canGenerate || status === 'loading'}
      >
        {status === 'loading' ? '⏳ Generating...' : '🚀 Generate Book'}
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: '1.6rem', fontWeight: 700, marginBottom: '6px' },
  subheading: { color: '#555', marginBottom: '28px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' },
  card: {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    padding: '24px',
  },
  cardTitle: { fontSize: '1rem', fontWeight: 600, marginBottom: '16px', color: '#333' },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#444',
    marginBottom: '14px',
  },
  required: { color: '#e53e3e' },
  input: {
    padding: '8px 12px',
    border: '1px solid #d0d0d0',
    borderRadius: '6px',
    fontSize: '0.9rem',
    outline: 'none',
    width: '100%',
  },
  hint: { fontSize: '0.8rem', color: '#777', marginBottom: '14px', lineHeight: 1.5 },
  dropZone: {
    border: '2px dashed #c0c0c0',
    borderRadius: '8px',
    padding: '28px',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#fafafa',
    marginBottom: '14px',
    transition: 'border-color 0.15s',
  },
  dropIcon: { fontSize: '2rem', marginBottom: '8px' },
  dropHint: { fontSize: '0.75rem', color: '#999', marginTop: '4px' },
  errorText: { color: '#e53e3e', fontSize: '0.85rem', marginBottom: '10px' },
  wordPreview: {
    background: '#f7f7f7',
    borderRadius: '6px',
    padding: '10px 14px',
    fontSize: '0.8rem',
  },
  wordPreviewHeader: { fontWeight: 600, marginBottom: '8px', color: '#555' },
  wordRow: {
    display: 'flex',
    gap: '10px',
    padding: '4px 0',
    borderBottom: '1px solid #ebebeb',
  },
  clueText: { color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusBox: {
    border: '1px solid',
    borderRadius: '8px',
    padding: '14px 18px',
    fontSize: '0.9rem',
    marginBottom: '18px',
  },
  generateBtn: {
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '14px 32px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
}
