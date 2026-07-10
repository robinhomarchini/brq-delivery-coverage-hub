# Context Summarizer Prompt

Summarize only the relevant local context for a Codex escalation.

Rules:

- Keep output under 800 words.
- Prefer file references over copied content.
- Do not include secrets, tokens or full environment files.
- Do not include generated files, `node_modules`, `.next`, caches or unrelated migrations.
- Identify open questions and risk level.
- If the task touches database, auth, security, financial targets, reports or exports, mark it for Codex review.
