import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
import { RunnableSequence } from '@langchain/core/runnables'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { PineconeStore } from '@langchain/pinecone'
import { Pinecone } from '@pinecone-database/pinecone'
import { Document } from 'langchain/document'
import { StreamingTextResponse } from 'ai'

export const runtime = 'edge'

const convertDocsToString = (documents: Document[]) => {
  return documents
    .map(doc => {
      return `<doc>\n${doc.pageContent}\n</doc>`
    })
    .join('\n')
}

const answerGenerationPrompt = ChatPromptTemplate.fromTemplate(`
    You are a helpful bank teller agent, skilled in assisting customers with their banking needs and inquiries.
    Using the below provided context, answer the user's question to the best of your ability using only the resources provided.
    Be informative and courteous! 

    <context>
        {context}
    </context>

    Now, answer the following question.

    {question}
`)

const historyAwarePrompt = ChatPromptTemplate.fromTemplate(`
Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:
`)

const model = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  streaming: true,
  temperature: 0
})
const pinecone = new Pinecone()

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!)

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const { messages } = json

    const question = messages[messages.length - 1].content

    const formattedChatHistory = messages
      // remove the last message which is the question.
      .slice(0, messages.length - 1)

      .map(
        (msg: { role: string; content: string }) =>
          `${msg.role}: ${msg.content}`
      )
      .join('\n')

    console.log('Question=>', question)

    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({
        modelName: 'text-embedding-3-small'
      }),
      { pineconeIndex, namespace: process.env.PINECONE_NAME_SPACE! }
    )

    const retriever = vectorStore.asRetriever()

    const historyAwareQuestionGenerationChain = RunnableSequence.from([
      () => ({
        chat_history: formattedChatHistory,
        question: question
      }),
      historyAwarePrompt,
      model,
      new StringOutputParser()
    ])

    const documentRetrievalChain = RunnableSequence.from([
      historyAwareQuestionGenerationChain,
      retriever,
      convertDocsToString
    ])

    const conversationalChain = RunnableSequence.from([
      {
        context: documentRetrievalChain,
        question: input => input.question
      },
      answerGenerationPrompt,
      model,
      new StringOutputParser()
    ])

    const res = await conversationalChain.stream({
      question
    })

    return new StreamingTextResponse(res)
  } catch (error) {
    console.error('error', error)
    console.trace(error)
    return new Response('Failed to process request', { status: 500 })
  }
}
