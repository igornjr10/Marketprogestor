export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ApiResponse<T> = {
  data: T
  message?: string
}

export type ApiError = {
  statusCode: number
  message: string
  error?: string
}
