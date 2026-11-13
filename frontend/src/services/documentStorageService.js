const DB_NAME = 'nexus_telecom_documents'
const DB_VERSION = 1
const STORE_NAME = 'order_documents'

let customAdapter = null

export function setDocumentStorageAdapter(adapter) {
  customAdapter = adapter || null
}

export function isIndexedDbAvailable() {
  if (customAdapter) return true
  return typeof indexedDB !== 'undefined'
}

export function buildDocumentStorageKey(orderId, docKey) {
  return `${String(orderId || '').trim().toUpperCase()}:${String(docKey || '').trim()}`
}

function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null
  }
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return null
  const header = dataUrl.slice(5, commaIndex)
  const payload = dataUrl.slice(commaIndex + 1)
  const isBase64 = header.endsWith(';base64')
  const mimeType = (isBase64 ? header.slice(0, -7) : header.split(';')[0]) || 'application/octet-stream'

  if (typeof Blob === 'undefined') {
    return null
  }

  if (isBase64) {
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes], { type: mimeType })
  }

  return new Blob([decodeURIComponent(payload)], { type: mimeType })
}

function openDocumentsDatabase() {
  if (!isIndexedDbAvailable() || typeof indexedDB === 'undefined') {
    return Promise.reject(
      new Error('Browser IndexedDB storage is unavailable or disabled. Uploaded documents cannot be persisted safely.')
    )
  }

  return new Promise((resolve, reject) => {
    let request
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (err) {
      reject(
        new Error(
          `Cannot access browser IndexedDB storage: ${err?.message || 'Access denied'}.`
        )
      )
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'storageKey' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        new Error(
          `Failed to open document database: ${request.error?.message || 'IndexedDB open error'}.`
        )
      )
  })
}

async function idbPutRecord(record) {
  if (customAdapter?.put) {
    await customAdapter.put(record)
    return
  }

  const db = await openDocumentsDatabase()
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(record)

      tx.oncomplete = () => {
        db.close()
        resolve(record)
      }
      tx.onerror = () => {
        const message = tx.error?.message || 'IndexedDB write failed'
        db.close()
        reject(new Error(`Unable to store file "${record.name}" in IndexedDB: ${message}`))
      }
      tx.onabort = () => {
        const message = tx.error?.message || 'IndexedDB transaction aborted'
        db.close()
        reject(new Error(`Document storage aborted for "${record.name}": ${message}`))
      }
    } catch (err) {
      db.close()
      reject(
        new Error(
          `Unable to persist document "${record.name}" in IndexedDB: ${err?.message || 'Storage error'}`
        )
      )
    }
  })
}

async function idbGetRecord(storageKey) {
  if (!storageKey) return null
  if (customAdapter?.get) {
    return customAdapter.get(storageKey)
  }
  if (typeof indexedDB === 'undefined') return null

  const db = await openDocumentsDatabase()
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(storageKey)

      request.onsuccess = () => {
        const result = request.result || null
        db.close()
        resolve(result)
      }
      request.onerror = () => {
        const message = request.error?.message || 'IndexedDB read failed'
        db.close()
        reject(new Error(`Failed to read document from IndexedDB: ${message}`))
      }
    } catch (err) {
      db.close()
      reject(new Error(`Failed to read document from IndexedDB: ${err?.message || 'Storage error'}`))
    }
  })
}

async function idbDeleteRecord(storageKey) {
  if (!storageKey) return
  if (customAdapter?.delete) {
    await customAdapter.delete(storageKey)
    return
  }
  if (typeof indexedDB === 'undefined') return

  const db = await openDocumentsDatabase()
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(storageKey)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        const message = tx.error?.message || 'IndexedDB delete failed'
        db.close()
        reject(new Error(message))
      }
    } catch (err) {
      db.close()
      reject(err)
    }
  })
}

function normalizeDocumentEntries(rawDocuments) {
  if (!rawDocuments || typeof rawDocuments !== 'object') return []
  const normalized = {}
  if (rawDocuments.nationalId ?? rawDocuments.businessLicense) {
    normalized.nationalId = rawDocuments.nationalId ?? rawDocuments.businessLicense
  } else if ('nationalId' in rawDocuments) {
    normalized.nationalId = null
  }

  if (rawDocuments.addressProof ?? rawDocuments.taxCertificate) {
    normalized.addressProof = rawDocuments.addressProof ?? rawDocuments.taxCertificate
  } else if ('addressProof' in rawDocuments) {
    normalized.addressProof = null
  }

  return Object.entries(normalized)
}

function preparePersistablePayload(doc) {
  if (!doc) return null

  const candidateBlob =
    typeof Blob !== 'undefined' && doc.file instanceof Blob
      ? doc.file
      : typeof Blob !== 'undefined' && doc.blob instanceof Blob
      ? doc.blob
      : typeof doc.dataUrl === 'string'
      ? dataUrlToBlob(doc.dataUrl)
      : null

  const dataUrl = typeof doc.dataUrl === 'string' && doc.dataUrl.startsWith('data:') ? doc.dataUrl : null
  if (!candidateBlob && !dataUrl) {
    throw new Error(
      `Attached file "${doc.name || 'document'}" has no readable binary content to store.`
    )
  }

  return {
    blob: candidateBlob,
    dataUrl: candidateBlob ? null : dataUrl,
  }
}

export async function saveOrderDocuments(orderId, rawDocuments) {
  const entries = normalizeDocumentEntries(rawDocuments)
  if (entries.length === 0) return undefined

  const nonEmptyEntries = entries.filter(([, doc]) => Boolean(doc))
  if (nonEmptyEntries.length === 0) {
    return Object.fromEntries(entries.map(([key]) => [key, null]))
  }

  if (!isIndexedDbAvailable()) {
    throw new Error(
      'IndexedDB document storage is unavailable. Uploaded files cannot be saved safely and order submission was stopped.'
    )
  }

  const savedKeys = []
  const persistedMeta = {}

  for (const [docKey] of entries) {
    persistedMeta[docKey] = null
  }

  try {
    for (const [docKey, doc] of nonEmptyEntries) {
      const storageKey = buildDocumentStorageKey(orderId, docKey)
      const content = preparePersistablePayload(doc)
      const persistedAt = new Date().toISOString()

      await idbPutRecord({
        storageKey,
        orderId,
        docKey,
        name: doc.name,
        type: doc.type || content.blob?.type || 'application/octet-stream',
        size: Number(doc.size ?? content.blob?.size ?? 0),
        lastModified: doc.lastModified || null,
        blob: content.blob,
        dataUrl: content.dataUrl,
        persistedAt,
      })

      savedKeys.push(storageKey)
      persistedMeta[docKey] = {
        name: doc.name,
        size: Number(doc.size ?? content.blob?.size ?? 0),
        type: doc.type || content.blob?.type || 'application/octet-stream',
        lastModified: doc.lastModified || null,
        storageKey,
        storageBackend: 'indexeddb',
        persistedAt,
        hasContent: true,
      }
    }

    return persistedMeta
  } catch (err) {
    await Promise.allSettled(savedKeys.map((key) => idbDeleteRecord(key)))
    throw new Error(
      err?.message || 'Failed to save uploaded documents to browser IndexedDB storage.'
    )
  }
}

export async function loadDocumentContent(docMeta) {
  if (!docMeta) return null

  if (docMeta.storageKey && isIndexedDbAvailable()) {
    const record = await idbGetRecord(docMeta.storageKey)
    if (record) {
      const blob =
        typeof Blob !== 'undefined' && record.blob instanceof Blob
          ? record.blob
          : record.dataUrl
          ? dataUrlToBlob(record.dataUrl)
          : null

      if (blob || record.dataUrl) {
        return {
          blob,
          dataUrl: record.dataUrl || null,
          name: record.name || docMeta.name,
          type: record.type || docMeta.type || 'application/octet-stream',
          size: record.size ?? docMeta.size ?? 0,
        }
      }
    }
  }

  if (typeof docMeta.dataUrl === 'string' && docMeta.dataUrl.startsWith('data:')) {
    return {
      blob: dataUrlToBlob(docMeta.dataUrl),
      dataUrl: docMeta.dataUrl,
      name: docMeta.name,
      type: docMeta.type || 'application/octet-stream',
      size: docMeta.size ?? 0,
    }
  }

  return null
}

export async function checkDocumentAvailability(docMeta) {
  try {
    const content = await loadDocumentContent(docMeta)
    return Boolean(content)
  } catch {
    return false
  }
}

export async function deleteOrderDocuments(orderId, documents = null) {
  const keys = new Set([
    buildDocumentStorageKey(orderId, 'nationalId'),
    buildDocumentStorageKey(orderId, 'addressProof'),
  ])

  if (documents && typeof documents === 'object') {
    for (const [docKey, doc] of Object.entries(documents)) {
      if (doc?.storageKey) {
        keys.add(doc.storageKey)
      } else {
        keys.add(buildDocumentStorageKey(orderId, docKey))
      }
    }
  }

  await Promise.allSettled([...keys].map((key) => idbDeleteRecord(key)))
}

export async function triggerDocumentDownload(docMeta) {
  const content = await loadDocumentContent(docMeta)
  if (!content) {
    throw new Error(
      `Document "${docMeta?.name || 'file'}" is missing from IndexedDB/local storage and cannot be downloaded.`
    )
  }

  const filename = content.name || 'document'
  if (content.blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(content.blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500)
    return true
  }

  if (content.dataUrl) {
    const link = document.createElement('a')
    link.href = content.dataUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    return true
  }

  throw new Error(`Unable to build download link for "${filename}".`)
}

export async function openDocumentPreview(docMeta) {
  const content = await loadDocumentContent(docMeta)
  if (!content) {
    throw new Error(
      `Document "${docMeta?.name || 'file'}" is missing from IndexedDB/local storage and cannot be previewed.`
    )
  }

  if (content.blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(content.blob)
    const previewWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    if (!previewWindow) {
      await triggerDocumentDownload(docMeta)
    }
    return true
  }

  if (content.dataUrl) {
    window.open(content.dataUrl, '_blank', 'noopener,noreferrer')
    return true
  }

  throw new Error(`Unable to open preview for "${content.name || 'document'}".`)
}

export function getOrderDocumentEntries(order) {
  const docs = order?.documents || {}
  return {
    nationalId: docs.nationalId ?? docs.businessLicense ?? null,
    addressProof: docs.addressProof ?? docs.taxCertificate ?? null,
  }
}

export function getAttachedDocumentList(order) {
  const { nationalId, addressProof } = getOrderDocumentEntries(order)
  return [
    { key: 'nationalId', title: 'Citizen ID / National ID (CCCD)', doc: nationalId },
    { key: 'addressProof', title: 'Proof of Installation Address', doc: addressProof },
  ].filter((entry) => Boolean(entry.doc))
}

export function validateOrderDocumentsPresent(order) {
  const { nationalId, addressProof } = getOrderDocumentEntries(order)
  const hasNationalId = Boolean(
    nationalId && (nationalId.storageKey || nationalId.dataUrl || nationalId.hasContent)
  )
  const hasAddressProof = Boolean(
    addressProof && (addressProof.storageKey || addressProof.dataUrl || addressProof.hasContent)
  )
  const missing = []
  if (!hasNationalId) missing.push('Citizen ID / National ID (CCCD)')
  if (!hasAddressProof) missing.push('Proof of Installation Address')
  return {
    nationalId,
    addressProof,
    hasNationalId,
    hasAddressProof,
    isComplete: hasNationalId && hasAddressProof,
    missing,
  }
}


