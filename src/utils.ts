export function hasValidHeader(request: Request<unknown, IncomingRequestCfProperties<unknown>>, env: Env) {
  return request.headers.get('X-Bucket-Auth-Key') === env.AUTH_KEY_SECRET
}
