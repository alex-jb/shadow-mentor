// demos/spatial-finance/providers/openbb-provider.mjs
// The real-data provider — a documented STUB. OpenBB is AGPL-3.0, so it must run
// in a separate process/service and never be imported into Shadow core; this
// class is the isolation boundary. To activate: stand up an OpenBB service, fetch
// quotes + fundamentals, run the risk-parity + capped-fractional-Kelly sizing,
// and map the result onto the PORTFOLIO contract (see providers/README.md +
// provider.mjs PORTFOLIO_CONTRACT). Construct succeeds; getPortfolio() throws
// until implemented — a bank that wires the service sees no throw.
export class OpenBBMarketDataProvider {
  constructor(opts = {}) {
    this.name = "openbb";
    this.opts = opts; // { serviceUrl, apiKey, universe, ... }
  }

  async getPortfolio() {
    throw new Error(
      "OpenBBMarketDataProvider is not implemented. OpenBB is AGPL-3.0 — run it as a " +
      "separate process/service (never import into Shadow core), fetch quotes + " +
      "fundamentals, run risk-parity + capped-Kelly sizing, and map the output onto " +
      "the PORTFOLIO contract. Install is Alex-gated (`pip install openbb` + a data key). " +
      "See demos/spatial-finance/providers/README.md."
    );
  }
}
