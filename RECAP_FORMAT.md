# Recap file format

Daily and weekly recaps are JSON files named `daily-YYYY-MM-DD.json` or
`weekly-YYYY-MM-DD.json`. The app reads every `.json` file in
`<recap folder>/recaps/` (default: `Documents\Hardware Tracker\recaps`) and
picks up new files automatically. The shape is the `Recap` type in
`src/lib/types.ts`; `src/data/catchup-2026-11-24.json` is a full example.

```jsonc
{
  "id": "daily-2026-11-25",          // unique; same id = replaces the older file
  "type": "daily",                   // "daily" | "weekly" | "catchup"
  "date": "2026-11-25",
  "title": "Short headline for the day",
  "summary": "2-4 sentence TL;DR",
  "takeaways": ["what this means for a buyer", "..."],
  "sections": [
    { "category": "GPU",              // "GPU" | "CPU" | "RAM" | "Industry" (companies, CEOs, earnings) | "Other"
      "items": [ { "headline": "...", "detail": "...", "status": "confirmed",  // or "rumor"
                   "sources": [ { "title": "...", "url": "https://..." } ] } ] }
  ],
  "trends": [ { "category": "GPU", "region": "US", "direction": "up", "change": "+3% WoW", "note": "..." } ],
  "alerts": [ { "region": "DE", "item": "RTX 5090", "category": "GPU", "currency": "EUR", "from": 8449.9, "to": 5609.9, "note": "...",
                "source": { "title": "...", "url": "https://..." } } ],
  "prices": [ { "model": "RTX 5080", "category": "GPU", "region": "US", "currency": "USD", "price": 2260, "msrp": 999,
                "date": "2026-11-23", "source": "PC Gamer" } ],
  "sources": [ { "title": "...", "url": "https://..." } ]
}
```

Regions: country codes from `src/lib/regions.ts` (US, CA, BR, UK, DE, FR, IT, ES, NL, PL, BG, CN, JP, KR, TW, IN, AU) plus `EU` and `Global`. Use the local currency code (Bulgaria uses EUR since 2026). Keep `model` names
identical across recaps (e.g. "RTX 5080", "RX 9070 XT",
"DDR5-6000 2x16GB (cheapest)") so the Prices page can draw history lines.
