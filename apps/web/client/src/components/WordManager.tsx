import React, { useState, useRef } from 'react'

export function WordManager() {
  const [uploadStatus, setUploadStatus] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [wordListName, setWordListName] = useState('')
  const [vetted, setVetted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadStatus(`Uploading ${file.name}...`)

    const formData = new FormData()
    formData.append('file', file)
    if (wordListName.trim()) formData.append('wordListName', wordListName.trim())
    formData.append('vetted', String(vetted))

    try {
      const response = await fetch('/api/words/import', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error ?? 'Upload failed')

      setUploadStatus(
        `✅ ${result.message}` +
          (result.errors?.length > 0 ? ` (${result.errors.length} errors)` : '')
      )
    } catch (err) {
      setUploadStatus(`❌ ${err instanceof Error ? err.message : 'Upload failed'}`)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <h2 style={styles.heading}>Word Manager</h2>
      <p style={styles.subheading}>
        Import and manage your word/clue database. Words imported here become available
        for puzzle generation and are stored in your Supabase database.
      </p>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Import Words from CSV</h3>
        <p style={styles.hint}>
          CSV format (with header row):<br />
          <code>word,clue,difficulty</code><br />
          <code>APPLE,"A fruit that keeps the doctor away",easy</code><br />
          <code>ENIGMA,"A puzzling mystery",hard</code>
        </p>

        <label style={styles.label}>
          Word List Name (optional)
          <input
            style={styles.input}
            type="text"
            value={wordListName}
            onChange={(e) => setWordListName(e.target.value)}
            placeholder="e.g. General Knowledge Vol 1"
          />
          <span style={styles.fieldHint}>
            Creates a named word list from these entries for reuse
          </span>
        </label>

        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={vetted}
            onChange={(e) => setVetted(e.target.checked)}
          />
          Mark clues as vetted (human-reviewed, preferred for publication)
        </label>

        <button
          style={styles.uploadBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? '⏳ Importing...' : '📂 Choose CSV File'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />

        {uploadStatus && (
          <p style={{
            ...styles.statusText,
            color: uploadStatus.startsWith('✅') ? '#276749' : uploadStatus.startsWith('❌') ? '#9b2c2c' : '#2c5282',
          }}>
            {uploadStatus}
          </p>
        )}
      </section>

      <section style={{ ...styles.card, marginTop: '20px' }}>
        <h3 style={styles.cardTitle}>About Your Word Database</h3>
        <p style={styles.hint}>
          Your words are stored in Supabase PostgreSQL. Each word can have multiple clues
          at different difficulty levels. As you build more books and import more words,
          this database becomes a valuable creative asset — reusable across all your projects.
        </p>
        <p style={{ ...styles.hint, marginTop: '8px' }}>
          <strong>Sources:</strong> Manual imports are tagged as <code>IMPORTED</code>.
          Future versions will support AI-generated clues (tagged <code>AI_GENERATED</code>)
          and a manual clue editor.
        </p>
      </section>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: '1.6rem', fontWeight: 700, marginBottom: '6px' },
  subheading: { color: '#555', marginBottom: '28px' },
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
  input: {
    padding: '8px 12px',
    border: '1px solid #d0d0d0',
    borderRadius: '6px',
    fontSize: '0.9rem',
    width: '100%',
  },
  fieldHint: { fontSize: '0.75rem', color: '#888', fontWeight: 400 },
  hint: { fontSize: '0.85rem', color: '#666', lineHeight: 1.6, marginBottom: '18px' },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.875rem',
    color: '#444',
    cursor: 'pointer',
    marginBottom: '18px',
  },
  uploadBtn: {
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 24px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  statusText: {
    marginTop: '14px',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
}
