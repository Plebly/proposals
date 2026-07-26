# Embedding a Plebly proposal

Use the public widget to show a proposal's current status and confirmed on-chain
funding on any HTTPS page:

```html
<div class="plebly-embed" data-proposal-id="PLEBLY-42"></div>
<script async src="https://plebly.fund/embed.js"></script>
```

The widget links to the stable proposal URL, `https://plebly.fund/p/PLEBLY-42`.
It fetches the read-only Worker endpoint
`GET https://plebly-api.securesovereigns.workers.dev/embed/PLEBLY-42`, which
returns:

```json
{
  "id": "PLEBLY-42",
  "title": "Example proposal",
  "status": "funding",
  "balance_sats": 25000,
  "target_sats": 100000,
  "funding_pct": 25,
  "url": "https://plebly.fund/p/PLEBLY-42"
}
```

`balance_sats`, `target_sats`, and `funding_pct` are omitted when the proposal
has no usable escrow address or funding target. The balance is confirmed
on-chain only; it does not represent a custodial balance or authorize a spend.

For a staging or self-hosted API, set `data-api` on the widget element:

```html
<div
  class="plebly-embed"
  data-proposal-id="PLEBLY-42"
  data-api="https://your-worker.example"
></div>
<script async src="https://plebly.fund/embed.js"></script>
```
