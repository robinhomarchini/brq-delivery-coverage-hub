# Local Classifier Prompt

Classify the user request for this repository.

Allowed labels:

- `LOCAL_ONLY`: summarize, locate files, explain logs, classify, generate short checklists, condense docs.
- `CODEX_STANDARD`: component, hook, navigation, report, dashboard, export, repository or medium-risk refactor work.
- `CODEX_CRITICAL`: database schema, migrations, RPC, RLS/RBAC, auth, authorization, security, financial source of truth, transactional behavior, production config or cross-layer architecture.
- `UNKNOWN`: unclear request.

Critical rules override all other labels. Never choose `LOCAL_ONLY` for code, database, security, production or financial source-of-truth changes.

Return compact JSON only:

```json
{"classification":"CODEX_STANDARD","reason":"short reason"}
```
