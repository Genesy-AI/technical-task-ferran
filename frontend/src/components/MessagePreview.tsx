import { FC } from 'react'
import { Lead } from '../api/types/leads/getMany'
import { TemplatePreview } from '../utils/templatePreview'

interface MessagePreviewProps {
  leads: Lead[]
  index: number
  onIndexChange: (index: number) => void
  preview: TemplatePreview
  skippedCount: number
  skipReasons: string[]
}

const leadName = (lead: Lead) => `${lead.firstName} ${lead.lastName || ''}`.trim()

/** Rendered template for one lead, with the gaps called out before anything is generated. */
export const MessagePreview: FC<MessagePreviewProps> = ({
  leads,
  index,
  onIndexChange,
  preview,
  skippedCount,
  skipReasons,
}) => {
  const lead = leads[index]
  if (!lead) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="block text-sm font-medium text-gray-700">Preview</span>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <button
            type="button"
            onClick={() => onIndexChange((index - 1 + leads.length) % leads.length)}
            disabled={leads.length < 2}
            aria-label="Previous lead"
            className="px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          <span className="tabular-nums">
            {index + 1} of {leads.length}
          </span>
          <button
            type="button"
            onClick={() => onIndexChange((index + 1) % leads.length)}
            disabled={leads.length < 2}
            aria-label="Next lead"
            className="px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ›
          </button>
          <span className="font-medium text-gray-900 truncate max-w-40">{leadName(lead)}</span>
        </div>
      </div>

      <div className="border border-gray-200 bg-gray-50 rounded-md px-3 py-2 max-h-40 overflow-y-auto text-sm text-gray-900 whitespace-pre-wrap break-words">
        {preview.segments.length === 0 ? (
          <span className="text-gray-400">Your message will appear here.</span>
        ) : (
          preview.segments.map((segment, i) =>
            segment.missingField || segment.unknownField ? (
              <mark
                key={i}
                className="bg-red-100 text-red-800 rounded px-0.5"
                title={
                  segment.unknownField
                    ? `No such field: ${segment.unknownField}`
                    : `This lead has no ${segment.missingField}`
                }
              >
                {segment.text}
              </mark>
            ) : (
              <span key={i}>{segment.text}</span>
            )
          )
        )}
      </div>

      {skippedCount > 0 && (
        <p className="text-sm text-amber-700">
          ⚠ {skippedCount} of {leads.length} lead{leads.length !== 1 ? 's' : ''} will be skipped — missing{' '}
          {skipReasons.map((reason) => `{${reason}}`).join(', ')}
        </p>
      )}
    </div>
  )
}
