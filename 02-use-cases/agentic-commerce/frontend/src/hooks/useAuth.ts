"use client"
import { useAuth as useOidcAuth } from "react-oidc-context"
import { isDevMode, getCognitoConfig } from "@/lib/auth"

export function useAuth() {
  const auth = useOidcAuth()

  // Dev mode - return mock auth state
  if (isDevMode) {
    return {
      isAuthenticated: true,
      user: {
        profile: {
          email: "dev@localhost.com",
          name: "Dev User"
        }
      },
      signIn: () => console.log("Dev mode: Sign in bypassed"),
      signOut: () => console.log("Dev mode: Sign out bypassed"),
      isLoading: false,
      error: null,
      token: "dev-mode-token",
    }
  }

  // If no AuthProvider context, return mock auth state
  if (!auth) {
    return {
      isAuthenticated: true,
      user: null,
      signIn: () => {},
      signOut: () => {},
      isLoading: false,
      error: null,
      token: null,
    }
  }

  const config = getCognitoConfig()

  return {
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    signIn: auth.signinRedirect,
    signOut: () => {
      if (!config) return
      
      const logoutUrl = `${config.metadata.end_session_endpoint}?client_id=${config.client_id}&logout_uri=${encodeURIComponent(config.post_logout_redirect_uri)}`
      window.location.href = logoutUrl
    },
    isLoading: auth.isLoading,
    error: auth.error,
    token: auth.user?.access_token,
  }
}
