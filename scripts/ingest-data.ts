import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from '@langchain/openai'
// import { pinecone } from '@/utils/pinecone-client';
import { CustomPDFLoader } from '@/utils/customPDFLoader'
// import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory'
import fs from 'fs'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { Pinecone } from '@pinecone-database/pinecone'
import { PineconeStore } from '@langchain/pinecone'

/* Name of directory to retrieve your files from */
const filePath = 'books/Harry Potter - Book 1 - The Sorcerers Stone.pdf'

export const run = async () => {
  try {
    /*load raw docs from the all files in the directory */
    // const directoryLoader = new DirectoryLoader(filePath, {
    //   '.pdf': path => new CustomPDFLoader(path)
    // })

    const loader = new PDFLoader(filePath)
    // const rawDocs = await directoryLoader.load()

    const rawDocs = await loader.load()

    // console.log('rawDocs', rawDocs.length)

    /* Split text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    })

    const docs = await textSplitter.splitDocuments(rawDocs)

    // const pinecone = new Pinecone()

    // const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!)

    // const embeddings = new OpenAIEmbeddings()

    // const vectorStore = await PineconeStore.fromDocuments(docs, embeddings, {
    //   pineconeIndex,
    //   maxConcurrency: 5
    // })

    // console.log('vectorStore', vectorStore)

    // console.log('split docs', docs[0].metadata.loc)

    // const embeddings = new OpenAIEmbeddings({
    //   modelName: 'text-embedding-3-small'
    // })

    // const vectors = await embeddings.embedDocuments(
    //   docs.slice(0, 10).map(d => d.pageContent)
    // )

    // console.log('vectors', vectors)

    // save the vectors to a file.
    // fs.writeFileSync('vectors.json', JSON.stringify(vectors))

    // console.log('creating vector store...');
    // /*create and store the embeddings in the vectorStore*/
    // const embeddings = new OpenAIEmbeddings();
    // const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

    // //embed the PDF documents
    // await PineconeStore.fromDocuments(docs, embeddings, {
    //   pineconeIndex: index,
    //   namespace: PINECONE_NAME_SPACE,
    //   textKey: 'text',
    // });
  } catch (error) {
    console.log('error', error)
    throw new Error('Failed to ingest your data')
  }
}
;(async () => {
  await run()
  console.log('ingestion complete')
})()
