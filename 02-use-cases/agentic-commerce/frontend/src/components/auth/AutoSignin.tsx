"use client"

import { ReactNode, useEffect, useState, PropsWithChildren } from "react"
import { useAuth } from "react-oidc-context"
import "./AutoSignin.css"

function AutoSigninContent({ children }: PropsWithChildren) {
  const auth = useAuth()

  if (auth.isLoading) {
    return (
      <div className="auth-loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="loading-text">Preparing your journey...</p>
        </div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="auth-signin">
        <div className="signin-background">
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
          <div className="floating-shape shape-3"></div>
          <div className="floating-shape shape-4"></div>
        </div>
        
        <div className="signin-card">
          <div className="signin-header">
            <div className="signin-icon-wrapper">
              <span className="signin-icon">✈️</span>
              <div className="icon-glow"></div>
            </div>
            <h1 className="signin-title">Travel with Agentic Commerce</h1>
            <p className="signin-subtitle">Your AI-powered travel companion awaits</p>
          </div>
          
          <div className="signin-features">
            <div className="feature-item">
              <span className="feature-emoji">🌍</span>
              <span className="feature-text">Personalized recommendations</span>
            </div>
            <div className="feature-item">
              <span className="feature-emoji">💬</span>
              <span className="feature-text">Natural conversations</span>
            </div>
            <div className="feature-item">
              <span className="feature-emoji">📊</span>
              <span className="feature-text">Real-time insights</span>
            </div>
          </div>
          
          <button className="signin-button" onClick={() => auth.signinRedirect()}>
            <span className="button-text">Begin Your Journey</span>
            <span className="button-arrow">→</span>
          </button>
          
          <p className="signin-footer">Agentic Commerce - Secure authentication powered by AWS Cognito</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function AutoSignin({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return <AutoSigninContent>{children}</AutoSigninContent>
}
