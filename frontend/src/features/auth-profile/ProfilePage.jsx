
import { useState } from 'react'
import './AuthPages.css'

function ProfilePage({ onNavigate, user }) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? 'Alex Morgan')
  const [email, setEmail] = useState(user?.email ?? 'alex@example.com')
  const [bio, setBio] = useState(
    user?.bio ?? 'Here for good conversations.',
  )
  const [saved, setSaved] = useState(false)

  function handleSave(event) {
    event.preventDefault()
    setSaved(true)
    setIsEditing(false)

    // Local UI state only. Persistence will be added with the backend.
    onNavigate?.('profile', { name, email, bio })
  }

  function handleCancel() {
    setName(user?.name ?? 'Alex Morgan')
    setEmail(user?.email ?? 'alex@example.com')
    setBio(user?.bio ?? 'Here for good conversations.')
    setIsEditing(false)
    setSaved(false)
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U'

  return (
    <main className="profile-page">
      <header className="profile-topbar">
        <button
          className="profile-back-button"
          type="button"
          onClick={() => onNavigate?.('chat')}
        >
          ← Back to chat
        </button>

        <div className="auth-brand">
          <span className="brand-icon">W</span>
          <span>Wavelength</span>
        </div>
      </header>

      <section className="profile-card">
        <div className="profile-card-heading">
          <span className="auth-kicker">YOUR ACCOUNT</span>
          <h1>My profile</h1>
          <p>Manage your personal information.</p>
        </div>

        <div className="profile-avatar" aria-label={`Avatar for ${name}`}>
          {initials}
        </div>

        {!isEditing ? (
          <>
            <div className="profile-identity">
              <h2>{name}</h2>
              <p>{email}</p>
              <p className="profile-bio">{bio}</p>
            </div>

            <div className="profile-actions">
              <button
                className="auth-primary-button"
                type="button"
                onClick={() => {
                  setSaved(false)
                  setIsEditing(true)
                }}
              >
                Edit profile
              </button>

              <button
                className="profile-secondary-button"
                type="button"
                onClick={() => onNavigate?.('login')}
              >
                Sign out
              </button>
            </div>

            {saved && (
              <p className="profile-success" role="status">
                Profile changes saved for this session.
              </p>
            )}
          </>
        ) : (
          <form className="auth-form profile-edit-form" onSubmit={handleSave}>
            <div className="form-field">
              <label htmlFor="profile-name">Display name</label>
              <input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
                maxLength={60}
              />
            </div>

            <div className="form-field">
              <label htmlFor="profile-email">Email address</label>
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="profile-bio">About me</label>
              <textarea
                id="profile-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={3}
                maxLength={160}
                placeholder="A little about yourself..."
              />
            </div>

            <div className="profile-actions">
              <button className="auth-primary-button" type="submit">
                Save changes
              </button>
              <button
                className="profile-secondary-button"
                type="button"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}

export default ProfilePage
