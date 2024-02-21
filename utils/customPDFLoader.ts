import { Document } from 'langchain/document'
import { readFile } from 'fs/promises'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import pdf from 'pdf-parse'

export abstract class BufferLoader extends PDFLoader {
  constructor(public filePathOrBlob: string | Blob) {
    super(filePathOrBlob)
  }

  public abstract parse(
    raw: Buffer,
    metadata: Document['metadata']
  ): Promise<Document[]>

  public async load(): Promise<Document[]> {
    let buffer: Buffer
    let metadata: Record<string, string>
    if (typeof this.filePathOrBlob === 'string') {
      buffer = await readFile(this.filePathOrBlob)
      metadata = { source: this.filePathOrBlob }
    } else {
      buffer = await this.filePathOrBlob
        .arrayBuffer()
        .then(ab => Buffer.from(ab))
      metadata = { source: 'blob', blobType: this.filePathOrBlob.type }
    }
    return this.parse(buffer, metadata)
  }
}

export class CustomPDFLoader extends BufferLoader {
  public async parse(
    raw: Buffer,
    metadata: Document['metadata']
  ): Promise<Document[]> {
    const parsed = await pdf(raw)
    return [
      new Document({
        pageContent: parsed.text,
        metadata: {
          ...metadata,
          pdf_numpages: parsed.numpages
        }
      })
    ]
  }
}
