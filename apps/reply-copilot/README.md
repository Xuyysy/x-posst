# Zane Reply Copilot V2

A Chrome extension for drafting personal, natural replies to X posts. The inline assistant starts only after you click the native Reply control on a post it can identify precisely. The original side panel and context-menu workflow remain available.

## Install and configure

1. Open `chrome://extensions`, turn on Developer mode, and choose **Load unpacked**.
2. Select this `apps/reply-copilot` folder. After updates, choose **Reload** on its extension card and refresh the X tab.
3. Open the extension's Options, save a DeepSeek API key, then use **Test Connection**.
4. Keep **Experimental: fill the reply draft** off unless you explicitly want it. The default behavior is draft-only.

## Inline behavior

- A user click on Reply starts a short, scoped search for the matching reply composer. The extension sends only the clicked post's text and exact status URL to the extension service worker. The service worker calls DeepSeek; the API key is never exposed to the page's content script.
- If the post URL, post text, or matching composer is ambiguous, it does not generate or fill a reply and offers the existing side panel instead.
- The inline card offers Natural, Light Humor, and Thoughtful variants from the same generation. **Change** cycles cached variants first, then starts a new generation. Selecting a variant never edits the composer.
- Draft-only mode never changes X's editor. Copy is explicit.
- Experimental fill is off by default. When enabled, a draft may be inserted only after the user clicked Reply, the exact post and composer still match, and the editor is empty and untouched. If any check fails, the draft remains available to copy. If the user edits the editor, the extension leaves it alone and only offers replacement through a separate explicit button.
- The extension never clicks X's Reply control, presses Post, submits a reply, or decides that a post was published. “I sent this manually” is an optional user-confirmed history event, not a verified publication record.

## Reply style and history

Natural & Friendly is the default intensity; Balanced and Bold are optional settings. Replies should fit the target post and Zane's earlier themes without reproducing their punchy post format. The prompt asks for conversational Chinese or English, and allows a short reaction when that's the most natural reply.

History distinguishes generated, selected, applied, and manually confirmed drafts. Only selected reply text informs future repetition checks. The extension does not read the timeline, open profiles, load author history, or collect replies to the target post.

## X policy and limitations

X's current [Automation Rules](https://help.x.com/en/rules-and-policies/x-automation) state that non-API-based automation such as scripting the X website is not allowed and that AI-powered automated reply bots require prior written and explicit approval. Review those rules and obtain any required approval before using the experimental fill setting or other automated interaction. This extension intentionally leaves sending to the user; that does not itself establish that the extension complies with X policy.

X's page structure can change. If exact post/composer matching fails, use the side panel to select the post text yourself. The extension's API calls require network access to `api.deepseek.com` and a valid DeepSeek key.

## Development

Run the complete unit suite from this directory:

```sh
npm test
```

The suite covers the response parser, prompt/persona, history, DeepSeek client, reply engine, post extraction, Reply control detection, composer safety checks, and inline variant cycling.
