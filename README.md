# cell

간단한 LLM agent TUI.

## 준비

- Node.js 20+
- OPENROUTER_API_KEY 환경변수 (.env 지원)

## 실행

- 개발: `pnpm dev`
- 빌드: `pnpm build`
- 빌드 결과: `dist/cli.js` (bin: `cell`)

## 옵션

- `CELL_PROVIDER` (기본: `openrouter`)
- `CELL_MODEL` (기본: `openrouter/auto`)
- `CELL_SYSTEM_PROMPT`
