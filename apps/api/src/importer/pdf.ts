import parsePDF from 'pdf-parse'

const pdfVersion = 'v1.10.100'
// pdf-parse does not expose this pdf.js option through its parser options.
const pdfjs = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js') as {
  PDFJS: { isEvalSupported: boolean }
}
pdfjs.PDFJS.isEvalSupported = false

type TextItem = {
  str: string
  transform: number[]
  width: number
}
type PDFPage = {
  getTextContent(options: { normalizeWhitespace: boolean }): Promise<{ items: TextItem[] }>
}

async function renderPage(page: PDFPage): Promise<string> {
  const { items } = await page.getTextContent({ normalizeWhitespace: true })
  const rows: Array<{ y: number; items: TextItem[] }> = []
  for (const item of items) {
    if (!item.str.trim()) continue
    const y = item.transform[5]
    const last = rows[rows.length - 1]
    if (last && Math.abs(y - last.y) < 2) last.items.push(item)
    else rows.push({ y, items: [item] })
  }
  return rows.map((row) => {
    const pieces = row.items.sort((left, right) => left.transform[4] - right.transform[4])
    let text = pieces[0].str
    let end = pieces[0].transform[4] + pieces[0].width
    for (const piece of pieces.slice(1)) {
      const gap = piece.transform[4] - end
      const size = Math.max(8, Math.abs(piece.transform[3]))
      const separator = gap > size * 1.2 ? '\t' : gap > size * 0.15 ? ' ' : ''
      text += separator + piece.str
      end = piece.transform[4] + piece.width
    }
    return text
  }).join('\n')
}

export async function extractPDF(buffer: Buffer): Promise<string> {
  const options: parsePDF.Options = {
    max: 100,
    version: pdfVersion,
    // The package types only describe synchronous callbacks, but the parser awaits this result.
    pagerender: renderPage as unknown as NonNullable<parsePDF.Options['pagerender']>,
  }
  // This pdf.js release does not handle Node Buffer as a plain byte array.
  const data = Uint8Array.from(buffer) as unknown as Buffer
  return (await parsePDF(data, options)).text
}
