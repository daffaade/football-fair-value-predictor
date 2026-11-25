export interface NumberSearchParamOptions {
  min?: number
  max?: number
  integer?: boolean
  fallback?: number
}

export function parseString(value: unknown): string | undefined
export function parseString(value: unknown, fallback: string): string
export function parseString(
  value: unknown,
  fallback?: string,
): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : fallback
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return fallback
}

export function parseNumber(
  value: unknown,
  options?: Omit<NumberSearchParamOptions, 'fallback'>,
): number | undefined
export function parseNumber(
  value: unknown,
  options: NumberSearchParamOptions & { fallback: number },
): number
export function parseNumber(
  value: unknown,
  options: NumberSearchParamOptions = {},
): number | undefined {
  const { min, max, integer = false, fallback } = options

  let parsed: number | undefined
  if (typeof value === 'number') {
    parsed = value
  } else if (typeof value === 'string' && value.trim().length > 0) {
    parsed = Number(value)
  }

  if (parsed === undefined || !Number.isFinite(parsed)) {
    return fallback
  }

  if (integer && !Number.isInteger(parsed)) {
    return fallback
  }

  if (min !== undefined && parsed < min) {
    return fallback
  }

  if (max !== undefined && parsed > max) {
    return fallback
  }

  return parsed
}

export function parseBoolean(value: unknown): boolean | undefined
export function parseBoolean(value: unknown, fallback: boolean): boolean
export function parseBoolean(
  value: unknown,
  fallback?: boolean,
): boolean | undefined {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
    return fallback
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }

  return fallback
}

export function parseEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | undefined
export function parseEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number]
export function parseEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback?: T[number],
): T[number] | undefined {
  if (typeof value === 'string' && allowed.includes(value)) {
    return value as T[number]
  }

  return fallback
}
