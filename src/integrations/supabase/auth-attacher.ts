import { createMiddleware } from '@tanstack/react-start'
import { getToken } from '@/integrations/localdb/client'

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const token = getToken()
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
