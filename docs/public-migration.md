# Public migration notes

Do not switch repository visibility until the checklist below is complete. Removing a file from the latest commit does not remove its earlier versions from Git history.

## Initial key and encrypted posts

1. Install the project: `python -m pip install -e '.[test]'`.
2. Generate a new key with `python scripts/generate_posts_key.py`. It prints `POSTS_ENCRYPTION_KEY=<base64-key>` and does not save it. Keep that value in a secure password manager. Do not put it in a repository file, shell history, issue, or chat.
3. Set `POSTS_ENCRYPTION_KEY` in your local shell environment without committing it. In macOS/Linux shells, `read -r -s POSTS_ENCRYPTION_KEY; export POSTS_ENCRYPTION_KEY` lets you paste the value without placing the value itself in shell history. Use a secure environment-variable entry method in PowerShell on Windows.
4. Run `python scripts/encrypt_posts.py`. This checks that `data/posts.json` is valid JSON and writes `data/posts.enc.json`. It does not delete the local plaintext.
5. In GitHub, open Repository → Settings → Secrets and variables → Actions → New repository secret. Set the name to `POSTS_ENCRYPTION_KEY` and the value to the same Base64 key. `BUFFER_API_KEY` and `BUFFER_CHANNEL_ID` stay there too.
6. Remove `data/posts.json` from Git tracking while keeping the local file, then commit the encrypted file and code. Confirm the GitHub Secret exists before merging the workflow change to the default branch, or publishing will fail closed.

The external scheduler's fine-grained GitHub PAT remains only in cron-job.org's Authorization header. It is not stored in this repository.

## Workflow and recovery

The workflow checks out trusted `main`, installs dependencies, decrypts to `$RUNNER_TEMP/x-auto-poster/posts.json`, passes that path using `POSTS_FILE_PATH`, runs the existing publisher, removes temporary plaintext even if publishing fails, and commits only `data/state.json` if it changed. A missing key, malformed encrypted file, or authentication failure stops publishing. No decrypted post text should be printed in Actions logs.

For key rotation: use the old key to decrypt the current file, generate a new key, re-encrypt the same local `data/posts.json` with it, update the GitHub Secret, then commit the new encrypted file. Coordinate the update so the key and ciphertext match before the next scheduled run. If the key is lost and no local plaintext copy exists, the encrypted file cannot be recovered.

This design hides unreleased post text from readers of the public repository. File size, commit times, Actions run times, source code, and non-sensitive state metadata remain visible. Protecting those would require private storage outside this repository.

## Checklist before Public

- [ ] `data/posts.json` is ignored and no longer tracked at the current tip.
- [ ] `data/posts.enc.json` exists and decrypts with the intended key.
- [ ] `POSTS_ENCRYPTION_KEY`, `BUFFER_API_KEY`, and `BUFFER_CHANNEL_ID` are GitHub Actions Secrets.
- [ ] Current tracked files and Git history have been audited for keys, tokens, and unreleased plaintext posts.
- [ ] Any exposed credentials have been revoked or rotated.
- [ ] Historical unreleased plaintext posts have been removed from reachable Git history, or a fresh repository has been used.
- [ ] Reply Copilot contains no hardcoded DeepSeek key.
- [ ] The publisher workflow has no fork PR trigger and checks out trusted `main`.
- [ ] Encryption and Auto Poster tests pass.
- [ ] A manual workflow run succeeds after the Secret and encrypted file are configured.
- [ ] Actions logs have been checked for plaintext and keys.

Do not rewrite Git history automatically. Rewriting requires a coordinated migration and explicit approval. It changes commit IDs and may require a force push; old clones and forks may retain previous data.
