import { FC, useMemo, useRef, useState } from 'react'
import { FieldKey, MESSAGE_FIELDS } from '../utils/leadFields'
import { TemplateLead, fieldCoverage } from '../utils/templatePreview'

interface MessageFieldPickerProps {
  leads: TemplateLead[]
  onInsert: (key: FieldKey) => void
}

/**
 * Searchable, scrollable field list.
 *
 * Every field is always listed. A field is disabled only when *none* of the selected leads has a
 * value for it — with a bulk selection, disabling on partial coverage would grey out nearly every
 * optional field and block templates that are perfectly reasonable. Partial coverage is surfaced
 * as a count instead, and the preview below spells out who would be skipped.
 */
export const MessageFieldPicker: FC<MessageFieldPickerProps> = ({ leads, onInsert }) => {
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const rows = useMemo(
    () =>
      MESSAGE_FIELDS.map((field) => ({
        field,
        covered: fieldCoverage(leads, field.key),
      })),
    [leads]
  )

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(
      ({ field }) => field.label.toLowerCase().includes(query) || field.key.toLowerCase().includes(query)
    )
  }, [rows, search])

  const insert = (key: FieldKey, covered: number) => {
    if (covered === 0) return
    onInsert(key)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (visible.length === 0) return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      const next = (activeIndex + step + visible.length) % visible.length
      setActiveIndex(next)
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const row = visible[Math.min(activeIndex, visible.length - 1)]
      if (row) insert(row.field.key, row.covered)
    }
  }

  return (
    <div className="border border-gray-300 rounded-md flex flex-col overflow-hidden">
      <input
        type="search"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setActiveIndex(0)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search fields…"
        aria-label="Search fields"
        className="px-3 py-2 text-sm border-b border-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
      />

      <ul ref={listRef} className="max-h-64 overflow-y-auto divide-y divide-gray-100">
        {visible.map(({ field, covered }, index) => {
          const isDisabled = covered === 0

          return (
            <li key={field.key}>
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => insert(field.key, covered)}
                onMouseEnter={() => setActiveIndex(index)}
                title={
                  isDisabled
                    ? 'None of the selected leads has a value for this field'
                    : `${covered} of ${leads.length} selected leads have this`
                }
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : `cursor-pointer hover:bg-blue-50 ${index === activeIndex ? 'bg-blue-50' : ''}`
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm text-gray-900 truncate">{field.label}</span>
                  <span className="block text-xs text-blue-800 font-mono truncate">{`{${field.key}}`}</span>
                </span>
                <span
                  className={`text-xs whitespace-nowrap ${
                    covered === leads.length ? 'text-gray-400' : 'text-amber-600'
                  }`}
                >
                  {covered}/{leads.length}
                </span>
              </button>
            </li>
          )
        })}

        {visible.length === 0 && (
          <li className="px-3 py-4 text-sm text-gray-500 text-center">No fields match “{search}”</li>
        )}
      </ul>
    </div>
  )
}
