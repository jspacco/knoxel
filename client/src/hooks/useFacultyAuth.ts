import { useCallback, useEffect, useState } from 'react'
import { pb, type WorldRecord, joinAsFacultyStudent } from '../lib/pocketbase'

export function useFacultyAuth() {
  const [isSuperuser, setIsSuperuser] = useState<boolean>(() => {
    return Boolean(pb.authStore.isValid && pb.authStore.isSuperuser)
  })
  const [adminEmail, setAdminEmail] = useState<string | null>(() => {
    return (pb.authStore.isValid && pb.authStore.isSuperuser && pb.authStore.record?.email) || null
  })
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => {
      const validSuperuser = Boolean(pb.authStore.isValid && pb.authStore.isSuperuser)
      setIsSuperuser(validSuperuser)
      setAdminEmail((validSuperuser && pb.authStore.record?.email) || null)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const authData = await pb.collection('_superusers').authWithPassword(email.trim(), password)
      setIsSuperuser(true)
      setAdminEmail(authData.record.email)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid admin credentials.'
      setAuthError(msg)
      throw err
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    pb.authStore.clear()
    setIsSuperuser(false)
    setAdminEmail(null)
  }, [])

  const joinAsStudent = useCallback(
    async (world: WorldRecord) => {
      return await joinAsFacultyStudent(world, adminEmail || undefined)
    },
    [adminEmail],
  )

  return {
    isSuperuser,
    adminEmail,
    authLoading,
    authError,
    setAuthError,
    login,
    logout,
    joinAsStudent,
  }
}
