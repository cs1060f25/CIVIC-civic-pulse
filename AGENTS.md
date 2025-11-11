# AGENTS.md

CivicPulse is a full‑stack project that aggregates and explores local government documents (agendas, minutes, ordinances) across Kansas. This file gives AI coding agents clear, actionable guidance to work effectively on this repository without disrupting human workflows.

---

## Project overview
- **Frontend**: Next.js 15 (React, TypeScript) in `civicpulse/`.
- **API**: Next.js API Routes under `civicpulse/src/app/api/documents`.
- **Database**: SQLite (file at `backend/data/civicpulse.db`, schema in `backend/db/schema.sql`).
- **Backend utilities**: Python scripts for ingestion and PDF processing in `backend/`.

Key entry points
- Dev server: `civicpulse/` with `npm run dev`.
- DB initialization: `sqlite3 backend/data/civicpulse.db < backend/db/schema.sql` from repo root.
- Example data: use API routes or backend ingestion to populate.

---

## Dev environment tips
- Node 18+, npm 9+, Python 3.9+, SQLite3 installed.
- From repo root, run frontend commands inside `civicpulse/` and backend commands inside `backend/`.
- If Next.js dev server won’t start, clear `.next` and reinstall: `rm -rf civicpulse/.next && (cd civicpulse && npm install && npm run dev)`.
- If API errors mention missing tables, re-apply schema: `sqlite3 backend/data/civicpulse.db < backend/db/schema.sql`.

---

## Build and run
- Frontend dev: `(cd civicpulse && npm install && npm run dev)`.
- Frontend production: `(cd civicpulse && npm run build && npm start)`.
- Database: `sqlite3 backend/data/civicpulse.db < backend/db/schema.sql`.

---

## Code style guidelines
- **Frontend**: Use `eslint-config-next`. Run `npm run lint` in `civicpulse/`.
- **Backend (Python)**: No linter is configured in-repo. Prefer idiomatic, PEP 8–style Python. If you introduce a linter, scope changes narrowly and do not reformat unrelated files without explicit instruction.
- **Commits**: Follow conventional commits as referenced in README (e.g., `feat: ...`, `fix: ...`). Keep changes focused.

---

## Testing instructions

CI status
- No `.github/workflows` directory is present. There is currently no configured CI. If you add CI, keep it minimal and fast.

Frontend tests (Jest)
- Location: `civicpulse/` (configured via `package.json`).
- Commands (from `civicpulse/`):
  - `npm test` — run Jest tests.
  - `npm run test:watch` — watch mode.
  - `npm run test:coverage` — coverage.
- Lint: `npm run lint`.

Backend tests (pytest and unittest)
- Location: `backend/tests/`.
- Frameworks: pytest (e.g., `test_ingestion_basic.py`) and unittest (e.g., `test_pdf_processor_unit.py`).
- Commands:
  - From repo root: `(cd backend && pytest -q)` to run pytest suites.
  - To run unittest module directly: `(cd backend && python -m pytest -q)` will also pick up unittest-style tests collected by pytest.
- Notes:
  - Some tests adjust CWD to `backend/` internally; running from `backend/` is recommended for clarity.

Update policy
- Do not change existing tests unless the user explicitly requests it.
- Update or add tests when:
  - You change public behavior or API contracts.
  - You fix a bug that lacked coverage.
  - You add a new feature.
- Keep tests fast and deterministic. Avoid network calls; mock external I/O.

Suggested lightweight CI plan (if/when added)
- Node job: `npm ci`, `npm run lint`, `npm test` in `civicpulse/`.
- Python job: `pip install -r backend/requirements.txt` (if present) and `pytest -q` in `backend/`.
- Cache Node and pip deps. Trigger on PRs to `main`.

---

## Security considerations
- Do not commit secrets. Use `.env.local` in `civicpulse/` for any local env vars (not currently required per README).
- Treat PDFs and downloaded content as untrusted. Never execute or shell out with unvalidated input.
- SQLite is a single-file DB; avoid long-running write locks. Close connections promptly in scripts.
- When mocking network or file I/O in tests, avoid calling real endpoints.

---

## Data and files
- SQLite DB location: `backend/data/civicpulse.db` (may not exist until initialized).
- Schemas: `backend/db/schema.sql`.
- Configs for ingestion: `backend/configs/`.
- Sample PDFs in repo root are small fixtures for testing.

---

## PR and commit guidelines
- Branch from `main`. Keep PRs focused and small.
- Title format: `[civicpulse] <short title>`.
- Before pushing:
  - Frontend: `npm run lint && npm test` in `civicpulse/`.
  - Backend: run `pytest -q` in `backend/`.
- Include a brief description of changes, risks, and test updates.

---

## Conventions and boundaries for agents
- Prefer minimal diffs. Do not reformat or reorganize unrelated code.
- Do not introduce new services, frameworks, or large dependencies without explicit instruction.
- Keep environment assumptions local: no global installs; use project scripts.
- When changing DB schema, document migrations and update tests.
- For any behavior change, update docs and add/adjust tests accordingly.
- If uncertain about ambiguous requirements, ask for clarification before proceeding.

---

## Quick commands reference
- Init DB: `sqlite3 backend/data/civicpulse.db < backend/db/schema.sql`
- Frontend dev: `(cd civicpulse && npm install && npm run dev)`
- Frontend lint: `(cd civicpulse && npm run lint)`
- Frontend tests: `(cd civicpulse && npm test)`
- Backend tests: `(cd backend && pytest -q)`

---

## Appendix: Known stacks and versions
- Next.js 15.3.3, React 19, TypeScript 5, ESLint 9, Jest 29.
- Python 3.9+; backend tests use pytest and unittest. OCR/PDF utilities in tests are faked; production may use `pymupdf` and `pytesseract`.
