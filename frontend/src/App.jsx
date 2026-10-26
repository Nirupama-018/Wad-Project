
import { useState } from 'react'
import ChatPage from './features/chat/ChatPage'
import LoginPage from './features/auth-profile/LoginPage'
import SignupPage from './features/auth-profile/SignupPage'
import OTPVerificationPage from './features/auth-profile/OTPVerificationPage'
import ProfilePage from './features/auth-profile/ProfilePage'
function App() {
  const [currentScreen, setCurrentScreen] = useState('login')

  function handleLogin(credentials) {
    // Temporary UI navigation until the authentication API is ready.
    console.log('Login submitted for:', credentials.email)
    setCurrentScreen('chat')
  }

  function handleSignup() {
    // Temporary UI navigation until the signup API is ready.
    setCurrentScreen('otp')
  }

  if (currentScreen === 'chat') {
  return <ChatPage onNavigate={setCurrentScreen} />
}

  if (currentScreen === 'signup') {
    return <SignupPage onNavigate={setCurrentScreen} />
  }

 if (currentScreen === 'otp') {
  return <OTPVerificationPage onNavigate={setCurrentScreen} />
}
 if (currentScreen === 'profile') {
  return <ProfilePage onNavigate={setCurrentScreen} />
}
  return (
    <LoginPage
      onLogin={handleLogin}
      onNavigate={setCurrentScreen}
    />
  )
}

export default App
