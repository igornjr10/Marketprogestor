import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { MetaApiAdapter } from './meta-api.adapter'

const mockConfigService = {
  get: (key: string) =>
    ({
      META_APP_ID: 'test-app-id',
      META_APP_SECRET: 'test-app-secret',
      META_API_VERSION: 'v21.0',
    })[key],
}

describe('MetaApiAdapter', () => {
  let adapter: MetaApiAdapter
  let fetchSpy: jest.SpyInstance

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MetaApiAdapter,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile()

    adapter = module.get(MetaApiAdapter)
    fetchSpy = jest.spyOn(global, 'fetch')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('buildOAuthUrl', () => {
    it('inclui client_id, redirect_uri, scope e state', () => {
      const url = adapter.buildOAuthUrl('https://example.com/cb', 'state-xyz')
      expect(url).toContain('client_id=test-app-id')
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcb')
      expect(url).toContain('state=state-xyz')
      expect(url).toContain('ads_management')
    })
  })

  describe('validateToken', () => {
    it('retorna dados do token em caso de sucesso', async () => {
      const mockResponse = {
        data: {
          app_id: 'test-app-id',
          is_valid: true,
          expires_at: 9999999999,
          scopes: ['ads_management', 'ads_read'],
        },
      }
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await adapter.validateToken('mock-token')

      expect(result.is_valid).toBe(true)
      expect(result.scopes).toContain('ads_management')
    })
  })

  describe('getBusinesses', () => {
    it('retorna array de businesses da resposta paginada', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'biz-1', name: 'Minha Empresa' }] }),
      } as Response)

      const result = await adapter.getBusinesses('mock-token')

      expect(result).toHaveLength(1)
      expect(result[0]?.name).toBe('Minha Empresa')
    })
  })

  describe('getSystemUserToken', () => {
    it('retorna um token para o system user', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'sys-token', token_type: 'bearer' }),
      } as Response)

      const result = await adapter.getSystemUserToken('mock-token', 'sys-1')

      expect(result.access_token).toBe('sys-token')
    })
  })

  describe('rate limit retry', () => {
    it('tenta novamente em erro de rate limit (código 17)', async () => {
      const rateLimitError = {
        error: { code: 17, message: 'User request limit reached', type: 'OAuthException', fbtrace_id: 'abc' },
      }
      const success = {
        data: { app_id: 'x', is_valid: true, expires_at: 9999999999, scopes: [] },
      }

      fetchSpy
        .mockResolvedValueOnce({ ok: false, json: async () => rateLimitError } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => success } as Response)

      const result = await adapter.validateToken('mock-token')

      expect(result.is_valid).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('lança exceção após MAX_RETRIES em rate limit', async () => {
      const rateLimitError = {
        error: { code: 4, message: 'Application request limit', type: 'OAuthException', fbtrace_id: 'abc' },
      }

      fetchSpy.mockResolvedValue({ ok: false, json: async () => rateLimitError } as Response)

      await expect(adapter.validateToken('mock-token')).rejects.toThrow()
      expect(fetchSpy).toHaveBeenCalledTimes(4) // initial + 3 retries
    })
  })
})
