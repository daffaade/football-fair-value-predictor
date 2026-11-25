import { useState } from 'react'

interface BoundedNumberInputProps {
  id?: string
  value: number | undefined
  min?: number
  max?: number
  placeholder?: string
  allowEmpty?: boolean
  className?: string
  onCommit: (next: number | undefined) => void
}

function toDisplay(value: number | undefined): string {
  return value === undefined ? '' : String(value)
}

export function BoundedNumberInput({
  id,
  value,
  min,
  max,
  placeholder,
  allowEmpty = true,
  className,
  onCommit,
}: BoundedNumberInputProps) {
  const [draft, setDraft] = useState(() => toDisplay(value))
  const [prevValue, setPrevValue] = useState(value)

  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(toDisplay(value))
  }

  const handleChange = (raw: string) => {
    setDraft(raw)
    const trimmed = raw.trim()

    if (trimmed === '') {
      if (allowEmpty) {
        onCommit(undefined)
      }
      return
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      return
    }
    if (min !== undefined && parsed < min) {
      return
    }
    if (max !== undefined && parsed > max) {
      return
    }
    onCommit(parsed)
  }

  const handleBlur = () => {
    setDraft(toDisplay(value))
  }

  return (
    <input
      id={id}
      type="number"
      step="any"
      min={min}
      max={max}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      className={className}
    />
  )
}
