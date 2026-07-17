# Market-data provider boundary

The spatial-finance demo reads its data through a provider so the fixture can be
swapped for a live feed without touching any view. This directory is that
boundary (previously it was only described in docs — now it's real code).

## The contract

Every view reads one object — the `PORTFOLIO` shape in `portfolio-fixture.mjs`
(documented as `PORTFOLIO_CONTRACT` in `provider.mjs`). A provider's
`getPortfolio()` returns an object of that shape. `validatePortfolio()` checks
it (required fields, weights sum ≈ 1.0).

## Providers

- **`mock-provider.mjs`** — `MockMarketDataProvider`, returns the offline fixture.
  This is the default and what `index.html` inlines for the `file://` demo.
- **`openbb-provider.mjs`** — `OpenBBMarketDataProvider`, a documented **stub**.
  Constructs fine; `getPortfolio()` throws until implemented.

```js
import { getProvider } from "./providers/provider.mjs";
const portfolio = await (await getProvider("mock")).getPortfolio();   // or SF_PROVIDER=openbb
```

## Wiring OpenBB (AGPL-3.0 — isolation is mandatory)

OpenBB is **AGPL-3.0**. It must run as a **separate process/service** and must
**never be imported into Shadow core** — `OpenBBMarketDataProvider` is the
isolation boundary. To activate:

1. Stand up an OpenBB service (`pip install openbb` + a data-provider key — Alex-gated).
2. In `OpenBBMarketDataProvider.getPortfolio()`, fetch quotes + fundamentals over
   HTTP/IPC from that service, run the risk-parity + capped-fractional-Kelly
   sizing, and **map the result onto the `PORTFOLIO` contract**.
3. Select it at runtime with `SF_PROVIDER=openbb` (or `getProvider("openbb")`).

The views don't change — they only ever see the contract shape.

## Offline copy + drift guard

`index.html` runs offline as a classic script and can't `import`, so it inlines a
byte-equivalent copy of the fixture. `test/spatial-finance-provider.test.js`
compares the inline copy's tickers + weights + headline numbers against
`portfolio-fixture.mjs` numerically — if they drift, CI fails.
