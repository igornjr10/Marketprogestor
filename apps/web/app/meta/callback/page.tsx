'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { handleMetaCallback } from '@/lib/clients'

function MetaCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      router.replace('/clients?meta_error=access_denied')
      return
    }

    if (!code || !state) {
      router.replace('/clients?meta_error=missing_params')
      return
    }

    if (!accessToken) {
      router.replace('/login')
      return
    }

    let clientId: string
    try {
      const decoded = JSON.parse(atob(state)) as { clientId: string }
      clientId = decoded.clientId
    } catch {
      router.replace('/clients?meta_error=invalid_state')
      return
    }

    handleMetaCallback(clientId, code, accessToken)
      .then((result) => {
        sessionStorage.setItem(`meta_callback_${clientId}`, JSON.stringify(result))
        router.replace(`/clients/${clientId}/connect`)
      })
      .catch(() => {
        router.replace(`/clients/${clientId}?meta_error=callback_failed`)
      })
  }, [accessToken, router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Processando autorização Meta...</p>
      </div>
    </div>
  )
}

export default function MetaCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <MetaCallbackContent />
    </Suspense>
  )
}
