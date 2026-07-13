// Local JWT auth middleware — replaces Supabase auth middleware.
// Verifies the local JWT issued by the Express API server.
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'zdspgc-pre-enrollment-secret-key-2026'

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest()

    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available')
    }

    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Bearer token required')
    }

    const token = authHeader.slice(7)
    if (!token) {
      throw new Error('Unauthorized: No token provided')
    }

    let claims: any
    try {
      claims = jwt.verify(token, JWT_SECRET) as any
    } catch (err: any) {
      throw new Error(`Unauthorized: ${err.message}`)
    }

    if (!claims?.id) {
      throw new Error('Unauthorized: Invalid token payload')
    }

    return next({
      context: {
        userId: claims.id,
        userEmail: claims.email,
        userRole: claims.role,
        claims,
      },
    })
  },
)
