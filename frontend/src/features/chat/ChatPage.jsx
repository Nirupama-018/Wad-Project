
import { useMemo, useState } from 'react'
import './ChatPage.css'

const initialConversations = [
  {
    id: 1,
    name: 'Ananya Menon',
    initials: 'AM',
    color: 'lavender',
    status: 'online',
    unread: 2,
    messages: [
      { id: 101, text: 'Hey! Have you checked the project updates?', sender: 'them', time: '10:32 AM' },
      { id: 102, text: 'Not yet, I was working on the chat interface.', sender: 'me', time: '10:34 AM' },
      { id: 103, text: 'Perfect! Let me know when you are done.', sender: 'them', time: '10:35 AM' },
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
      { id: 201, text: 'I will share the API details once they are ready.', sender: 'them', time: 'Yesterday' },
      { id: 202, text: 'Sounds good. I am using mock data for now.', sender: 'me', time: 'Yesterday' },
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
      { id: 301, text: 'The UI is looking good!', sender: 'them', time: 'Monday' },
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
      { id: 401, text: 'Welcome to the project group.', sender: 'them', time: 'Monday' },
      { id: 402, text: 'Thanks everyone!', sender: 'me', time: 'Monday' },
    ],
  },
]

function ChatPage() {
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedId, setSelectedId] = useState(1)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduledText, setScheduledText] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [scheduledMessages, setScheduledMessages] = useState([])

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedId,
  )

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        conversation.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [conversations, search],
  )

  function selectConversation(id) {
    setSelectedId(id)
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === id ? { ...conversation, unread: 0 } : conversation,
      ),
    )
  }

  function sendMessage(event) {
    event.preventDefault()
    const text = message.trim()

    if (!text || !selectedConversation) return

    const now = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedId
          ? {
              ...conversation,
              messages: [
                ...conversation.messages,
                {
                  id: `${Date.now()}-${Math.random()}`,
                  text,
                  sender: 'me',
                  time: now,
                },
              ],
            }
          : conversation,
      ),
    )
    setMessage('')
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
                    <span className="conversation-time">{lastMessage?.time}</span>
                  </span>
                  <span className="conversation-bottomline">
                    <span className="last-message">{lastMessage?.text}</span>
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
          <span className="avatar profile-avatar">NS</span>
          <span className="profile-details">
            <strong>Your profile</strong>
            <span>Available</span>
          </span>
          <button className="icon-button profile-menu" type="button" aria-label="Profile options">
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
                <button className="icon-button" type="button" aria-label="Search messages" title="Search messages">⌕</button>
                <button className="icon-button" type="button" aria-label="More conversation options" title="More options">···</button>
              </div>
            </header>

            <div className="message-area">
              <div className="date-divider"><span>TODAY</span></div>

              {selectedConversation.messages.map((item) => (
                <div
                  className={`message-row ${item.sender === 'me' ? 'sent' : 'received'}`}
                  key={item.id}
                >
                  {item.sender === 'them' && (
                    <span className={`avatar message-avatar ${selectedConversation.color}`}>
                      {selectedConversation.initials}
                    </span>
                  )}
                  <div className="message-content">
                    <div className={`message-bubble ${item.sender}`}>
                      {item.text}
                    </div>
                    <span className="message-time">
                      {item.time}
                      {item.sender === 'me' && <span className="read-check"> ✓</span>}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="composer-section">
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
