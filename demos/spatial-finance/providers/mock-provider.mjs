// demos/spatial-finance/providers/mock-provider.mjs
// The default provider: returns the offline fixture. This is what index.html
// inlines for the file:// demo. Same shape a real provider must produce.
import { PORTFOLIO } from "./portfolio-fixture.mjs";

export class MockMarketDataProvider {
  constructor() { this.name = "mock"; }
  async getPortfolio() {
    // return a copy so callers can't mutate the shared fixture
    return structuredClone(PORTFOLIO);
  }
}
