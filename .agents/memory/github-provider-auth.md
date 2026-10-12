---
name: GitHub provider authentication
description: Replit GitHub provider connection state can disagree with shell Git authentication.
---

Verify repository access with a non-mutating Git operation such as `git ls-remote` before promising or attempting a push. Do not assume that a connection card or "active" message means the shell has a working GitHub credential.

**Why:** A connected GitHub source-control integration returned an account-level `not_added` status while `addIntegration` reported success, and shell Git still rejected repository access.

**How to apply:** If shell Git reports an authentication failure, check the integration state and Replit's Git Providers connection flow. Do not ask for or print a token; resolve the connection through Replit's supported reauthorization path before retrying.
