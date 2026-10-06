# RAGMAD-UI

Chat screen for RAGMAD. It lists chats, uploads documents, and shows answers with the passages they used.

## Run

Start the API in the RAGMAD repository first, then:

```bash
npm install
npm run gen:api
npm run dev
```

`gen:api` reads `http://localhost:8000/openapi.json` and writes the typed client to `src/client`. The dev server proxies `/api` to `http://localhost:8000`.
