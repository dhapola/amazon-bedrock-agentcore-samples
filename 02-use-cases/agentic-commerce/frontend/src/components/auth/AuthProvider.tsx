"use client"

import { getCognitoConfig, isDevMode } from "@/lib/auth"
import { PropsWithChildren } from "react"
import { AuthProvider as OidcAuthProvider } from "react-oidc-context"
import { AutoSignin } from "./AutoSignin"
import "./AuthProvider.css"

const AuthProvider = ({ children }: PropsWithChildren) => {
  // Dev mode - bypass authentication
  if (isDevMode) {
    console.log("🚀 Running in DEV MODE - Authentication bypassed")
    return <>{children}</>
  }

  const authConfig = getCognitoConfig()

  if (!authConfig) {
    return (
      <div className="auth-config-error">
        <div className="error-icon">⚠️</div>
        <p>Authentication not configured</p>
        <p className="error-hint">
          Missing required environment variables:
        </p>
        <ul className="error-list">
          <li>VITE_COGNITO_DOMAIN</li>
          <li>VITE_COGNITO_USER_POOL_ID</li>
          <li>VITE_COGNITO_CLIENT_ID</li>
        </ul>
        <p className="error-hint">
          Or enable VITE_DEV_MODE=true in .env for development
        </p>
      </div>
    )
  }

  console.log("🔐 Cognito Auth Config:", {
    authority: authConfig.authority,
    client_id: authConfig.client_id,
    redirect_uri: authConfig.redirect_uri,
    metadata: authConfig.metadata
  })

  return (
    <OidcAuthProvider
      {...authConfig}
      onSigninCallback={() => {
        window.history.replaceState({}, document.title, window.location.pathname)
      }}
    >
      <AutoSignin>{children}</AutoSignin>
    </OidcAuthProvider>
  )
}

export { AuthProvider }
