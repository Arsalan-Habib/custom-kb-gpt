import { kv } from '@vercel/kv'
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
import { RunnableSequence, RunnableMap } from '@langchain/core/runnables'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { OpenAIStream, StreamingTextResponse } from 'ai'
import OpenAI from 'openai'

import { auth } from '@/auth'
import { nanoid } from '@/lib/utils'
import { PineconeStore } from '@langchain/pinecone'
import { Pinecone } from '@pinecone-database/pinecone'
import { Document } from 'langchain/document'

const convertDocsToString = (documents: Document[]) => {
  return documents
    .map(doc => {
      return `<doc>\n${doc.pageContent}\n</doc>`
    })
    .join('\n')
}

export const TEMPLATE_STRING = `
    You are an experienced researcher, expert at interpreting and answering questions based on the provided sources.
    Using the below provided context, answer the user's question to the best of your ability using only the resources provided.
    Be verbose!

    <context>
        {context}
    </context>

    Now, answer the following question.

    {question}
`

export const runtime = 'edge'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const model = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  streaming: true
})
const pinecone = new Pinecone()

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!)

export async function POST(req: Request) {
  const json = await req.json()
  const { messages, previewToken } = json
  console.log('messages =>', messages)
  if (previewToken) {
    openai.apiKey = previewToken
  }

  const vectorstore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings(),
    { pineconeIndex }
  )

  const retriever = vectorstore.asRetriever()

  const documentRetrievalChain = RunnableSequence.from([
    input => input.question,
    retriever,
    convertDocsToString
  ])

  const answerGenerationPrompt =
    ChatPromptTemplate.fromTemplate(TEMPLATE_STRING)

  const retrievalChain = RunnableSequence.from([
    {
      context: documentRetrievalChain,
      question: input => input.question
    },
    answerGenerationPrompt,
    model,
    new StringOutputParser()
  ])

  // const res = await openai.chat.completions.create({
  //   model: 'gpt-3.5-turbo',
  //   messages,
  //   temperature: 0.7,
  //   stream: true
  // })

  const res = await retrievalChain.stream({
    question: messages[messages.length - 1].content
  })

  // const stream = OpenAIStream(res, {
  //   async onCompletion(completion) {
  //     const title = json.messages[0].content.substring(0, 100)
  //     const id = json.id ?? nanoid()
  //     const createdAt = Date.now()
  //     const path = `/chat/${id}`
  //     const payload = {
  //       id,
  //       title,
  //       // userId,
  //       createdAt,
  //       path,
  //       messages: [
  //         ...messages,
  //         {
  //           content: completion,
  //           role: 'assistant'
  //         }
  //       ]
  //     }
  //     // await kv.hmset(`chat:${id}`, payload)
  //     // await kv.zadd(`user:chat:${userId}`, {
  //     //   score: createdAt,
  //     //   member: `chat:${id}`
  //     // })
  //   }
  // })

  return new StreamingTextResponse(res)
}
