import {
  ChatPromptTemplate,
  MessagesPlaceholder
} from '@langchain/core/prompts'
import { RunnableWithMessageHistory } from '@langchain/core/runnables'
import { DynamicTool } from '@langchain/core/tools'
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
import { PineconeStore } from '@langchain/pinecone'
import { Pinecone } from '@pinecone-database/pinecone'
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents'
import { ChatMessageHistory } from 'langchain/stores/message/in_memory'
import { createRetrieverTool } from 'langchain/tools/retriever'

import { StreamingTextResponse } from 'ai'

export const runtime = 'edge'

const balanceFetchingTool = new DynamicTool({
  name: 'get_balance',
  description:
    'This function will return the user account balance based on the account number provided',

  func: async (accountNumber: string) => {
    if (!accountNumber) return 'Ask for an account number'
    const balance = Math.floor(Math.random() * 100000)

    return balance.toString()
  }
})

const accountStatementTool = new DynamicTool({
  name: 'get_account_statement',
  description:
    'This function will return the account statement based on the account number, from date and to date provided',
  func: async (input?: string) => {
    if (!input)
      'Ask for the account number, from date and to date. All three of them should be provided'

    const fakeStatement = []
    for (let i = 1; i <= 5; i++) {
      fakeStatement.push({
        transaction_date: new Date(
          new Date().setDate(new Date().getDate() - i)
        ).toLocaleDateString(),
        transaction_type: ['DEBIT', 'CREDIT'][Math.floor(Math.random() * 2)],
        transaction_amount: Math.floor(Math.random() * 100).toString(),
        transaction_balance: Math.floor(Math.random() * 10000).toString()
      })
    }

    return JSON.stringify(fakeStatement)
  }
})

const transferFundsTool = new DynamicTool({
  name: 'transfer_funds',
  description:
    'This function will transfer funds from one account to other account. The from and to account numbers and amount will be provided',
  func: async (input: string) => {
    console.log('input', input)

    if (!input) 'Ask for from and to account number and amount to transfer'

    return 'Funds transferred successfully'
  }
})

function iteratorToStream(iterator: any) {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next()

      if (done) {
        controller.close()
      } else {
        controller.enqueue(value)
      }
    }
  })
}

const encoder = new TextEncoder()

const sleep = async (time: number) => {
  return new Promise(resolve => setTimeout(resolve, time))
}

async function* makeIterator(res: any) {
  for await (const event of res) {
    const eventType = event.event

    if (eventType === 'on_llm_stream') {
      const content = event.data?.chunk?.message?.content
      // Empty content in the context of OpenAI means
      // that the model is asking for a tool to be invoked via function call.
      // So we only print non-empty content
      if (content !== undefined && content !== '') {
        yield encoder.encode(`${content}`)
        await sleep(20)
      }
    }
  }
}

const model = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0,
  streaming: true
})
const pinecone = new Pinecone()

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!)

const messageHistory = new ChatMessageHistory()

export async function POST(req: Request) {
  try {
    const json = await req.json()

    const { messages, sessionId } = json

    const question = messages[messages.length - 1].content

    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({
        modelName: 'text-embedding-3-small'
      }),
      { pineconeIndex, namespace: process.env.PINECONE_NAME_SPACE! }
    )

    const retriever = vectorStore.asRetriever()

    const retrieverTool = createRetrieverTool(retriever, {
      name: 'bank_teller_qna',
      description:
        'Useful when you need to answer questions about the banking system.'
    })

    const tools = [
      retrieverTool,
      balanceFetchingTool,
      accountStatementTool,
      transferFundsTool
    ]

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You are a helpful assistant, that answers questions about the banking system based on the provided chat history'
      ],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad')
    ])

    const agent = await createOpenAIFunctionsAgent({
      llm: model,
      tools,
      prompt
    })

    const agentExecutor = new AgentExecutor({
      agent,
      tools
    })

    const agentWithChatHistory = new RunnableWithMessageHistory({
      runnable: agentExecutor,
      getMessageHistory: _sessionId => {
        return messageHistory
      },
      inputMessagesKey: 'input',
      historyMessagesKey: 'chat_history'
    })

    const res = agentWithChatHistory.streamEvents(
      {
        input: question
      },
      {
        version: 'v1',
        configurable: {
          sessionId
        }
      }
    )

    const iterator = makeIterator(res)
    const stream = iteratorToStream(iterator)

    return new StreamingTextResponse(stream)
  } catch (error) {
    console.error('error', error)
    console.trace(error)
    return new Response('Failed to process request', { status: 500 })
  }
}
