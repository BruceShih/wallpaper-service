interface ImagesRow {
  key: string
  alive: 0 | 1
  favorite: 0 | 1
  createDate: string
  deleteDate: string
}

interface WallpaperServicePostBody {
  favorite: boolean
}

function hasValidHeader(request: Request<unknown, IncomingRequestCfProperties<unknown>>, env: Env) {
  return request.headers.get('X-Bucket-Auth-Key') === env.AUTH_KEY_SECRET
}

function authorizeRequest(request: Request<unknown, IncomingRequestCfProperties<unknown>>, env: Env) {
  switch (request.method) {
    case 'GET':
    case 'POST':
    case 'DELETE':
    case 'PUT':
      return hasValidHeader(request, env)
    default:
      return false
  }
}

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const url = new URL(request.url)

    if (!authorizeRequest(request, env)) {
      console.error('[Wallpaper Service] Unauthorized request:', JSON.stringify(request))
      return new Response('Forbidden', { status: 403 })
    }

    if (request.method === 'GET') {
      try {
        let key = ''
        let favorite = false
        key = url.pathname.slice(1).split('/')[0]

        if (key === '') {
          // get a random row from 'wallpapers.images' table
          const randomStatement = env.WALLPAPERS_DB.prepare('SELECT * FROM images WHERE alive = 1 ORDER BY RANDOM() LIMIT 1')
          const randomRow = await randomStatement.first<ImagesRow>()
          if (!randomRow) {
            console.error('[Wallpaper Service] No wallpapers found')
            return new Response('No wallpapers found', { status: 404 })
          }

          key = randomRow.key
          favorite = randomRow.favorite === 1
        }
        else {
          // get image by key
          const row = await env.WALLPAPERS_DB.prepare(
            'SELECT * FROM images WHERE key = ?'
          ).bind(key).first<ImagesRow>()

          if (!row) {
            console.error('[Wallpaper Service] Image not found:', key)
            return new Response('Image Not Found', { status: 404 })
          }

          key = row.key
          favorite = row.favorite === 1
        }

        // make cache
        const cacheUrl = new URL(env.API_HOST)
        const cacheKey = new Request(`${cacheUrl.toString()}${key}`, request)
        const cache = caches.default

        const cacheResponse = await cache.match(cacheKey)
        if (cacheResponse) {
          // cache hit
          return cacheResponse
        }
        else {
          const image = await env.WALLPAPERS_BUCKET.get(key)
          if (image === null) {
            console.error('[Wallpaper Service] Object not found:', key)
            return new Response('Object Not Found', { status: 404 })
          }

          const headers = new Headers()
          image.writeHttpMetadata(headers)
          headers.set('etag', image.httpEtag)
          headers.set('Image-Id', key)
          headers.set('Favorite', favorite.valueOf().toString())
          // set cache to 1 year
          headers.append('Cache-Control', 's-maxage=31536000')

          const response = new Response(image.body, {
            headers
          })
          // store the response in cache
          _ctx.waitUntil(cache.put(cacheKey, response.clone()))

          return response
        }
      }
      catch (error) {
        console.error('[Wallpaper Service] Error:', error)
        return new Response('Internal Server Error', { status: 500 })
      }
    }

    if (request.method === 'POST') {
      try {
        const key = url.pathname.slice(1)

        // get request body
        const body = await request.json<WallpaperServicePostBody>()
        // preparing sql statement
        const statement = await env.WALLPAPERS_DB.prepare('UPDATE images SET favorite = ? WHERE key = ?')
          .bind(body.favorite === true ? 1 : 0, key)
          .run()

        if (!statement.success) {
          console.error('[Wallpaper Service] Database error', statement.error)
          return new Response('Database error', { status: 500 })
        }

        return new Response('Image marked as favorite', { status: 200 })
      }
      catch (error) {
        console.error('[Wallpaper Service] Error:', error)
        return new Response('Internal Server Error', { status: 500 })
      }
    }

    if (request.method === 'DELETE') {
      try {
        const key = url.pathname.slice(1)

        // delete image from r2
        await env.WALLPAPERS_BUCKET.delete(key)
        // update database
        const result = await env.WALLPAPERS_DB.prepare(
          'UPDATE images SET alive = ?, deleteDate = ? WHERE key = ?'
        ).bind(
          0,
          new Date().toISOString(),
          key
        ).run()
        if (result.success) {
          return new Response('Image deleted', { status: 200 })
        }
        else {
          console.error('[Wallpaper Service] Database error', result.error)
          return new Response('Database error', { status: 500 })
        }
      }
      catch (error) {
        console.error('[Wallpaper Service] Error:', error)
        return new Response('Internal Server Error', { status: 500 })
      }
    }

    if (request.method === 'PUT') {
      try {
        const key = url.pathname.slice(1)

        // check image existence
        const selectResult = await env.WALLPAPERS_DB.prepare(
          'SELECT * FROM images WHERE key = ?'
        ).bind(key).first<ImagesRow>()

        if (selectResult?.key) {
          console.warn('[Wallpaper Service] Image existed, skip uploading', selectResult.key)
          return new Response('Image existed', { status: 202 })
        }

        // upload image to bucket
        await env.WALLPAPERS_BUCKET.put(key, request.body)
        // write to database
        const insertResult = await env.WALLPAPERS_DB.prepare(
          'INSERT INTO images (key, createDate, deleteDate) VALUES (?, ?, ?)'
        ).bind(
          key,
          new Date().toISOString(),
          ''
        ).run()

        if (insertResult.success) {
          return new Response('Image uploaded', { status: 201 })
        }
        else {
          // delete the uploaded image
          await env.WALLPAPERS_BUCKET.delete(key)

          console.error('[Wallpaper Service] Database error', insertResult.error)
          return new Response('Database error', { status: 500 })
        }
      }
      catch (error) {
        console.error('[Wallpaper Service] Error:', error)
        return new Response('Internal Server Error', { status: 500 })
      }
    }

    return new Response('Method Not Allowed', {
      status: 405
    })
  }
} satisfies ExportedHandler<Env>
