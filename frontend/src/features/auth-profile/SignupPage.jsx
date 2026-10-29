
import { useState } from 'react'
import './AuthPages.css'
import { apiRequest } from '../../lib/api'

function SignupPage({ onNavigate, onSignup }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  
async function handleSubmit(event) {
  event.preventDefault()
  setError('')

  if (password.length < 8) {
    setError('Password must contain at least 8 characters.')
    return
  }

  if (password !== confirmPassword) {
    setError('Passwords do not match.')
    return
  }

  setIsSubmitting(true)

  try {
    const data = await apiRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
      }),
    })

    // Navigate only after the backend confirms signup.
    onSignup?.(data.email || email.trim())
  } catch (error) {
    setError(error.message || 'Unable to create your account.')
  } finally {
    setIsSubmitting(false)
  }
}


  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand">
          <span className="brand-icon">W</span>
          <span>Wavelength</span>
        </div>

        <div className="auth-visual-content">
          <span className="visual-eyebrow">A NEW WAY TO CONNECT</span>
          <h1>Your next conversation starts here.</h1>
          <p>
            Create your account and make room for more
            meaningful conversations.
          </p>
        </div>

        <p className="visual-footer">
          Made for meaningful conversations.
        </p>
      </section>

      <section className="auth-form-section">
        <div className="auth-form-wrapper">
          <div className="mobile-brand auth-brand">
            <span className="brand-icon">W</span>
            <span>Wavelength</span>
          </div>

          <div className="auth-heading">
            <span className="auth-kicker">GET STARTED</span>
            <h2>Create your account</h2>
            <p>Enter your details to join the conversation.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="signup-name">Full name</label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="signup-email">Email address</label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="signup-confirm-password">
                Confirm password
              </label>
              <input
                id="signup-confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                required
              />
            </div>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button
  className="auth-primary-button"
  type="submit"
  disabled={isSubmitting}
>
  {isSubmitting ? 'Creating account...' : 'Create account'}
  {!isSubmitting && <span aria-hidden="true">→</span>}
</button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <button type="button" onClick={() => onNavigate?.('login')}>
              Sign in
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}

export default SignupPage
