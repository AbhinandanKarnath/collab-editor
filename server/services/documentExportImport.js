import { Document, Packer, Paragraph, TextRun } from 'docx'
import PDFDocument from 'pdfkit'
import mammoth from 'mammoth'

function safeFilename(title, ext) {
  const base = (title || 'document').replace(/[<>:"/\\|?*]/g, '').trim().slice(0, 80) || 'document'
  return `${base}.${ext}`
}

export function getExportFilename(title, format) {
  const ext = format === 'pdf' ? 'pdf' : format === 'docx' ? 'docx' : 'md'
  return safeFilename(title, ext)
}

export async function buildDocxBuffer(text) {
  const lines = (text || '').split(/\r?\n/)
  const children = lines.map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line.length ? line : ' ', font: 'Calibri' })],
      })
  )
  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun(' ')] }))
  }
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })
  return Packer.toBuffer(doc)
}

export function buildPdfBuffer(text) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.fontSize(11).font('Helvetica')
    doc.text(text || '(empty)', {
      width: 500,
      align: 'left',
    })
    doc.end()
  })
}

export async function parseImportBuffer(buffer, mimetype, originalname = '') {
  const name = (originalname || '').toLowerCase()
  if (name.endsWith('.md') || mimetype === 'text/markdown' || mimetype === 'text/plain') {
    return buffer.toString('utf8')
  }
  if (
    name.endsWith('.docx') ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  }
  if (name.endsWith('.pdf') || mimetype === 'application/pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      return data.text || ''
    } catch (e) {
      throw new Error(
        `PDF import failed (${e.message}). Try a text-based PDF or use .md / .docx.`
      )
    }
  }
  throw new Error('Unsupported file type. Use .md, .docx, or .pdf')
}

export { safeFilename }
