# Wallpaper Service

This is a simple wallpaper service that provides a random wallpaper using Cloudflare Workers and Cloudflare R2.

> Remember to check the usage in Cloudflare dashboard in case being charged $$.

## Setup

### Prerequisites

1. Login in to your Cloudflare account and create a new Worker named `wallpaper-service`.
2. Set a environment variable with a key name of your choice with a random value like this `<your-auth-key>: <your-auth-key-value>`. An example of `<your-auth-key>` could be `X-Auth-Key`
3. Create a R2 bucket named `wallpapers`.
4. Create a D1 database named `wallpapers` and a table named `images` with schema below.
5. It is recommended to setup a custom domain in Workers settings page and enable CORS in R2's settings.

```sql
CREATE TABLE [images] ("key" text DEFAULT "" PRIMARY KEY,"alive" integer DEFAULT 1,"createDate" text DEFAULT "","deleteDate" text DEFAULT "");
```

* `key` will be the name of the image file name as the primary key (so no duplicates)
* `alive` will be a flag to indicate if the image is still available(deleted from R2)

### Project setup

Set up binding configurations in `wrangler.toml` for Cloudflare Workers to communicate with the R2 and D1.

```toml
[[d1_databases]]
binding = "WALLPAPERS_DB" # a name of your choice
database_name = "wallpapers"
database_id = "" # if you want to use a remote D1 database for development, create one and copy its id to here

[[r2_buckets]]
binding = "WALLPAPERS_BUCKET" # a name of your choice
bucket_name = "wallpapers"
preview_bucket_name = "" # if you want to use a remote R2 bucket for development, create one and copy its name to here
```

Run the following commands to setup the project.

```bash
pnpm install
pnpm run cf-typegen # generate typescript definitions for `env` argument
```

Run the following command to deploy the project to Cloudflare.

```bash
pnpm deploy
```

### Local development

> **Unit testing is currently under development, please ignoring test command.**

Create a file `.dev.vars` under the root directory with the following content.

```plaintext
API_HOST = "http://localhost:8787/"
AUTH_KEY_SECRET = <your-auth-key-value>
```

Note that `AUTH_KEY_SECRET` can be any name of your choice. Just remember to use it as the value of the authorization request header.

```typescript
// src/index.ts
function hasValidHeader(request: Request<unknown, IncomingRequestCfProperties<unknown>>, env: Env) {
  return request.headers.get('<your-auth-key>') === env.AUTH_KEY_SECRET
}
```

## Usage

### Get a random wallpaper

```bash
curl --location <your-workers-domain> --header '<your-auth-key>: <your-auth-key-value>'
```

### Get a specific wallpaper

```bash
curl --location <your-workers-domain>/<image-file-name> --header '<your-auth-key>: <your-auth-key-value>'
```

### Delete a wallpaper

```bash
curl --location <your-workers-domain>/<image-file-name> --header '<your-auth-key>: <your-auth-key-value>' --request DELETE
```

### Upload a wallpaper

```bash
curl --location <your-workers-domain>/<image-file-name> --header '<your-auth-key>: <your-auth-key-value>' --header 'Content-Type: image/jpeg' --data '@<local-path-to-image-file>'
```

* Note that `Content-Type` is based on the image you want to upload.
* The request body is binary.
