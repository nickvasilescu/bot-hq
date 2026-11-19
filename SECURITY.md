# Security

## Reporting a vulnerability

Please report vulnerabilities privately with GitHub's **Report a vulnerability** button on this repository's **Security** tab. Do not post them in YouTube comments, public issues, pull requests or discussions, where anyone could use them before there is a fix.

Include what you found, how to reproduce it, and what an attacker could do with it. You will get an answer as soon as possible, but responses are best effort: this is a hobby-scale open-source project with no service-level commitment.

Only the `main` branch is supported. Fixes land there; there are no backported releases.

## What you are running

Every bot is an AI agent with a shell, a browser and your connected apps on a shared computer, running as root. Anyone who can sign in to the app, or who can get text in front of a bot (an email it reads, a web page it opens, a message in a connected app), may be able to make it run commands. Treat every key on that computer as readable by the bots.

## Deploying safely

- **Never expose the app on a public URL without sign-in.** Set `ALLOWED_EMAILS` to the people who should get in (the install script requires it), keep `DEV_LOGIN=0`, and use a long random `SESSION_SECRET` (`openssl rand -hex 32`). Remove the public URL when you are not using it.
- **Keep keys on the server.** API keys belong in the server's `.env` (or `*_FILE` files) on the computer, never in the web app, a repository, a chat with a bot, or a screenshot.
- **Set spend limits** with every provider whose key you use (xAI, your model providers, Composio, Orgo), so a runaway or hijacked bot cannot run up a large bill.
- **Use computer-scoped Orgo keys**, limited to the one computer the bots use, rather than account-wide keys that can create, read or delete every computer in your account.
- **Never show keys on screen or in recordings.** Hide `.env` files, terminals and dashboards before you stream, record or share your screen; a key that has been on screen should be rotated.
- **Rotate a key as soon as it may have leaked.** Deleting it from a file or from git history is not enough once it has been public.
- **Connect only the apps a bot needs**, and keep approvals on for actions that send, post or delete.
