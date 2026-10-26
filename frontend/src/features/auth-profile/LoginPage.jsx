
import { useState } from 'react'
import './AuthPages.css'

function LoginPage({ onLogin, onNavigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    // The backend authentication API will be connected later.
    onLogin?.({ email: email.trim(), password })
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand">
          <span className="brand-icon">W</span>
          <span>Wavelength</span>
        </div>

        <div className="auth-visual-content">
          <span className="visual-eyebrow">YOUR PEOPLE. YOUR SPACE.</span>
          <h1>Conversations that bring us closer.</h1>
          <p>
            A simpler space to connect, share moments, and
            stay in touch with the people who matter.
          </p>

          <div className="visual-decoration" aria-hidden="true">
            <span className="decoration-circle circle-one">W</span>
            <span className="decoration-circle circle-two">✦</span>
            <span className="decoration-circle circle-three">•••</span>
            <div className="decoration-line" />
          </div>
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
            <span className="auth-kicker">WELCOME BACK</span>
            <h2>Sign in to your account</h2>
            <p>Enter your details to continue your conversations.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <div className="field-label-row">
                <label htmlFor="login-password">Password</label>
              </div>

              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button className="auth-primary-button" type="submit">
              Sign in <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="auth-switch">
            Don&apos;t have an account?{' '}
            <button type="button" onClick={() => onNavigate?.('signup')}>
              Create account
            </button>
          </p>

          <p className="auth-legal">
            By continuing, you agree to use this platform responsibly.
          </p>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
