import { inflateRawSync } from 'node:zlib'

import { badRequest } from '@/lib/api/errors'

type ZipEntryInput = {
  path: string
  data: Buffer
}

type ZipEntry = {
  path: string
  data: Buffer
  directory: boolean
  compressedSize: number
  uncompressedSize: number
}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const LOCAL_FILE_SIGNATURE = 0x04034b50
const MAX_EOCD_SEARCH = 65_557
const UTF8_FLAG = 0x0800

const crcTable = new Uint32Array(256)

for (let index = 0; index < 256; index += 1) {
  let value = index

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }

  crcTable[index] = value >>> 0
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

function normalizeZipPath(value: string) {
  const normalized = value.replaceAll('\\', '/').replace(/^\/+/, '')
  const segments = normalized.split('/').filter(Boolean)

  if (!segments.length || normalized.includes('\0') || /^[a-zA-Z]:/.test(value)) {
    throw badRequest(`Invalid ZIP entry path: ${value}`, 'INVALID_ZIP_PATH')
  }

  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw badRequest(`ZIP entry path escapes the archive root: ${value}`, 'ZIP_SLIP')
  }

  return segments.join('/') + (normalized.endsWith('/') ? '/' : '')
}

function writeUInt16(value: number) {
  const buffer = Buffer.allocUnsafe(2)
  buffer.writeUInt16LE(value, 0)
  return buffer
}

function writeUInt32(value: number) {
  const buffer = Buffer.allocUnsafe(4)
  buffer.writeUInt32LE(value >>> 0, 0)
  return buffer
}

function createLocalHeader(pathBuffer: Buffer, data: Buffer, crc: number) {
  return Buffer.concat([
    writeUInt32(LOCAL_FILE_SIGNATURE),
    writeUInt16(20),
    writeUInt16(UTF8_FLAG),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt32(crc),
    writeUInt32(data.length),
    writeUInt32(data.length),
    writeUInt16(pathBuffer.length),
    writeUInt16(0),
    pathBuffer,
  ])
}

function createCentralDirectoryHeader(pathBuffer: Buffer, data: Buffer, crc: number, localOffset: number) {
  return Buffer.concat([
    writeUInt32(CENTRAL_DIRECTORY_SIGNATURE),
    writeUInt16(20),
    writeUInt16(20),
    writeUInt16(UTF8_FLAG),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt32(crc),
    writeUInt32(data.length),
    writeUInt32(data.length),
    writeUInt16(pathBuffer.length),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt32(0),
    writeUInt32(localOffset),
    pathBuffer,
  ])
}

export function createZip(entries: ZipEntryInput[]) {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const normalizedPath = normalizeZipPath(entry.path)
    const pathBuffer = Buffer.from(normalizedPath, 'utf8')
    const data = Buffer.from(entry.data)
    const crc = crc32(data)
    const localHeader = createLocalHeader(pathBuffer, data, crc)

    localParts.push(localHeader, data)
    centralParts.push(createCentralDirectoryHeader(pathBuffer, data, crc, offset))
    offset += localHeader.length + data.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const eocd = Buffer.concat([
    writeUInt32(EOCD_SIGNATURE),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entries.length),
    writeUInt16(entries.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(offset),
    writeUInt16(0),
  ])

  return Buffer.concat([...localParts, centralDirectory, eocd])
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const start = Math.max(0, buffer.length - MAX_EOCD_SEARCH)

  for (let offset = buffer.length - 22; offset >= start; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset
    }
  }

  throw badRequest('ZIP file is missing the central directory.', 'INVALID_ZIP')
}

function readEntryData(zipBuffer: Buffer, entry: {
  path: string
  method: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}) {
  if (zipBuffer.readUInt32LE(entry.localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
    throw badRequest(`ZIP entry ${entry.path} has an invalid local header.`, 'INVALID_ZIP')
  }

  const localFilenameLength = zipBuffer.readUInt16LE(entry.localHeaderOffset + 26)
  const localExtraLength = zipBuffer.readUInt16LE(entry.localHeaderOffset + 28)
  const dataOffset = entry.localHeaderOffset + 30 + localFilenameLength + localExtraLength
  const compressedData = zipBuffer.subarray(dataOffset, dataOffset + entry.compressedSize)

  if (compressedData.length !== entry.compressedSize) {
    throw badRequest(`ZIP entry ${entry.path} is truncated.`, 'INVALID_ZIP')
  }

  if (entry.method === 0) {
    return Buffer.from(compressedData)
  }

  if (entry.method === 8) {
    const inflated = inflateRawSync(compressedData)

    if (inflated.length !== entry.uncompressedSize) {
      throw badRequest(`ZIP entry ${entry.path} has an invalid size.`, 'INVALID_ZIP')
    }

    return inflated
  }

  throw badRequest(`ZIP entry ${entry.path} uses an unsupported compression method.`, 'UNSUPPORTED_ZIP_METHOD')
}

export function readZip(buffer: Buffer, options: {
  maxEntries: number
  maxCompressedBytes: number
  maxUncompressedBytes: number
  maxFileBytes: number
}) {
  if (buffer.length > options.maxCompressedBytes) {
    throw badRequest('ZIP file is too large.', 'ZIP_TOO_LARGE')
  }

  const eocdOffset = findEndOfCentralDirectory(buffer)
  const entryCount = buffer.readUInt16LE(eocdOffset + 10)
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12)
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16)

  if (entryCount > options.maxEntries) {
    throw badRequest('ZIP file contains too many entries.', 'ZIP_TOO_MANY_ENTRIES')
  }

  if (centralDirectoryOffset + centralDirectorySize > buffer.length) {
    throw badRequest('ZIP central directory is invalid.', 'INVALID_ZIP')
  }

  const entries: ZipEntry[] = []
  let offset = centralDirectoryOffset
  let totalUncompressedBytes = 0

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw badRequest('ZIP central directory contains an invalid entry.', 'INVALID_ZIP')
    }

    const flags = buffer.readUInt16LE(offset + 8)
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const filenameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const pathStart = offset + 46
    const rawPath = buffer.subarray(pathStart, pathStart + filenameLength)
    const path = normalizeZipPath(rawPath.toString(flags & UTF8_FLAG ? 'utf8' : 'utf8'))
    const directory = path.endsWith('/')

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw badRequest('ZIP64 archives are not supported.', 'UNSUPPORTED_ZIP64')
    }

    if (uncompressedSize > options.maxFileBytes) {
      throw badRequest(`ZIP entry ${path} is too large.`, 'ZIP_ENTRY_TOO_LARGE')
    }

    totalUncompressedBytes += uncompressedSize
    if (totalUncompressedBytes > options.maxUncompressedBytes) {
      throw badRequest('ZIP expands to too much data.', 'ZIP_TOO_LARGE')
    }

    const data = directory
      ? Buffer.alloc(0)
      : readEntryData(buffer, { path, method, compressedSize, uncompressedSize, localHeaderOffset })

    entries.push({ path, data, directory, compressedSize, uncompressedSize })
    offset = pathStart + filenameLength + extraLength + commentLength
  }

  return entries
}
