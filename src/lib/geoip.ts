import maxmind, { type CountryResponse, type Reader } from 'maxmind'
import path from 'node:path'

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'geoip', 'GeoLite2-Country.mmdb')

let readerPromise: Promise<Reader<CountryResponse> | null> | null = null

function getDbPath() {
  return process.env.GEOIP_DB_PATH ?? DEFAULT_DB_PATH
}

// The MaxMind reader is opened once and cached. If the GeoLite2 database file
// is absent (e.g. not downloaded yet), lookup resolves to null so callers can
// fall back to other signals without throwing.
async function getReader() {
  if (readerPromise) return readerPromise
  readerPromise = (async () => {
    try {
      return await maxmind.open<CountryResponse>(getDbPath())
    } catch {
      // Cache the miss so a missing/invalid database does not cause a file
      // read on every event; restart the process after adding the file.
      return null
    }
  })()
  return readerPromise
}

// Resolve a visitor-facing country name from an IP address using the local
// GeoLite2 database (no external request, no platform header dependency).
// Prefers the Chinese name, then English, then the ISO code.
export async function getCountryByIp(ip?: string | null): Promise<string | null> {
  if (!ip) return null

  const reader = await getReader()
  if (!reader) return null

  try {
    const record = reader.get(ip)
    const names = record?.country?.names
    return names?.['zh-CN'] ?? names?.en ?? record?.country?.iso_code ?? null
  } catch {
    return null
  }
}
