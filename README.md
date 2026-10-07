# X Auto Poster

Personal scheduled text posting through GitHub Actions and Buffer.

The editable `data/posts.json` stays on your computer and is ignored by Git. `data/posts.enc.json` contains the complete document encrypted with AES-256-GCM. GitHub Actions decrypts it only in the runner's temporary directory. Base64 in the file format is encoding; the protection comes from AES-GCM and the secret key.

## Daily use

1. Edit `data/posts.json` locally, using `data/posts.example.json` as the format reference.
2. Set `POSTS_ENCRYPTION_KEY` in your shell environment. Keep the same key that is stored in the repository's GitHub Actions Secret.
3. Run `python scripts/encrypt_posts.py`.
4. Commit and push **only** `data/posts.enc.json`. Never add `data/posts.json`.

The publisher accepts `POSTS_FILE_PATH`; without it, local runs still read `data/posts.json`. The scheduled and externally dispatched workflow use the same publish path. External cron can continue to call `auto-post.yml` with `trigger_source=external-cron` every 15 minutes.

See [public migration notes](docs/public-migration.md) before changing repository visibility. Existing Git history must be reviewed and cleaned before this repository becomes public.
