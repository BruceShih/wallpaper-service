import { deleteWallpaper, getWallpaper, updateWallpaper, uploadWallpaper } from './methods'

async function makeRequest(
  request: Request<unknown, IncomingRequestCfProperties<unknown>>,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const path = new URL(request.url).pathname.split('/')[1]
  switch (path) {
    case 'get':
      return await getWallpaper(request, env, ctx)
    case 'upload':
      return await uploadWallpaper(request, env)
    case 'update':
      return await updateWallpaper(request, env)
    case 'delete':
      return await deleteWallpaper(request, env)
    default:
      return new Response('Method Not Allowed', {
        status: 405
      })
  }
}

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    return await makeRequest(request, env, _ctx)
  }
} satisfies ExportedHandler<Env>
