# X Reply Copilot V1

A personal Chrome extension that helps Zane decide whether an X post deserves a reply, quote, or skip, then drafts three short replies in one consistent voice. The user always copies, pastes, and sends the final text manually.

## Install in Chrome

1. Get this repository on your computer.
2. Open Chrome and visit `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select this repository's `apps/reply-copilot` folder.
5. Open the extension's **Details** page and confirm it is enabled.
6. Open **Extension options** (or the Settings button in its side panel).
7. Enter your DeepSeek API key and click **Save**.
8. Click **Test Connection** and confirm it succeeds.
9. Open `x.com`, select post text, right-click, and choose **Generate Zane Reply**.

The side panel opens and generates a recommendation with Sharp, Funny, and Natural options. Copy a reply, return to X, paste it yourself, then decide whether to send it.

## Daily use

Browse X, select the relevant post text, right-click **Generate Zane Reply**, review the recommendation and candidates, then copy one. The only sending step is yours. Use **Regenerate** to get new options for the same selection.

## What the extension reads and sends

The extension only processes text that you explicitly select and submit from the context menu. It sends that selected text, the Zane persona prompt, and up to 20 recently copied replies to DeepSeek to avoid repetitive phrasing. It stores your API key and copied-reply history in this browser's `chrome.storage.local`; the pending selection is held temporarily in `chrome.storage.session`.

It does not read X's DOM, passwords, cookies, session tokens, full timelines, browsing history, direct messages, Buffer secrets, or content from other websites. There is no X API, X developer account, server, database, or cloud sync. `chrome.storage.local` is not suitable secret management for a commercial SaaS product; this V1 is intended for personal use on your own computer. A commercial product should put provider credentials behind a backend API and should not expose a shared developer key to extension users.

The current page URL is saved as context, but it may be a home timeline URL rather than the selected post's exact status URL. V1 does not inspect X's page to resolve it. Images, video, thread context, author profiles, and post metrics are not included, so recommendations may be incomplete when the selected words depend on them.

## Privacy and manual publishing

Selected text and a small history of replies you chose by clicking Copy go directly from the extension to DeepSeek. Uncopied AI candidates are not added to history. Only successful copies are recorded. History is capped at 100 entries, and only the newest 20 are included in later prompts.

V1 deliberately does not automatically publish replies. It does not open or fill X's reply box, click Reply/Post, comment, like, follow, repost, quote, DM, simulate input, scan timelines, or use browser automation. You are responsible for the final paste and send action.

## Architecture

```text
Context menu → service worker → chrome.storage.session → side panel
                                                   ↓
                                         ReplyEngine → AIClient
                                                   ↑
                                            DeepSeekClient
```

- `background/service-worker.js` registers the X-only selection context menu, validates the selected text, saves a short-lived request, and opens the side panel.
- `sidepanel/sidepanel.js` manages display state, request changes, copy, regeneration, and settings navigation. Each result is applied only if its `requestId` is still current.
- `services/reply-engine.js` validates input, loads recent choices, builds prompts, calls the AI client abstraction, and validates the result.
- `services/deepseek-client.js` makes the timed DeepSeek Chat Completions request. The model name is centralized as `deepseek-flash`; JSON mode is enabled, with thinking disabled for this short task.
- `services/history-service.js` records only copied replies, keeps the latest 100, provides recent history and lightweight style counts.
- `prompts/persona.js` stores Zane's identity, voice, topics, humor, goals, quote rules, and factuality boundaries as structured data.
- `options/options.js` saves or clears the key and makes an explicit, small connection test without sending X content.

## Permissions

The manifest requests `contextMenus`, `storage`, `sidePanel`, and `clipboardWrite`, plus the single host permission `https://api.deepseek.com/*`. There is no X host permission or content script. The selection text is supplied by Chrome's context menu event after the user's explicit action.

## Development and tests

Requires Node.js with native ES modules and the built-in test runner. No dependencies or build step are needed.

```bash
cd apps/reply-copilot
npm test
```

Tests mock `fetch`; they do not contact DeepSeek or incur API charges. Only the user-initiated **Test Connection** button and real generation make live requests.

## Known V1 limits

- Input comes only from manually selected text; no image, video, author, metric, or thread context is available.
- The page URL is not guaranteed to identify the selected post.
- The extension is personal-use software; its locally stored API key is not protected like a server-side secret.
- Chrome UI installation and a live DeepSeek generation require a local Chrome session and a user-provided API key.
