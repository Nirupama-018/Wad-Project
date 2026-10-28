
import { Fragment, useMemo, useState } from 'react'
import './ChatPage.css'


function createDemoTimestamp(daysAgo, hour, minute) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

function getMostRecentMondayOffset() {
  return (new Date().getDay() + 6) % 7
}

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



const initialConversations = [
  {
    id: 1,
    name: 'Ananya Menon',
    initials: 'AM',
    color: 'lavender',
    status: 'online',
    unread: 2,
    messages: [
      {
        id: 101,
        text: 'Hey! Have you checked the project updates?',
        sender: 'them',
        timestamp: createDemoTimestamp(0, 10, 32),
      },
      {
        id: 102,
        text: 'Not yet, I was working on the chat interface.',
        sender: 'me',
        timestamp: createDemoTimestamp(0, 10, 34),
      },
      {
        id: 103,
        text: 'Perfect! Let me know when you are done.',
        sender: 'them',
        timestamp: createDemoTimestamp(0, 10, 35),
      },
    ],
  },
  {
    id: 2,
    name: 'Rahul Krishnan',
    initials: 'RK',
    color: 'peach',
    status: 'away',
    unread: 0,
    messages: [
      {
        id: 201,
        text: 'I will share the API details once they are ready.',
        sender: 'them',
        timestamp: createDemoTimestamp(1, 14, 0),
      },
      {
        id: 202,
        text: 'Sounds good. I am using mock data for now.',
        sender: 'me',
        timestamp: createDemoTimestamp(1, 14, 5),
      },
    ],
  },
  {
    id: 3,
    name: 'Meera Nair',
    initials: 'MN',
    color: 'mint',
    status: 'offline',
    unread: 0,
    messages: [
      {
        id: 301,
        text: 'The UI is looking good!',
        sender: 'them',
        timestamp: createDemoTimestamp(
          getMostRecentMondayOffset(),
          11,
          0,
        ),
      },
    ],
  },
  {
    id: 4,
    name: 'Project Team',
    initials: 'PT',
    color: 'blue',
    status: 'online',
    unread: 0,
    messages: [
      {
        id: 401,
        text: 'Welcome to the project group.',
        sender: 'them',
        timestamp: createDemoTimestamp(
          getMostRecentMondayOffset(),
          11,
          30,
        ),
      },
      {
        id: 402,
        text: 'Thanks everyone!',
        sender: 'me',
        timestamp: createDemoTimestamp(
          getMostRecentMondayOffset(),
          11,
          35,
        ),
      },
    ],
  },
]

function ChatPage({ onNavigate }) {
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedId, setSelectedId] = useState(1)
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

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedId,
  )
  
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

  if (!text || !selectedConversation) return

  const newMessageId = `${Date.now()}-${Math.random()}`

  const replyTo = replyingTo
    ? {
        id: replyingTo.id,
        text: replyingTo.text,
        sender: replyingTo.sender,
      }
    : null

  setConversations((current) =>
    current.map((conversation) =>
      conversation.id === selectedId
        ? {
            ...conversation,
            messages: [
              ...conversation.messages,
              {
                id: newMessageId,
                text,
                sender: 'me',
                timestamp: new Date().toISOString(),
                status: 'sent',
                ...(replyTo && { replyTo }),
              },
            ],
          }
        : conversation,
    ),
  )

  // DEMO ONLY: simulate delivery after 1.5 seconds.
  setTimeout(() => {
    setConversations((current) =>
      current.map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((item) =>
          item.id === newMessageId
            ? { ...item, status: 'delivered' }
            : item,
        ),
      })),
    )
  }, 1500)

  // DEMO ONLY: simulate reading after 3.5 seconds.
  setTimeout(() => {
    setConversations((current) =>
      current.map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((item) =>
          item.id === newMessageId
            ? { ...item, status: 'read' }
            : item,
        ),
      })),
    )
  }, 3500)

  setMessage('')
  setReplyingTo(null)
  setContextMenu(null)
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
            <div className="message-area">
             

             
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
                Messages are currently local demo data, not sent to a server.
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
