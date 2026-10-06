import {
  BarChartOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileTextOutlined,
  LoadingOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Actions, Bubble, Conversations, Sender, Sources } from '@ant-design/x'
import type { BubbleItemType } from '@ant-design/x'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Drawer, List, Popconfirm, Tag, Tooltip, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  chatsCreateMutation,
  chatsDeleteMutation,
  chatsListOptions,
  chatsListQueryKey,
  documentsDeleteMutation,
  documentsListOptions,
  documentsListQueryKey,
  documentsUploadMutation,
  messagesCreateMutation,
  messagesListOptions,
  messagesListQueryKey,
} from './client/@tanstack/react-query.gen.ts'
import type { DocumentOut, MessageOut, SourceOut } from './client/types.gen.ts'

const SIDER_KEY = 'ragmad-sider-width'
const SIDER_MIN = 220
const SIDER_MAX = 460
const SIDER_DEFAULT = 288

function storedSiderWidth() {
  const stored = Number(localStorage.getItem(SIDER_KEY))
  if (Number.isFinite(stored) && stored >= SIDER_MIN && stored <= SIDER_MAX) return stored
  return SIDER_DEFAULT
}

function errorText(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'detail' in error) {
    const detail = (error as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
  }
  if (error instanceof Error) return error.message
  return 'Request failed'
}

function excerpt(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length > 280 ? `${compact.slice(0, 280)}…` : compact
}

function statusTag(document: DocumentOut) {
  if (document.status === 'processing') {
    return (
      <Tag icon={<LoadingOutlined spin />} color="processing">
        Processing
      </Tag>
    )
  }
  if (document.status === 'ready') {
    return <Tag color="success">Ready</Tag>
  }
  return (
    <Tooltip title={document.error ?? 'The document could not be processed'}>
      <Tag color="error">Failed</Tag>
    </Tooltip>
  )
}

function AssistantContent({ message: item }: { message: MessageOut }) {
  const sources = (item.sources ?? []) as SourceOut[]
  return (
    <div>
      <div className="chat-markdown">
        <ReactMarkdown>{item.content}</ReactMarkdown>
      </div>
      {sources.length > 0 ? (
        <Sources
          title="Sources"
          items={sources.map((source, index) => ({
            key: `${source.document_id ?? 'source'}-${index}`,
            title: `${source.filename ?? 'Document'}${source.page != null ? ` · p. ${source.page}` : ''}`,
            description: excerpt(source.text),
          }))}
        />
      ) : null}
    </div>
  )
}

function MessageActions({ text }: { text: string }) {
  const { message } = App.useApp()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      message.success('Copied')
    } catch {
      message.error('Could not copy this answer')
    }
  }

  const share = async () => {
    const payload = { title: 'RAGMAD', text }
    if (navigator.share) {
      try {
        await navigator.share(payload)
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
      }
    }
    await copy()
  }

  return (
    <Actions
      className="message-actions"
      variant="borderless"
      items={[
        { key: 'copy', label: 'Copy', icon: <CopyOutlined />, onItemClick: () => void copy() },
        { key: 'share', label: 'Share', icon: <UploadOutlined />, onItemClick: () => void share() },
      ]}
    />
  )
}

export default function ChatPage() {
  const { message } = App.useApp()
  const { chatId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [siderWidth, setSiderWidth] = useState(storedSiderWidth)
  const [resizing, setResizing] = useState(false)

  const chats = useQuery(chatsListOptions())
  const documents = useQuery({
    ...documentsListOptions({ path: { chat_id: chatId ?? '' } }),
    enabled: Boolean(chatId),
    refetchInterval: (query) => {
      const rows = query.state.data
      return rows?.some((document) => document.status === 'processing') ? 2000 : false
    },
  })
  const messages = useQuery({
    ...messagesListOptions({ path: { chat_id: chatId ?? '' } }),
    enabled: Boolean(chatId),
  })

  const refreshChats = () => queryClient.invalidateQueries({ queryKey: chatsListQueryKey() })
  const refreshDocuments = () => {
    if (!chatId) return
    queryClient.invalidateQueries({
      queryKey: documentsListQueryKey({ path: { chat_id: chatId } }),
    })
  }
  const refreshMessages = () => {
    if (!chatId) return
    queryClient.invalidateQueries({
      queryKey: messagesListQueryKey({ path: { chat_id: chatId } }),
    })
  }

  const createChat = useMutation({
    ...chatsCreateMutation(),
    onSuccess: (chat) => {
      refreshChats()
      navigate(`/chats/${chat.id}`)
    },
    onError: (error) => message.error(errorText(error)),
  })

  const removeChat = useMutation({
    ...chatsDeleteMutation(),
    onSuccess: () => {
      refreshChats()
      navigate('/')
    },
    onError: (error) => message.error(errorText(error)),
  })

  const upload = useMutation({
    ...documentsUploadMutation(),
    onSuccess: () => refreshDocuments(),
    onError: (error) => message.error(errorText(error)),
  })

  const removeDocument = useMutation({
    ...documentsDeleteMutation(),
    onSuccess: () => refreshDocuments(),
    onError: (error) => message.error(errorText(error)),
  })

  const send = useMutation({
    ...messagesCreateMutation(),
    onSuccess: () => {
      setDraft('')
      refreshMessages()
      refreshChats()
    },
    onError: (error) => message.error(errorText(error)),
  })

  const ready = (documents.data ?? []).some((document) => document.status === 'ready')
  const current = (chats.data ?? []).find((chat) => chat.id === chatId)
  const uploadRequest: UploadProps['customRequest'] = (options) => {
    if (!chatId || !(options.file instanceof File)) {
      options.onError?.(new Error('Choose a chat before uploading'))
      return
    }
    upload
      .mutateAsync({
        path: { chat_id: chatId },
        body: { files: [options.file] },
      })
      .then((created) => options.onSuccess?.(created))
      .catch((error: unknown) => {
        options.onError?.(error instanceof Error ? error : new Error(errorText(error)))
      })
  }

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = siderWidth
    let latest = startWidth
    setResizing(true)
    const move = (moveEvent: PointerEvent) => {
      latest = Math.min(SIDER_MAX, Math.max(SIDER_MIN, startWidth + moveEvent.clientX - startX))
      setSiderWidth(latest)
    }
    const stop = () => {
      setResizing(false)
      localStorage.setItem(SIDER_KEY, String(latest))
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const bubbles: BubbleItemType[] = (messages.data ?? []).map((item) => ({
    key: item.id,
    role: item.role,
    content: item.role === 'assistant' ? <AssistantContent message={item} /> : item.content,
    footer: item.role === 'assistant' ? <MessageActions text={item.content} /> : undefined,
    footerPlacement: 'outer-start',
  }))
  if (send.isPending) {
    const pendingQuestion = send.variables?.body?.content
    if (pendingQuestion) {
      bubbles.push({ key: 'pending-user', role: 'user', content: pendingQuestion })
    }
    bubbles.push({ key: 'pending', role: 'assistant', content: '', loading: true })
  }

  return (
    <div className={resizing ? 'workspace is-resizing' : 'workspace'}>
      <aside className="sidebar" style={{ width: siderWidth }}>
        <div className="sidebar-brand">
          <span className="brand-mark">R</span>
          <div>
            <div className="brand-name">RAGMAD</div>
            <div className="brand-sub">Ask your documents</div>
          </div>
        </div>
        <button
          className="new-chat"
          type="button"
          disabled={createChat.isPending}
          onClick={() => createChat.mutate({ body: {} })}
        >
          <PlusOutlined />
          New chat
        </button>
        <div className="chat-list">
          <Conversations
            items={(chats.data ?? []).map((chat) => ({
              key: chat.id,
              label: chat.title,
            }))}
            activeKey={chatId}
            onActiveChange={(key) => navigate(`/chats/${key}`)}
          />
        </div>
        <Link to="/evaluation" className="eval-sidebar-link">
          <BarChartOutlined />
          Evaluation
        </Link>
        <button
          type="button"
          className="sider-handle"
          aria-label="Resize sidebar"
          aria-valuenow={siderWidth}
          aria-valuemin={SIDER_MIN}
          aria-valuemax={SIDER_MAX}
          onPointerDown={startResize}
          onDoubleClick={() => {
            setSiderWidth(SIDER_DEFAULT)
            localStorage.setItem(SIDER_KEY, String(SIDER_DEFAULT))
          }}
        />
      </aside>
      <section className="stage">
        <header className="topbar">
          <h1 className="chat-title">{current?.title ?? 'RAGMAD'}</h1>
          {chatId ? (
            <div className="topbar-actions">
              <Button className="quiet-button" icon={<FileTextOutlined />} onClick={() => setDrawerOpen(true)}>
                Documents ({documents.data?.length ?? 0})
              </Button>
              <Popconfirm
                title="Delete this chat?"
                description="The conversation and its files will be removed."
                onConfirm={() => removeChat.mutate({ path: { chat_id: chatId } })}
              >
                <Button className="icon-button" aria-label="Delete chat" icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          ) : null}
        </header>
        <div className="thread">
          <div className="thread-inner">
            {chatId ? (
              <Bubble.List
                style={{ height: '100%' }}
                autoScroll
                role={{
                  user: {
                    placement: 'end',
                    variant: 'filled',
                    shape: 'round',
                    styles: { content: { background: '#1f4d45', color: '#f7f4ee' } },
                  },
                  assistant: {
                    placement: 'start',
                    variant: 'outlined',
                    shape: 'round',
                    styles: {
                      content: {
                        background: '#fffdf9',
                        border: '1px solid #e4ddd2',
                        color: '#1c1915',
                      },
                    },
                  },
                }}
                items={bubbles}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-card">
                  <span className="brand-mark">R</span>
                  <h2>Start with a document</h2>
                  <p>Create a chat, upload a file, and ask questions once it is ready.</p>
                  <button
                    className="new-chat"
                    type="button"
                    disabled={createChat.isPending}
                    onClick={() => createChat.mutate({ body: {} })}
                  >
                    <PlusOutlined />
                    New chat
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <footer className="composer">
          <div className="composer-inner">
            {chatId && !ready ? (
              <p className="composer-hint">Upload a document and wait until it is ready.</p>
            ) : null}
            <Sender
              value={draft}
              onChange={(value) => setDraft(value)}
              loading={send.isPending}
              disabled={!chatId || !ready}
              placeholder={ready ? 'Ask a question about the documents' : 'Waiting for a ready document'}
              prefix={
                <Upload multiple showUploadList={false} customRequest={uploadRequest} disabled={!chatId}>
                  <Button
                    className="attach"
                    aria-label="Upload documents"
                    icon={<PlusOutlined />}
                    disabled={!chatId}
                  />
                </Upload>
              }
              onSubmit={(content) => {
                if (!chatId || !content.trim() || !ready) return
                send.mutate({ path: { chat_id: chatId }, body: { content: content.trim() } })
              }}
            />
          </div>
        </footer>
      </section>
      <Drawer
        title="Documents in this chat"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size={420}
      >
        <List
          dataSource={documents.data ?? []}
          locale={{ emptyText: 'No documents yet. Use the plus button in the composer.' }}
          renderItem={(document) => (
            <List.Item
              actions={[
                <Button
                  key="download"
                  type="text"
                  icon={<DownloadOutlined />}
                  href={`/api/documents/${document.id}/download`}
                  target="_blank"
                >
                  Download
                </Button>,
                <Popconfirm
                  key="delete"
                  title="Remove this document?"
                  onConfirm={() => removeDocument.mutate({ path: { document_id: document.id } })}
                >
                  <Button type="text" danger icon={<DeleteOutlined />}>
                    Delete
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta title={document.filename} description={statusTag(document)} />
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  )
}
