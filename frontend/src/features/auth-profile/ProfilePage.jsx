import { useEffect, useState } from 'react'
import { apiRequest } from '../../lib/api'
import './AuthPages.css'

function ProfilePage({ onNavigate, user }) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      try {
        const data = await apiRequest('/api/users/me')

        if (!cancelled && data.user) {
          setName(data.user.name ?? '')
          setEmail(data.user.email ?? '')
          setBio(data.user.bio ?? '')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load your profile.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    setSaved(false)
    setIsSaving(true)

    try {
      const data = await apiRequest('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim(),
        }),
      })

      if (data.user) {
        setName(data.user.name ?? name.trim())
        setEmail(data.user.email ?? email)
        setBio(data.user.bio ?? bio.trim())
      }

      setSaved(true)
      setIsEditing(false)
    } catch (err) {
      setError(err.message || 'Could not save your profile.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleCancel() {
    setName(user?.name ?? name)
    setBio(user?.bio ?? bio)
    setIsEditing(false)
    setSaved(false)
    setError('')
  }

  async function handleLogout() {
    setError('')
    setIsSigningOut(true)

    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
      })

      onNavigate?.('login')
    } catch (err) {
      setError(err.message || 'Could not sign out. Please try again.')
    } finally {
      setIsSigningOut(false)
    }
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

        {isLoading ? (
          <p role="status">Loading your profile...</p>
        ) : (
          <>
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
                      setError('')
                      setIsEditing(true)
                    }}
                  >
                    Edit profile
                  </button>

                  <button
                    className="profile-secondary-button"
                    type="button"
                    onClick={handleLogout}
                    disabled={isSigningOut}
                  >
                    {isSigningOut ? 'Signing out...' : 'Sign out'}
                  </button>
                </div>

                {saved && (
                  <p className="profile-success" role="status">
                    Profile updated successfully.
                  </p>
                )}
              </>
            ) : (
              <form
                className="auth-form profile-edit-form"
                onSubmit={handleSave}
              >
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
                    readOnly
                    autoComplete="email"
                  />
                  <small>Email address cannot be changed here.</small>
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
                  <button
                    className="auth-primary-button"
                    type="submit"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>

                  <button
                    className="profile-secondary-button"
                    type="button"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="profile-error">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}

export default ProfilePage