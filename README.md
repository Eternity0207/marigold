# Marigold

**An ofrenda made of their own words.** Bring the WhatsApp chats, letters and cards someone left you. Marigold finds the things they always said, what they called you, and the foods, songs and places they loved, and builds them an altar for Día de los Muertos. Light a candle to read something they wrote you on this day in another year, or ask what they said about anything.

Open models do all the reading **inside your browser tab**. There is no server, no account and no upload, and after the first visit it works offline.

**Marigold never writes as them.** Every word on the altar that is theirs, they really said: sayings are counted, not generated; offerings are kept only if the name appears word for word in their message; search returns their messages, never a summary. The model only helps you *find* their words, and helps *you* write about them.

## Try it

```bash
npm install
npm run dev
```

Open http://localhost:5178 in Chrome or Edge and click **See Abuela Rosa's**: a made-up grandmother with two and a half years of messages and a birthday card. `npm test` checks the parts that need no model.

## How it works

| Job | How | Model |
|---|---|---|
| Read a chat export | WhatsApp Android and iPhone formats, any date order, 12/24-hour clocks (`src/chat.js`) | none |
| Their sayings, what they called you, emoji, the hour they wrote | Counting phrases across messages, compared with yours (`src/words.js`) | none |
| "What did they say about…" | BM25 keywords + meaning search, fused by z-score (`src/search.js`) | gte-small (MIT), 34 MB |
| Offerings: foods, drinks, songs, places, small loves | Meaning search picks likely messages; Gemma names the thing; the name must appear in the message or it is thrown away (`src/offerings.js`) | Gemma 3 1B (WebGPU) or 270M (CPU) |
| A remembrance in your voice | Gemma drafts from your memories and the altar; you edit it | Gemma 3 |

Models run through [Transformers.js](https://github.com/huggingface/transformers.js) and ONNX Runtime Web in a Web Worker, are cached in the Origin Private File System, and the app shell is cached by a service worker.

## Your data

Ofrendas live in this browser's IndexedDB. **Keep → Download .json** saves one file with everything (their messages included, so keep it somewhere private) that you can open again next year or on another device.

## Deploy

`render.yaml` deploys it as a free static site on Render with the cross-origin isolation headers ONNX Runtime needs for multithreading.

## License

MIT. Gemma is provided under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms).
