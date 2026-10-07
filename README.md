# X Auto Poster

Personal scheduled text posting through GitHub Actions and Buffer.

The editable `data/posts.json` stays on your computer and is ignored by Git. `data/posts.enc.json` contains the complete document encrypted with AES-256-GCM. GitHub Actions decrypts it only in the runner's temporary directory. Base64 in the file format is encoding; the protection comes from AES-GCM and the secret key.

## Daily use

1. Edit `data/posts.json` locally, using `data/posts.example.json` as the format reference.
2. Run `./upload-posts` from a terminal. It validates the posts, encrypts them using the key in the local `.env`, syncs `main`, and uploads only `data/posts.enc.json`.
3. GitHub Actions will publish due posts on its next external scheduler run.

The local `.env` must contain `POSTS_ENCRYPTION_KEY=<key>` matching the GitHub Actions Secret. Both `.env` and `data/posts.json` are ignored by Git. Keep a secure backup of the key: GitHub does not reveal saved Secret values. To inspect the local file without uploading, run `./upload-posts --check`.

If a post has already been published, keep its ID unchanged. Give new or intentionally republished posts new IDs.

The publisher accepts `POSTS_FILE_PATH`; without it, local runs still read `data/posts.json`. The scheduled and externally dispatched workflow use the same publish path. External cron can continue to call `auto-post.yml` with `trigger_source=external-cron` every 15 minutes.

The repository is public. Earlier Git history still contains plaintext posts; review [public migration notes](docs/public-migration.md) before treating historical posts as private.
