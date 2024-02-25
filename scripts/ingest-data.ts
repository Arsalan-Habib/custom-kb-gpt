import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from '@langchain/openai'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { Pinecone } from '@pinecone-database/pinecone'
import { PineconeStore } from '@langchain/pinecone'

const filePath = 'docs/chase-account-guide.pdf'

export const populatePineconeVectorStore = async (filePath: string) => {
  try {
    console.log('Initializing document ingestion!')
    const loader = new PDFLoader(filePath)

    const rawDocs = await loader.load()

    /* Split text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    })

    const splitDocuments = await textSplitter.splitDocuments(rawDocs)

    const pinecone = new Pinecone()

    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!)

    const embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small'
    })

    const vectorStore = await PineconeStore.fromDocuments(
      splitDocuments,
      embeddings,
      {
        pineconeIndex,
        namespace: process.env.PINECONE_NAME_SPACE!,
        textKey: 'text'
      }
    )

    return vectorStore
  } catch (error) {
    console.log('error', error)
    throw new Error('Failed to initialize pinecone store')
  }
}

export const initializeMemoryVectorStore = async (filePath: string) => {
  try {
    const loader = new PDFLoader(filePath)

    const rawDocs = await loader.load()

    /* Split text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    })

    const splitDocuments = await textSplitter.splitDocuments(rawDocs)

    const embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small'
    })

    const vectorStore = new MemoryVectorStore(embeddings)

    await vectorStore.addDocuments(splitDocuments)

    return vectorStore
  } catch (error) {
    console.log('error', error)
    throw new Error('Failed to initialize memory vector store')
  }
}
;(async () => {
  await populatePineconeVectorStore(filePath)
  console.log('ingestion complete')
})()
