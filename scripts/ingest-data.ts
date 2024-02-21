import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from '@langchain/openai'
import { PineconeStore } from 'langchain/vectorstores/pinecone'
// import { pinecone } from '@/utils/pinecone-client';
import { CustomPDFLoader } from '@/utils/customPDFLoader'
// import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory'
import fs from 'fs'

/* Name of directory to retrieve your files from */
const filePath = 'books'

export const run = async () => {
  try {
    /*load raw docs from the all files in the directory */
    const directoryLoader = new DirectoryLoader(filePath, {
      '.pdf': path => new CustomPDFLoader(path)
    })

    // const loader = new PDFLoader(filePath);
    const rawDocs = await directoryLoader.load()

    /* Split text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    })

    const docs = await textSplitter.splitDocuments(rawDocs)
    console.log('split docs', docs[0].metadata.loc)

    const embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small'
    })

    const vectors = await embeddings.embedDocuments(
      docs.slice(0, 10).map(d => d.pageContent)
    )

    console.log('vectors', vectors)

    // save the vectors to a file.
    fs.writeFileSync('vectors.json', JSON.stringify(vectors))

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
