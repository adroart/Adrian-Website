import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic'
import config from '../../../keystatic.config'

// Handler is created per-request so it picks up env vars from context.env
// (Cloudflare Pages does not expose env vars via process.env)
export const onRequest: PagesFunction = async (context) => {
  const handler = makeGenericAPIRouteHandler({
    config,
    clientId: context.env.KEYSTATIC_GITHUB_CLIENT_ID as string,
    clientSecret: context.env.KEYSTATIC_GITHUB_CLIENT_SECRET as string,
    secret: context.env.KEYSTATIC_SECRET as string,
  })
  const response = await handler(context.request)
  return new Response(response.body, response)
}
