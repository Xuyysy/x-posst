# Reply Copilot — Local Beta Privacy Statement Draft

**Version:** 0.1.0-beta  
**Status:** Draft for local beta; not reviewed or approved by the Chrome Web Store.

Reply Copilot processes information you choose to use for drafting a reply. To generate suggestions, the extension sends the selected X post text, its status URL, the Voice Profile you configure, writing samples you choose to provide, and up to 20 previously selected reply drafts (to avoid repeating the same ideas) to the AI provider configured by you (currently DeepSeek at `api.deepseek.com`). Review the provider's privacy terms before use.

Your DeepSeek API key is stored in Chrome extension local storage on this browser profile and sent in authenticated requests to DeepSeek. It is not stored on a Reply Copilot server, and it is not available to the X page content script. Browser-local storage is not server-side secret protection; people or software with access to your browser profile may be able to access it.

Reply Copilot does not collect X passwords or cookies, browsing history, unrelated timeline content, direct messages, or account credentials. It does not include analytics, advertising, or hidden telemetry. Voice Profile, writing samples, selected reply history, feedback, and usage indicators remain in local extension storage. New history entries avoid retaining the full source post. Copying or filling a draft is not treated as publication; publication is not verified.

Automatic draft insertion uses Chrome's `debugger` permission. The extension briefly attaches to the current X tab, sends one `Input.insertText` command for the selected suggestion, and detaches. Chrome may display a debugging notice. The implementation does not use this permission to read network traffic, inspect other tabs, or send a reply.

You can change or clear the API key, edit or reset your Voice Profile, remove individual writing samples, and clear local history and usage data in Settings. Removing the extension also removes its local storage according to Chrome's extension behavior.

This document is a privacy disclosure draft for local testing. Before distribution, the publisher must verify actual data flows, retention, provider terms, legal obligations, contact information, and Chrome Web Store disclosure requirements. No store review or approval is claimed.
