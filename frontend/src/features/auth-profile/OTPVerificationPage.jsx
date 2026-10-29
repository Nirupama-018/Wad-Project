import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../lib/api'
import './AuthPages.css'

const OTP_LENGTH = 6
const RESEND_SECONDS = 30

function OTPVerificationPage({ email = '', onNavigate }) {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const inputRefs = useRef([])

  useEffect(() => {
    if (secondsLeft <= 0) return undefined

    const timer = setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [secondsLeft])

  function handleChange(index, value) {
    const digits = value.replace(/\D/g, '')
    const nextOtp = [...otp]

    if (!digits) {
      nextOtp[index] = ''
      setOtp(nextOtp)
      setMessage('')
      return
    }

    const pastedDigits = digits.slice(0, OTP_LENGTH - index)

    pastedDigits.split('').forEach((digit, offset) => {
      nextOtp[index + offset] = digit
    })

    setOtp(nextOtp)
    setMessage('')

    const nextIndex = Math.min(index + pastedDigits.length, OTP_LENGTH - 1)
    inputRefs.current[nextIndex]?.focus()
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }

    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (isLoading) return

    if (!email) {
      setMessage('Your signup email is missing. Please sign up again.')
      return
    }

    if (otp.some((digit) => digit === '')) {
      setMessage('Please enter all six digits.')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.join(''),
        }),
      })

      onNavigate?.('login')
    } catch (error) {
      setMessage(error.message || 'OTP verification failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    if (secondsLeft > 0 || isResending || isLoading) return

    if (!email) {
      setMessage('Your signup email is missing. Please sign up again.')
      return
    }

    setIsResending(true)
    setMessage('')

    try {
      await apiRequest('/api/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })

      setOtp(Array(OTP_LENGTH).fill(''))
      setSecondsLeft(RESEND_SECONDS)
      setMessage('A new verification code has been requested.')
      inputRefs.current[0]?.focus()
    } catch (error) {
      setMessage(error.message || 'Could not resend the code. Please try again.')
    } finally {
      setIsResending(false)
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
          <span className="visual-eyebrow">ONE LAST STEP</span>
          <h1>Almost there.</h1>
          <p>
            A quick verification step helps keep your account
            secure and ready for conversation.
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

          <div className="otp-icon" aria-hidden="true">✉</div>

          <div className="auth-heading">
            <span className="auth-kicker">EMAIL VERIFICATION</span>
            <h2>Enter verification code</h2>
            <p>
              Enter the six-digit code sent to {email || 'your email address'}.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="otp-inputs" aria-label="Six-digit verification code">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputRefs.current[index] = element
                  }}
                  className="otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`OTP digit ${index + 1}`}
                  maxLength={OTP_LENGTH}
                  value={digit}
                  onChange={(event) => handleChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  disabled={isLoading}
                  required
                />
              ))}
            </div>

            {message && (
              <p className="auth-error otp-message" role="status">
                {message}
              </p>
            )}

            <button
              className="auth-primary-button"
              type="submit"
              disabled={isLoading || isResending}
            >
              {isLoading ? 'Verifying...' : 'Verify code'}
              {!isLoading && <span aria-hidden="true"> →</span>}
            </button>
          </form>

          <p className="otp-resend">
            Didn't receive a code?{' '}
            {secondsLeft > 0 ? (
              <span>Resend in {secondsLeft}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || isLoading}
              >
                {isResending ? 'Sending...' : 'Resend code'}
              </button>
            )}
          </p>

          <p className="auth-switch">
            <button type="button" onClick={() => onNavigate?.('login')}>
              ← Back to sign in
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}

export default OTPVerificationPage