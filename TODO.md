# TODO — Débito Técnico e Pendências

## Segurança

- [ ] **[AUTH] Tokens em cookie não-httpOnly**: O middleware Next.js verifica `access_token` via cookie, mas a store Zustand usa localStorage. Fix atual: `setTokens` sincroniza um cookie não-httpOnly. Fix definitivo: tokens via httpOnly cookie gerenciado pelo NestJS (Set-Cookie na resposta do /auth/login). Isso remove o acesso ao token no lado do cliente e aumenta a segurança.

- [ ] **[META] Token trafega frontend→backend no finalize**: O fluxo OAuth atual retorna o access_token Meta para o frontend (GET /clients/:id/meta/callback), que o reenviam no POST /clients/:id/meta/finalize para ser criptografado. Isso viola a regra "NUNCA retorne tokens da Meta API em responses". Fix: armazenar o token temporariamente no backend (ex: Redis com TTL curto) associado ao state param, eliminando a necessidade de trafegar o token no frontend.

- [ ] **[META] System User Token não implementado**: A regra do projeto exige System User Tokens em produção (nunca User Access Tokens). A `MetaApiAdapter.createSystemUser` existe mas não é chamada no `finalizeConnection`. O fluxo atual usa o User Access Token diretamente. Implementar no Prompt 04 ou separado.

## Auth

- [ ] **[AUTH] Access token expirado durante OAuth flow**: Se o access token (15min) expirar enquanto o usuário está no fluxo OAuth do Meta, o cookie também expira e o middleware redireciona para /login, perdendo o flow. Fix: implementar refresh automático via interceptor antes de cada chamada API.

## Infraestrutura / Qualidade

- [ ] **[INFRA] Queue inline em ClientsService.triggerSync**: A criação de `new Queue()` dentro do service é um anti-pattern — a conexão não é gerenciada pelo ciclo de vida do NestJS. Fix ideal: injetar a Queue via `BullModule.registerQueue` do `@nestjs/bullmq` no módulo. Contorno atual: `queue.close()` no finally evita leak imediato.

- [ ] **[INFRA] MetaApiAdapter duplicado**: Existe uma cópia em `apps/api/src/integrations/meta/` e outra em `apps/workers/src/integrations/`. Mover para `packages/meta-api/` para eliminar divergência.

- [ ] **[INFRA] process.env direto no worker**: `MetaSyncProcessor` lê `REDIS_HOST`/`REDIS_PORT` direto de `process.env` em vez de um ConfigService/ConfigModule validado com Zod. Adicionar `@nestjs/config` ao workers app.

- [ ] **[QUALITY] Cache ausente nos endpoints de campanhas**: CLAUDE.md exige cache Redis para endpoints que retornam >100 registros. `GET /clients/:id/campaigns` e `GET /clients/:id/campaigns/insights` ainda não têm cache.

- [ ] **[QUALITY] Testes para MetaSyncProcessor**: O worker de sync não tem nenhum teste unitário. Adicionar pelo menos: lock adquirido/liberado, tenantId mismatch, N+1 não ocorre (loadCampaignMap chamado 1x), DLQ triggered após max attempts.

## Funcionalidades Pendentes (Prompts futuros)

- [ ] Dashboard de métricas com Recharts (Prompt 05+)
- [ ] 2FA (twoFactorSecret já está no schema, lógica não implementada)
