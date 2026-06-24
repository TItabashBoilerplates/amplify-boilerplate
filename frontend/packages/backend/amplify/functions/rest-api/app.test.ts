import { describe, expect, it } from 'vitest'
import { app } from './app'

describe('rest-api Hono app', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', service: 'rest-api' })
  })

  it('GET / returns a message', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveProperty('message')
  })

  it('GET /me without Authorization is 401', async () => {
    const res = await app.request('/me')
    expect(res.status).toBe(401)
  })

  it('GET /me with Authorization passes the guard', async () => {
    const res = await app.request('/me', { headers: { authorization: 'Bearer x' } })
    expect(res.status).toBe(200)
  })
})
