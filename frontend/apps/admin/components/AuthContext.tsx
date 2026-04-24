"use client"
import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { login as apiLogin } from "../lib/api"

interface AuthUser {
  username: string
  token: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = "uav_admin_user"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Restore session from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser
        setUser(parsed)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setError(null)
    setLoading(true)
    try {
      const token = await apiLogin(username, password)
      const authUser = { username, token }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser))
      setUser(authUser)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "登录失败，请检查用户名密码"
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
    setError(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
