# Reply Copilot — Commercial Beta 0.1

**AI replies that sound like you.** A local Chrome extension that drafts three conversational reply options for a post you choose. Your profile, API key, history, feedback, and usage indicators are stored in this browser. You choose whether to edit or post anything.

## Install locally

1. Open `chrome://extensions` in Chrome and enable **Developer mode**.
2. Choose **Load unpacked** and select the `apps/reply-copilot` folder in this repository.
3. The first install opens the three-step Welcome page. Choose a voice, save your own DeepSeek key, and test the connection. You can reopen the full settings from the extension icon.
4. Visit X and refresh the tab after loading or reloading the extension. Use the native Reply control, or select post text and choose **Generate Reply** from the context menu.

After code changes, click **Reload** on the extension card and refresh the X tab. Manifest version is `0.1.0` (package beta is `0.1.0-beta`).

## How replies work

- Inline Draft is the default. Clicking X's Reply on a precisely matched post generates Natural, Light Humor, and Thoughtful drafts. Selecting a style reuses that same response; **Try another** cycles candidates, then requests a fresh response. Copy is explicit.
- The prompt uses the local Voice Profile and samples the user deliberately adds. New installs start with a generic profile. Zane is available as an optional preset. The post and profile text are quoted as data; instructions in them do not override the assistant's rules.
- If a user types in the composer, the assistant does not replace that text. Ambiguous post/composer matches fall back to the Side Panel.
- After generation, the assistant attempts to insert one suggestion into the matched empty X composer through Chrome's native Input domain. This requires Chrome's `debugger` extension permission and briefly attaches a debugger to the current X tab. The floating assistant hides its duplicate suggestion after a confirmed insertion. Existing drafts are preserved, and **Copy** remains available when insertion cannot be confirmed. The extension never clicks X's send button.
- No reply is recorded as published. “I sent this manually” is a user action only and does not verify a post.

## Local data and AI provider

The extension sends the selected post text and URL, Voice Profile, any samples you provided, and up to 20 of your previously selected replies (to reduce repetition) to the DeepSeek API endpoint configured in the extension. It does not collect X cookies, passwords, browser history, unrelated timeline posts, or direct messages. It has no analytics or advertising SDK. Selected reply history, usage counters, and feedback stay local and can be cleared in Settings. New history entries do not retain the source post body.

The API key is stored in `chrome.storage.local` and is not read by content scripts. This is local browser storage, not server-side secret protection; anyone with access to the browser profile may be able to access extension data. The extension does not include a developer key. See [PRIVACY.md](PRIVACY.md) for the privacy statement draft. No Chrome Web Store review or approval is claimed.

## Local development and verification

From this directory, run:

```sh
npm test
```

See the manual checklist below for browser verification. The controlled editor fixture at `tests/fixtures/controlled-composer.html` is a local simulation, not proof of real X editor compatibility.

### Manual acceptance checklist

1. Install unpacked as described above; verify Welcome opens once.
2. Set style/language/length/humor, save, reopen settings, and verify values persist. Add and remove a writing sample; optionally load the Zane profile.
3. Save a valid DeepSeek key and use **Test connection**. Confirm the key is masked and survives reload. Test an invalid key and offline/network failure.
4. On X, click Reply on an English post. Confirm the suggestion appears once in the native composer, can be edited and deleted, and the send button matches the actual draft. If Chrome cannot attach its debugger, the assistant retains the suggestion for copying. Check style switching, regenerate, copy, Good, and Not my style; you decide whether to post.
5. Repeat with a Chinese post and check the language matches the post unless your profile overrides it.
6. Close the composer during generation and rapidly switch to another post. Confirm stale responses do not appear in the new assistant.
7. Open Usage, confirm generation/selection/copy/feedback/failure counters, and clear usage and selected reply history independently. Verify nothing claims a published reply.
8. Open `tests/fixtures/controlled-composer.html` locally. Paste into the simulated editor, edit in the middle, use Backspace/Delete, select all and clear, type at the end, add a newline, then trigger its simulated rerender and compare the visible text with the internal state. This does not replace manual verification on X.

## Scope and next architecture seam

The AI boundary is `AIClient`/`DeepSeekClient` behind `ReplyEngine`; replacing `DeepSeekClient` with a hosted backend adapter can be done later without changing the prompt/UI contract. No backend, account system, payment, telemetry, automated publishing, or Chrome Web Store upload is included in this beta.
