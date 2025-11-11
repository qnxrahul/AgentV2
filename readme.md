## Create Your Own Agent V2

Generate Adaptive Cards for Clara AI directly from UI screenshots or mockups. This project provides a React web client for uploading UI images and a Node/Express backend that calls OpenAI’s multimodal models to infer the corresponding Adaptive Card JSON and a ready-to-use Clara page snippet.

### Features
- Upload UI sketches, Figma exports, or screenshots up to 10 MB.
- One-click generation of Adaptive Card payload (`1.5` schema) plus a React snippet that renders it.
- In-browser preview powered by the Adaptive Cards SDK and tools to copy or download the generated assets.
- Health check endpoint and structured error responses for easier observability.

### Project Structure
```
/client   → Vite + React single page app
/server   → Express API for image upload + OpenAI integration
```

### Prerequisites
- Node.js 18+
- An OpenAI API key with access to `gpt-4.1-mini` (or compatible multimodal model).

### Backend Setup (`/server`)
1. Install dependencies:
   ```bash
   cd server
   npm install
   ```
2. Configure environment variables:
   ```bash
   cp .env.example .env
   # edit .env and set OPENAI_API_KEY (and optional OPENAI_MODEL/PORT)
   ```
3. Start the API:
   ```bash
   npm run dev
   ```
   The service listens on `http://localhost:4000` by default.

### Frontend Setup (`/client`)
1. Install dependencies:
   ```bash
   cd client
   npm install
   ```
2. (Optional) Point directly at a remote API:
   ```bash
   cp .env.example .env
   # adjust VITE_API_BASE_URL as needed
   ```
   When no env var is set, the Vite dev server proxies `/api/*` to `http://localhost:4000`.
3. Run the React app:
   ```bash
   npm run dev
   ```
   Visit the printed URL (typically `http://localhost:5173`) and start generating cards.

### API Reference
`POST /api/generate`
- **Body**: `multipart/form-data` with a single file field named `uiImage`.
- **Success Response** (`200`):
  ```json
  {
    "cardJson": { /* Adaptive Card payload */ },
    "cardPage": "<React component snippet rendering the Adaptive Card>",
    "notes": "Optional model commentary"
  }
  ```
- **Error Response** (`4xx/5xx`):
  ```json
  {
    "error": "Human-readable reason",
    "details": "Optional diagnostic information"
  }
  ```

### Development Notes
- The backend uses OpenAI’s `responses.create` API. You can swap `OPENAI_MODEL` (e.g., `gpt-4o-mini`) without code changes.
- Adaptive Card preview leverages the official `adaptivecards` package for accurate rendering.
- Clipboard copy and JSON download helpers make it easy to integrate generated payloads into Clara agents.

### Testing & Validation
- Automated tests are not included yet. For manual verification:
  1. Start the backend (`npm run dev` in `/server`) and frontend (`npm run dev` in `/client`).
  2. Upload a representative UI image through the web app.
  3. Confirm JSON output, copy/download actions, and in-app Adaptive Card preview all function as expected.
- Consider adding integration tests with mocked OpenAI responses if the project will evolve further.

### Troubleshooting
- **401/403 errors**: Check `OPENAI_API_KEY` and model access.
- **CORS issues**: Ensure requests go through the Vite proxy or set `VITE_API_BASE_URL` to a permitted origin.
- **Adaptive Card preview failure**: Inspect the “Model Notes” section; the LLM may have produced an incomplete payload. Adjust the prompt or regenerate.
