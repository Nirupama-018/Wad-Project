
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../../lib/api'
import './ChatPage.css'
import { io } from 'socket.io-client'


function formatMessageTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateLabel(timestamp) {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (first, second) =>
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()

  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear()
      ? 'numeric'
      : undefined,
  })
}





function ChatPage({ onNavigate }) {
  const [conversations, setConversations] = useState([])
const [selectedId, setSelectedId] = useState(null)
const [isLoadingConversations, setIsLoadingConversations] = useState(true)
const [conversationError, setConversationError] = useState('')
const [users, setUsers] = useState([])
const [showNewChat, setShowNewChat] = useState(false)
const [isLoadingUsers, setIsLoadingUsers] = useState(false)
const [userSearch, setUserSearch] = useState('')
  const [search, setSearch] = useState('')
  const [showMessageSearch, setShowMessageSearch] = useState(false)
  const [messageSearch, setMessageSearch] = useState('')
  const [message, setMessage] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduledText, setScheduledText] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [scheduledMessages, setScheduledMessages] = useState([])
  const [replyingTo, setReplyingTo] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
const [messageError, setMessageError] = useState('')
const [currentUserId, setCurrentUserId] = useState('')
const socketRef = useRef(null)
const selectedIdRef = useRef(selectedId)
selectedIdRef.current = selectedId
const messageAreaRef = useRef(null)
const latestMessageRef = useRef(null)

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedId,
  )
// Fetch the logged-in user's ID.
useEffect(() => {
  let cancelled = false

  async function loadCurrentUser() {
    try {
      const data = await apiRequest('/api/users/me')

      if (!cancelled) {
        setCurrentUserId(String(data.user.id))
      }
    } catch (err) {
      if (!cancelled) {
        setMessageError(err.message || 'Could not identify the logged-in user.')
      }
    }
  }

  loadCurrentUser()

  return () => {
    cancelled = true
  }
}, [])

// Connect to the authenticated Socket.IO server.
useEffect(() => {
  if (!currentUserId) return

  const socket = io(import.meta.env.VITE_API_URL ?? 'http://localhost:5000', {
  withCredentials: true,
})

socketRef.current = socket

// temporary debug logs, remove once it works
socket.on('connect', () => console.log('connected', socket.id))
socket.onAny((event, ...args) => console.log('SOCKET EVENT', event, args))

  function handleNewMessage(item) {
    const conversationId = String(item.conversationId)
    const messageId = String(item.messageId ?? item._id ?? item.id)
    const isOpen = conversationId === String(selectedIdRef.current)
    console.log('LIVE CHECK', {
  receivedConversationId: conversationId,
  openConversationId: String(selectedIdRef.current),
})

    const incoming = {
      id: messageId,
      text: item.content ?? item.text ?? '',
      sender: String(item.senderId) === String(currentUserId) ? 'me' : 'them',
      timestamp: item.timestamp ?? item.createdAt ?? new Date().toISOString(),
      status: item.status ?? 'sent',
      replyTo: null,
    }

    console.log('LIVE MESSAGE:', conversationId, 'OPEN:', selectedIdRef.current)

    setConversations((previous) =>
      previous.map((conversation) => {
        if (String(conversation.id) !== conversationId) {
          return conversation
        }

        if (conversation.messages.some((m) => String(m.id) === messageId)) {
          return conversation
        }

        return {
          ...conversation,
          messages: [...conversation.messages, incoming],
          unread: isOpen ? 0 : conversation.unread + 1,
        }
      }),
    )

    if (incoming.sender === 'them') {
      socket.emit('message:delivered', { messageId })

      if (isOpen) {
        socket.emit('message:read', { messageId })
      }
    }
  }

  function handleMessageStatus(receipt) {
    setConversations((previous) =>
      previous.map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((m) =>
          String(m.id) === String(receipt.messageId)
            ? { ...m, status: receipt.status }
            : m,
        ),
      })),
    )
  }
  function applyPresence(user) {
  const userId = String(user.userId ?? user.id ?? user._id ?? '');
  const status = user.status;

  if (!userId || !['online', 'offline', 'away'].includes(status)) {
    return;
  }

  setConversations(previous =>
    previous.map(conversation =>
      String(conversation.otherUserId) === userId
        ? { ...conversation, status }
        : conversation
    )
  );
}

function handlePresenceSnapshot(snapshot) {
  for (const user of snapshot.users ?? []) {
    applyPresence(user);
  }
}

function handlePresenceUpdate(user) {
  applyPresence(user);
}
  

  socket.on('connect_error', (error) => {
    console.error('Socket connection failed:', error.message)
  })

  socket.on('message:new', handleNewMessage)
  socket.on('message:status', handleMessageStatus)
  socket.on('presence:snapshot', handlePresenceSnapshot)
socket.on('presence:update', handlePresenceUpdate)
function reportActivity() {
  if (document.visibilityState === 'visible') {
    socket.emit('presence:activity', { isVisible: true })
  }
}

const activityEvents = [
  'pointerdown',
  'keydown',
  'mousemove',
  'scroll',
  'touchstart',
]

activityEvents.forEach(event => {
  document.addEventListener(event, reportActivity, { passive: true })
})

document.addEventListener('visibilitychange', reportActivity)

  

  return () => {
    socket.off('message:new', handleNewMessage)
    socket.off('message:status', handleMessageStatus)
    socket.off('presence:snapshot', handlePresenceSnapshot)
socket.off('presence:update', handlePresenceUpdate)
activityEvents.forEach(event => {
    document.removeEventListener(event, reportActivity)
  })

  document.removeEventListener('visibilitychange', reportActivity)
    socket.disconnect()

    if (socketRef.current === socket) {
      socketRef.current = null
    }
  }
}, [currentUserId])
useEffect(() => {
  let cancelled = false
  if (!currentUserId) return
  async function loadConversations() {
    setIsLoadingConversations(true)
    setConversationError('')

    try {
      const data = await apiRequest('/api/conversations')
      if (cancelled) return

      const list = (data.conversations ?? []).map((item) => ({
        id: item.conversationId,
        otherUserId: String(item.otherUser?.id ?? item.otherUser?._id ?? ''),
        name: item.otherUser?.name ?? 'Unknown user',
        initials: (item.otherUser?.name ?? 'U')
          .split(' ')
          .filter(Boolean)
          .map((part) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        color: '#64748b',
        status: 'offline',
        unread: 0,
        messages: item.lastMessage
  ? [{
      id: String(
        item.lastMessage.messageId ??
        item.lastMessage._id ??
        item.lastMessage.id
      ),
      text: item.lastMessage.content ?? item.lastMessage.text ?? '',
      sender:
        String(item.lastMessage.senderId) === String(currentUserId)
          ? 'me'
          : 'them',
      timestamp:
        item.lastMessage.timestamp ??
        item.lastMessage.createdAt ??
        item.lastMessageAt ??
        new Date(),
      status: item.lastMessage.status ?? 'sent',
      replyTo: null,
    }]
  : [],
      })) 

     setConversations((previous) =>
  list.map((conversation) => {
    const existing = previous.find(
      (item) => String(item.id) === String(conversation.id),
    )

    if (!existing) return conversation

    const mergedMessages = new Map()

    for (const item of [
      ...conversation.messages,
      ...existing.messages,
    ]) {
      mergedMessages.set(String(item.id), item)
    }

    return {
      ...conversation,
      ...existing,
      messages: Array.from(mergedMessages.values()).sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      ),
    }
  }),
)
      setSelectedId((currentId) =>
        list.some((item) => item.id === currentId)
          ? currentId
          : list[0]?.id ?? null,
      )
    } catch (err) {
      if (!cancelled) {
        setConversationError(
          err.message || 'Could not load conversations.',
        )
      }
    } finally {
      if (!cancelled) setIsLoadingConversations(false)
    }
  }

  loadConversations()

  return () => {
    cancelled = true
  }
}, [currentUserId])


useEffect(() => {
  if (!selectedId || !currentUserId) return

  let cancelled = false

  async function loadMessages() {
    setIsLoadingMessages(true)
    setMessageError('')

    try {
      const data = await apiRequest(
        `/api/conversations/${selectedId}/messages?limit=30`,
      )

      if (cancelled) return

      const messages = (data.messages ?? []).map((item) => ({
  id: String(item.messageId ?? item._id ?? item.id),
  text: item.content ?? item.text ?? '',
  sender: String(item.senderId) === currentUserId ? 'me' : 'them',
  timestamp: item.timestamp ?? item.createdAt ?? new Date().toISOString(),
  status: item.status ?? 'sent',
  replyTo: null,
}))

      setConversations((current) =>
  current.map((conversation) => {
    if (String(conversation.id) !== String(selectedId)) {
      return conversation
    }

    // Merge history with messages already received live.
    const merged = new Map()

    for (const item of [...messages, ...conversation.messages]) {
      merged.set(String(item.id), item)
    }

    return {
      ...conversation,
      messages: Array.from(merged.values()).sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      ),
    }
  }),
)
    } catch (err) {
      if (!cancelled) {
        setMessageError(err.message || 'Could not load message history.')
      }
    } finally {
      if (!cancelled) setIsLoadingMessages(false)
    }
  }

  loadMessages()

  return () => {
    cancelled = true
  }
}, [selectedId, currentUserId])

useEffect(() => {
  if (!selectedId) return

  latestMessageRef.current?.scrollIntoView({
    behavior: 'auto',
    block: 'end',
  })
}, [selectedId, selectedConversation?.messages.length])


function highlightText(text, query) {
  if (!query.trim()) return text

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'))

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={index} className="search-highlight">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

  const filteredConversations = useMemo(() => {
  const query = search.trim().toLowerCase()

  if (!query) return conversations

  return conversations.filter((conversation) => {
    const matchesName = conversation.name.toLowerCase().includes(query)

    const matchesMessage = conversation.messages.some((item) =>
      item.text.toLowerCase().includes(query),
    )

    return matchesName || matchesMessage
  })
}, [conversations, search])
  function selectConversation(id) {
    setSelectedId(id)
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === id ? { ...conversation, unread: 0 } : conversation,
      ),
    )
  }
  const filteredMessages = useMemo(() => {
  const query = messageSearch.trim().toLowerCase()
  const messages = selectedConversation?.messages ?? []

  if (!query) return messages

  return messages.filter((item) =>
    item.text.toLowerCase().includes(query),
  )
}, [selectedConversation, messageSearch])

  
function sendMessage(event) {
  event.preventDefault()

  const text = message.trim()
  const socket = socketRef.current
  

  if (!text || !selectedConversation) return

  if (!socket?.connected) {
    setMessageError('Not connected to the messaging server. Please try again.')
    return
  }

  setMessageError('')

  const clientMessageId = crypto.randomUUID()

  socket.emit(
    'message:send',
    {
      conversationId: selectedId,
      content: text,
      clientMessageId,
    },
    (response) => {
      if (!response?.success) {
        setMessageError(
          response?.message || 'Message could not be sent. Please try again.',
        )
        return
      }

      const item = response.message

      const sentMessage = {
        id: String(item.messageId ?? item._id ?? item.id),
        text: item.content ?? item.text ?? text,
        sender: 'me',
        timestamp: item.timestamp ?? item.createdAt ?? new Date().toISOString(),
        status: item.status ?? 'sent',
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              text: replyingTo.text,
              sender: replyingTo.sender,
            }
          : null,
      }

      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.id !== selectedId) return conversation

          const alreadyExists = conversation.messages.some(
            (existing) => existing.id === sentMessage.id,
          )

          if (alreadyExists) return conversation

          return {
            ...conversation,
            messages: [...conversation.messages, sentMessage],
          }
        }),
      )

      setMessage('')
      setReplyingTo(null)
      setContextMenu(null)
    },
  )
}

async function copyMessage(item) {
  try {
    await navigator.clipboard.writeText(item.text)
  } catch (error) {
    console.error('Could not copy message:', error)
  }

  setContextMenu(null)
}

function replyToMessage(item) {
  setReplyingTo(item)
  setContextMenu(null)
}

    function scheduleMessage(event) {
        event.preventDefault()

        if (!scheduledText.trim() || !scheduledTime) return

        const scheduledDate = new Date(scheduledTime)

        setScheduledMessages((current) => [
            ...current,
            {
            id: Date.now(),
            conversationName: selectedConversation.name,
            text: scheduledText.trim(),
            time: scheduledDate.toLocaleString(),
            },
        ])

        setScheduledText('')
        setScheduledTime('')
        setShowSchedule(false)
    }



  return (
    <main className="chat-app">
      <aside className="sidebar">
        <header className="sidebar-header">
          <a className="brand" href="#" aria-label="Wad home">
            <span className="brand-mark">w</span>
            <span>wad<span className="brand-dot">.</span></span>
          </a>
          <button className="icon-button new-chat" type="button" title="New chat" aria-label="New chat">
            +
          </button>
        </header>

        <div className="sidebar-intro">
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h1>Messages <span>{conversations.length}</span></h1>
          <p className="muted">Stay connected with your people.</p>
        </div>

        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search conversations"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search conversations"
          />
          <kbd>/</kbd>
        </label>

        <div className="section-heading">
          <span>ALL CONVERSATIONS</span>
          <span>{filteredConversations.length}</span>
        </div>

        <nav className="conversation-list" aria-label="Conversations">
          {filteredConversations.map((conversation) => {
            const lastMessage =
              conversation.messages[conversation.messages.length - 1]

            return (
              <button
                className={`conversation-item ${selectedId === conversation.id ? 'selected' : ''}`}
                key={conversation.id}
                type="button"
                onClick={() => selectConversation(conversation.id)}
                aria-current={selectedId === conversation.id ? 'page' : undefined}
              >
                <span className={`avatar ${conversation.color}`}>
                  {conversation.initials}
                  <span className={`presence ${conversation.status}`} />
                </span>
                <span className="conversation-details">
                  <span className="conversation-topline">
                    <strong>{conversation.name}</strong>
                    <span className="conversation-time">{lastMessage?.timestamp
  ? formatMessageTime(lastMessage.timestamp)
  : ''}</span>
                  </span>
                  <span className="conversation-bottomline">
                   
<span className="last-message">
  {highlightText(lastMessage?.text ?? '', search)}
</span>

                    {conversation.unread > 0 && (
                      <span className="unread-count">{conversation.unread}</span>
                    )}
                  </span>
                </span>
              </button>
            )
          })}

          {filteredConversations.length === 0 && (
            <p className="empty-search">No conversations found.</p>
          )}
        </nav>

        
<div className="sidebar-footer">
  <button
    className="profile-footer-button"
    type="button"
    onClick={() => onNavigate?.('profile')}
    aria-label="Open your profile"
  >
    <span className="avatar profile-avatar">NS</span>
    <span className="profile-details">
      <strong>Your profile</strong>
      <span>Available</span>
    </span>
  </button>

  <button
    className="icon-button profile-menu"
    type="button"
    aria-label="Profile options"
    title="Profile options"
    onClick={() => onNavigate?.('profile')}
  >
    ···
  </button>
</div>

      </aside>

      <section className="chat-panel" aria-label="Chat">
        {selectedConversation ? (
          <>
            <header className="chat-header">
              <div className="chat-contact">
                <span className={`avatar ${selectedConversation.color}`}>
                  {selectedConversation.initials}
                  <span className={`presence ${selectedConversation.status}`} />
                </span>
                <div>
                  <h2>{selectedConversation.name}</h2>
                  <p className="contact-status">
                    <span className={`status-dot ${selectedConversation.status}`} />
                    {selectedConversation.status === 'online'
                      ? 'Online'
                      : selectedConversation.status === 'away'
                        ? 'Away'
                        : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="chat-actions">
               <button
  className="icon-button"
  type="button"
  aria-label="Search messages"
  title="Search messages"
  onClick={() => {
    setShowMessageSearch((current) => !current)
    setMessageSearch('')
  }}
>
  ⌕
</button>
                <button className="icon-button" type="button" aria-label="More conversation options" title="More options">···</button>
              </div>
            </header>
            {showMessageSearch && (
  <div className="message-search-bar">
    <input
      type="search"
      value={messageSearch}
      onChange={(event) => setMessageSearch(event.target.value)}
      placeholder="Search in this chat..."
      aria-label="Search within this conversation"
      autoFocus
    />

    <span className="message-search-count">
      {messageSearch.trim() ? filteredMessages.length : ''}
    </span>

    <button
      type="button"
      className="icon-button"
      aria-label="Close message search"
      onClick={() => {
        setShowMessageSearch(false)
        setMessageSearch('')
      }}
    >
      ×
    </button>
  </div>
)}
            <div className="message-area" ref={messageAreaRef}>
             

             
{filteredMessages.map((item, index) => {
  const dateLabel = formatDateLabel(item.timestamp)
  const previousMessage = filteredMessages[index - 1]
  const previousDate = previousMessage
    ? formatDateLabel(previousMessage.timestamp)
    : null

  return (
    <Fragment key={item.id}>
      {dateLabel !== previousDate && (
        <div className="date-divider">
          <span>{dateLabel}</span>
        </div>
      )}

      <div
  ref={
    index === filteredMessages.length - 1
      ? latestMessageRef
      : null
  }
  className={`message-row ${item.sender === 'me' ? 'sent' : 'received'}`}
        onContextMenu={(event) => {
          event.preventDefault()
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            item,
          })
        }}
      >
        {item.sender === 'them' && (
          <span className={`avatar message-avatar ${selectedConversation.color}`}>
            {selectedConversation.initials}
          </span>
        )}

        <div className="message-content">
          <div className={`message-bubble ${item.sender}`}>
            {item.replyTo && (
              <div className="message-reply-quote">
                <strong>
                  {item.replyTo.sender === 'me'
                    ? 'You'
                    : selectedConversation.name}
                </strong>
                <p>{item.replyTo.text}</p>
              </div>
            )}

            {item.text}
          </div>

          <span
            className="message-time"
            title={new Date(item.timestamp).toLocaleString()}
          >
            {formatMessageTime(item.timestamp)}

            {item.sender === 'me' && (
              <span
                className={`message-status ${item.status || 'sent'}`}
                title={
                  item.status === 'read'
                    ? 'Read'
                    : item.status === 'delivered'
                      ? 'Delivered'
                      : 'Sent'
                }
                aria-label={
                  item.status === 'read'
                    ? 'Read'
                    : item.status === 'delivered'
                      ? 'Delivered'
                      : 'Sent'
                }
              >
                {item.status === 'sent' || !item.status ? '✓' : '✓✓'}
              </span>
            )}
          </span>
        </div>
      </div>
    </Fragment>
  )
})}

{contextMenu && (
  <div
    className="message-context-menu"
    style={{
      left: `${Math.min(contextMenu.x, window.innerWidth - 170)}px`,
      top: `${Math.min(contextMenu.y, window.innerHeight - 100)}px`,
    }}
    onMouseLeave={() => setContextMenu(null)}
  >
    <button
      type="button"
      onClick={() => copyMessage(contextMenu.item)}
    >
      Copy message
    </button>

    <button
      type="button"
      onClick={() => replyToMessage(contextMenu.item)}
    >
      Reply
    </button>
  </div>
)}

              {messageSearch.trim() && filteredMessages.length === 0 && (
  <p className="empty-search">
    No messages found in this conversation.
  </p>
)}
            </div>

            <div className="composer-section">
              {replyingTo && (
  <div className="reply-preview">
    <div>
      <strong>
        Replying to{' '}
        {replyingTo.sender === 'me'
          ? 'yourself'
          : selectedConversation.name}
      </strong>
      <p>{replyingTo.text}</p>
    </div>

    <button
      type="button"
      onClick={() => setReplyingTo(null)}
      aria-label="Cancel reply"
      title="Cancel reply"
    >
      ×
    </button>
  </div>
)}
              <form className="message-composer" onSubmit={sendMessage}>
                <button
                  className="composer-tool"
                  type="button"
                  aria-label="Schedule a message"
                  title="Schedule a message"
                  onClick={() => {
                    setScheduledText(message)
                    setShowSchedule(true)
                  }}
                >
                  ◷
                </button>
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={`Message ${selectedConversation.name}...`}
                  aria-label="Type a message"
                />
                <span className="composer-hint">Enter ↵</span>
                <button
                  className="send-button"
                  type="submit"
                  disabled={!message.trim()}
                  aria-label="Send message"
                  title="Send message"
                >
                  ↑
                </button>
              </form>
              <p className="composer-caption">
  Messages are sent securely through your chat connection.
</p>

              {scheduledMessages.length > 0 && (
                <div className="scheduled-list">
                  <strong>Scheduled in this demo</strong>
                  {scheduledMessages.map((item) => (
                    <p key={item.id}>
                      <span>{item.conversationName}: {item.text}</span>
                      <span>{item.time}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="no-chat">
            <span className="empty-icon">w.</span>
            <h2>Choose a conversation</h2>
            <p>Select someone from the sidebar to start chatting.</p>
          </div>
        )}
      </section>

      {showSchedule && selectedConversation && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowSchedule(false)
        }}>
          <section
            className="schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setShowSchedule(false)}
              aria-label="Close scheduling dialog"
            >
              ×
            </button>
            <p className="eyebrow">PLAN AHEAD</p>
            <h2 id="schedule-title">Schedule a message</h2>
            <p className="muted">To {selectedConversation.name}</p>
            <form onSubmit={scheduleMessage}>
              <label htmlFor="scheduled-message">Message</label>
              <textarea
                id="scheduled-message"
                rows="3"
                value={scheduledText}
                onChange={(event) => setScheduledText(event.target.value)}
                placeholder="Write your message..."
                required
              />
              <label htmlFor="scheduled-time">Date and time</label>
              <input
                id="scheduled-time"
                type="datetime-local"
                value={scheduledTime}
                onChange={(event) => setScheduledTime(event.target.value)}
                required
              />
              <p className="schedule-note">
                Demo only: this records the scheduled message in the current page. It will not send automatically.
              </p>
              <button className="schedule-submit" type="submit">
                Save scheduled message
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default ChatPage
