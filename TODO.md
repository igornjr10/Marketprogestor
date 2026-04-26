# TODO — Débito Técnico e Pendências

## Segurança

- [ ] **[AUTH] Tokens em cookie não-httpOnly**: O middleware Next.js verifica `access_token` via cookie, mas a store Zustand usa localStorage. Fix atual: `setTokens` sincroniza um cookie não-httpOnly. Fix definitivo: tokens via httpOnly cookie gerenciado pelo NestJS (Set-Cookie na resposta do /auth/login). Isso remove o acesso ao token no lado do cliente e aumenta a segurança.

- [ ] **[META] Token trafega frontend→backend no finalize**: O fluxo OAuth atual retorna o access_token Meta para o frontend (GET /clients/:id/meta/callback), que o reenviam no POST /clients/:id/meta/finalize para ser criptografado. Isso viola a regra "NUNCA retorne tokens da Meta API em responses". Fix: armazenar o token temporariamente no backend (ex: Redis com TTL curto) associado ao state param, eliminando a necessidade de trafegar o token no frontend.

- [ ] **[META] System User Token não implementado**: A regra do projeto exige System User Tokens em produção (nunca User Access Tokens). A `MetaApiAdapter.createSystemUser` existe mas não é chamada no `finalizeConnection`. O fluxo atual usa o User Access Token diretamente. Implementar no Prompt 04 ou separado.

## Auth

- [ ] **[AUTH] Access token expirado durante OAuth flow**: Se o access token (15min) expirar enquanto o usuário está no fluxo OAuth do Meta, o cookie também expira e o middleware redireciona para /login, perdendo o flow. Fix: implementar refresh automático via interceptor antes de cada chamada API.

## Funcionalidades Pendentes (Prompts futuros)

- [ ] Sincronização de dados de campanhas via BullMQ workers (Prompt 04)
- [ ] Dashboard de métricas com Recharts (Prompt 05+)
- [ ] 2FA (twoFactorSecret já está no schema, lógica não implementada)
