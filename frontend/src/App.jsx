import { useEffect, useState } from 'react'
import { apiRequest } from './lib/api'
import ChatPage from './features/chat/ChatPage'
import LoginPage from './features/auth-profile/LoginPage'
import SignupPage from './features/auth-profile/SignupPage'
import OTPVerificationPage from './features/auth-profile/OTPVerificationPage'
import ProfilePage from './features/auth-profile/ProfilePage'

function App() {
  const [currentScreen, setCurrentScreen] = useState('login')
  const [signupEmail, setSignupEmail] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        const data = await apiRequest('/api/users/me')

        if (!cancelled && data.user) {
          setCurrentUser(data.user)
          setCurrentScreen('chat')
        }
      } catch {
        // No valid session: keep the login screen.
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false)
        }
      }
    }

    restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  function handleSignup(email) {
    setSignupEmail(email)
    setCurrentScreen('otp')
  }

  function handleLogin(user) {
    setCurrentUser(user)
    setCurrentScreen('chat')
  }

  function handleLogout() {
    setCurrentUser(null)
    setCurrentScreen('login')
  }

  if (isCheckingSession) {
    return <main className="auth-page">Checking your session...</main>
  }

  if (currentScreen === 'chat') {
    return <ChatPage onNavigate={setCurrentScreen} />
  }

  if (currentScreen === 'signup') {
    return (
      <SignupPage
        onSignup={handleSignup}
        onNavigate={setCurrentScreen}
      />
    )
  }

  if (currentScreen === 'otp') {
    return (
      <OTPVerificationPage
        email={signupEmail}
        onNavigate={setCurrentScreen}
      />
    )
  }

  if (currentScreen === 'profile') {
    return (
      <ProfilePage
        user={currentUser}
        onLogout={handleLogout}
        onNavigate={setCurrentScreen}
      />
    )
  }

  return (
    <LoginPage
      onLogin={handleLogin}
      onNavigate={setCurrentScreen}
    />
  )
}

export default App