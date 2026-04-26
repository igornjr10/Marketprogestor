export type MetaTokenResponse = {
  access_token: string
  token_type: string
  expires_in?: number
}

export type MetaBusiness = {
  id: string
  name: string
}

export type MetaAdAccount = {
  id: string
  account_id: string
  name: string
  currency: string
  timezone_name: string
  account_status: number
}

export type MetaTokenInfo = {
  data: {
    app_id: string
    is_valid: boolean
    expires_at: number
    scopes: string[]
    user_id?: string
  }
}

export type MetaError = {
  error: {
    code: number
    message: string
    type: string
    fbtrace_id: string
  }
}

export type MetaSystemUser = {
  id: string
}

export type MetaPaginatedResponse<T> = {
  data: T[]
  paging?: {
    cursors?: { before: string; after: string }
    next?: string
  }
}
