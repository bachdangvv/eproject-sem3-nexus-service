const DIACRITIC_REPLACEMENTS = {
  đ: 'd',
  Đ: 'D',
  '–': '-',
  '—': '-',
  '•': '-',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
  '≤': '<=',
  '≥': '>=',
  '✓': '[x]',
}

const HELVETICA_WIDTHS = {
  ' ': 0.278,
  '!': 0.278,
  '"': 0.355,
  '#': 0.556,
  $: 0.556,
  '%': 0.889,
  '&': 0.667,
  "'": 0.191,
  '(': 0.333,
  ')': 0.333,
  '*': 0.389,
  '+': 0.584,
  ',': 0.278,
  '-': 0.333,
  '.': 0.278,
  '/': 0.278,
  ':': 0.278,
  ';': 0.278,
  '=': 0.584,
  '?': 0.556,
  '@': 1.015,
  '[': 0.278,
  ']': 0.278,
  _: 0.556,
  '|': 0.26,
}

/**
 * Normalizes Unicode and Vietnamese characters to printable WinAnsi/ASCII for standard PDF fonts.
 */
export function toPdfSafeText(input = '') {
  const replaced = String(input ?? '').replace(
    /[đĐ–—“”‘’≤≥✓•]/g,
    (ch) => DIACRITIC_REPLACEMENTS[ch] || ch
  )
  const normalized = replaced.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return normalized.replace(/[^\x20-\x7E]/g, ' ')
}

function escapePdfString(text = '') {
  return toPdfSafeText(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function estimateTextWidth(text = '', fontSize = 10, bold = false) {
  const safe = toPdfSafeText(text)
  let units = 0
  for (let i = 0; i < safe.length; i++) {
    const ch = safe[i]
    if (HELVETICA_WIDTHS[ch] !== undefined) {
      units += HELVETICA_WIDTHS[ch]
    } else if (ch >= '0' && ch <= '9') {
      units += 0.556
    } else if (ch >= 'A' && ch <= 'Z') {
      units += ch === 'I' ? 0.278 : ch === 'W' || ch === 'M' ? 0.85 : 0.667
    } else if (ch >= 'a' && ch <= 'z') {
      units += ch === 'i' || ch === 'l' ? 0.222 : ch === 'm' || ch === 'w' ? 0.78 : 0.52
    } else {
      units += 0.556
    }
  }
  return units * fontSize * (bold ? 1.05 : 1)
}

export function wrapPdfText(text = '', maxChars = 72) {
  const safe = toPdfSafeText(text).trim()
  if (!safe) return ['']
  const words = safe.split(/\s+/)
  const lines = []
  let current = ''

  for (const word of words) {
    if (!current) {
      if (word.length <= maxChars) {
        current = word
      } else {
        for (let i = 0; i < word.length; i += maxChars) {
          const slice = word.slice(i, i + maxChars)
          if (i + maxChars < word.length) lines.push(slice)
          else current = slice
        }
      }
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`
    } else {
      lines.push(current)
      if (word.length <= maxChars) {
        current = word
      } else {
        current = ''
        for (let i = 0; i < word.length; i += maxChars) {
          const slice = word.slice(i, i + maxChars)
          if (i + maxChars < word.length) lines.push(slice)
          else current = slice
        }
      }
    }
  }

  if (current) lines.push(current)
  return lines
}

/**
 * Stateful A4 PDF 1.4 layout builder outputting a valid multi-page Uint8Array binary.
 */
export function createPdfBuilder() {
  const PAGE_WIDTH = 595
  const PAGE_HEIGHT = 842
  const TOP_Y = 795
  const BOTTOM_MARGIN = 55
  const pages = [[]]
  let currentY = TOP_Y

  function currentCommands() {
    return pages[pages.length - 1]
  }

  function addPage() {
    pages.push([])
    currentY = TOP_Y
    return currentY
  }

  function ensureSpace(heightNeeded = 20) {
    if (currentY - heightNeeded < BOTTOM_MARGIN) {
      addPage()
      return true
    }
    return false
  }

  function getY() {
    return currentY
  }

  function setY(y) {
    currentY = y
  }

  function moveDown(delta) {
    currentY -= delta
    return currentY
  }

  function drawRect(x, yBottom, width, height, { fillColor = null, strokeColor = null, lineWidth = 0.75 } = {}) {
    const cmds = currentCommands()
    cmds.push('q')
    if (fillColor) cmds.push(`${fillColor[0]} ${fillColor[1]} ${fillColor[2]} rg`)
    if (strokeColor) {
      cmds.push(`${lineWidth} w`)
      cmds.push(`${strokeColor[0]} ${strokeColor[1]} ${strokeColor[2]} RG`)
    }
    cmds.push(`${x.toFixed(2)} ${yBottom.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`)
    if (fillColor && strokeColor) cmds.push('B')
    else if (fillColor) cmds.push('f')
    else if (strokeColor) cmds.push('S')
    cmds.push('Q')
  }

  function drawLine(x1, y1, x2, y2, color = [0.85, 0.88, 0.92], lineWidth = 0.75) {
    const cmds = currentCommands()
    cmds.push('q')
    cmds.push(`${lineWidth} w`)
    cmds.push(`${color[0]} ${color[1]} ${color[2]} RG`)
    cmds.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`)
    cmds.push('Q')
  }

  function drawText(text, x, y, { size = 10, bold = false, color = [0.12, 0.16, 0.23], align = 'left' } = {}) {
    const fontKey = bold ? '/F2' : '/F1'
    let drawX = x
    if (align === 'right') {
      drawX = x - estimateTextWidth(text, size, bold)
    } else if (align === 'center') {
      drawX = x - estimateTextWidth(text, size, bold) / 2
    }
    const escaped = escapePdfString(text)
    const cmds = currentCommands()
    cmds.push('BT')
    cmds.push(`${fontKey} ${size} Tf`)
    cmds.push(`${color[0]} ${color[1]} ${color[2]} rg`)
    cmds.push(`1 0 0 1 ${drawX.toFixed(2)} ${y.toFixed(2)} Tm`)
    cmds.push(`(${escaped}) Tj`)
    cmds.push('ET')
  }

  function buildBytes() {
    const encoder = new TextEncoder()
    const objects = []

    const pageStartId = 5
    const pageIds = pages.map((_, idx) => pageStartId + idx * 2)

    objects.push({ id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' })
    objects.push({
      id: 2,
      body: `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    })
    objects.push({
      id: 3,
      body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    })
    objects.push({
      id: 4,
      body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    })

    pages.forEach((cmds, idx) => {
      const pageId = pageStartId + idx * 2
      const contentId = pageId + 1
      const streamData = cmds.join('\n')
      const streamByteLength = encoder.encode(streamData).length

      objects.push({
        id: pageId,
        body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
      })
      objects.push({
        id: contentId,
        body: `<< /Length ${streamByteLength} >>\nstream\n${streamData}\nendstream`,
      })
    })

    const chunks = []
    let byteOffset = 0
    const xrefOffsets = new Array(objects.length + 1).fill(0)

    const pushAscii = (str) => {
      const bytes = encoder.encode(str)
      chunks.push(bytes)
      byteOffset += bytes.length
    }

    const pushRaw = (bytes) => {
      chunks.push(bytes)
      byteOffset += bytes.length
    }

    pushAscii('%PDF-1.4\n')
    pushRaw(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

    for (const obj of objects) {
      xrefOffsets[obj.id] = byteOffset
      pushAscii(`${obj.id} 0 obj\n${obj.body}\nendobj\n`)
    }

    const xrefStart = byteOffset
    pushAscii(`xref\n0 ${objects.length + 1}\n`)
    pushAscii('0000000000 65535 f \n')
    for (let id = 1; id <= objects.length; id++) {
      pushAscii(`${String(xrefOffsets[id]).padStart(10, '0')} 00000 n \n`)
    }

    pushAscii(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
    )

    const totalBytes = chunks.reduce((sum, arr) => sum + arr.length, 0)
    const output = new Uint8Array(totalBytes)
    let cursor = 0
    for (const chunk of chunks) {
      output.set(chunk, cursor)
      cursor += chunk.length
    }
    return output
  }

  return {
    PAGE_WIDTH,
    PAGE_HEIGHT,
    ensureSpace,
    addPage,
    getY,
    setY,
    moveDown,
    drawRect,
    drawLine,
    drawText,
    buildBytes,
  }
}
