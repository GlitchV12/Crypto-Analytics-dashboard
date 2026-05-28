export type InsightType = "tip" | "warning" | "info" | "strategy"

export interface Insight {
  type: InsightType
  title: string
  body: string
}

const TYPE_COLOR: Record<InsightType, string> = {
  tip:      "#3B82F6",
  warning:  "#F59E0B",
  info:     "#8B5CF6",
  strategy: "#10B981",
}

export { TYPE_COLOR }

export const INSIGHTS: Record<string, Insight[]> = {
  BTCUSDT: [
    {
      type: "info",
      title: "Store of Value Thesis",
      body: "Bitcoin's fixed 21M supply makes it deflationary by design. Institutional adoption (ETFs, corporate treasuries) has structurally increased baseline demand.",
    },
    {
      type: "strategy",
      title: "Dollar-Cost Averaging",
      body: "Buying fixed USD amounts on a regular schedule (weekly / monthly) removes the pressure of timing the market and averages your cost basis over cycles.",
    },
    {
      type: "warning",
      title: "Volatility Windows",
      body: "BTC sees amplified moves during US market open (13:00–15:00 UTC) and on weekends when liquidity is thinner. Size positions accordingly.",
    },
    {
      type: "tip",
      title: "Watch the Halving Cycle",
      body: "Historically, the 12–18 months following a halving have produced the strongest bull runs. The next halving is expected in 2028.",
    },
    {
      type: "warning",
      title: "Regulatory Risk",
      body: "Sudden regulatory announcements (spot ETF decisions, mining bans) can move BTC ±15% in hours. Never invest more than you can afford to hold through a 60% drawdown.",
    },
  ],
  ETHUSDT: [
    {
      type: "info",
      title: "Programmable Money",
      body: "Ethereum hosts the majority of DeFi TVL and NFT activity. Its value is driven by demand for blockspace — more usage means more ETH burned via EIP-1559.",
    },
    {
      type: "strategy",
      title: "Staking Yield",
      body: "ETH stakers currently earn ~3–4% APY. This adds a carry component on top of price appreciation, reducing effective drawdown in flat markets.",
    },
    {
      type: "tip",
      title: "Layer-2 Ecosystem",
      body: "Arbitrum, Base, and Optimism settle on Ethereum. L2 growth drives L1 fee revenue — watch L2 transaction volume as a leading indicator.",
    },
    {
      type: "warning",
      title: "Smart Contract Risk",
      body: "DeFi protocol hacks frequently cause ETH price dislocations. A major exploit in a top-10 protocol can drop ETH 10–20% in under an hour.",
    },
    {
      type: "strategy",
      title: "BTC/ETH Ratio",
      body: "Rotate between BTC and ETH based on the ETH/BTC ratio. When BTC dominance is rising, BTC tends to outperform; when it falls, ETH and alts lead.",
    },
  ],
  BNBUSDT: [
    {
      type: "info",
      title: "Exchange Token Mechanics",
      body: "BNB is burned quarterly based on Binance revenue. A strong trading volume quarter → larger burn → supply reduction → upward price pressure.",
    },
    {
      type: "warning",
      title: "Centralization Risk",
      body: "BNB's value is closely tied to Binance's operational health. Regulatory actions against Binance exchange directly affect BNB price.",
    },
    {
      type: "strategy",
      title: "Fee Discount Utility",
      body: "Holding BNB to pay trading fees gives a 25% discount, making it a productive asset for active traders beyond pure speculation.",
    },
    {
      type: "tip",
      title: "BSC DeFi Correlation",
      body: "Activity on BNB Smart Chain (PancakeSwap, Venus) correlates with BNB demand. Monitor BSC daily active addresses as a demand signal.",
    },
  ],
  SOLUSDT: [
    {
      type: "info",
      title: "High-Throughput Architecture",
      body: "Solana processes 65,000+ TPS with sub-second finality. Its tech attracts DeFi and NFT projects that need speed — activity directly drives SOL demand.",
    },
    {
      type: "warning",
      title: "Network Outage History",
      body: "Solana has experienced several multi-hour outages. These events typically cause sharp price drops. Monitor Solana's status page during high-activity periods.",
    },
    {
      type: "strategy",
      title: "Staking + Liquid Staking",
      body: "SOL native staking yields ~6–7% APY. Liquid staking tokens (mSOL, jitoSOL) let you earn yield while keeping capital deployable in DeFi.",
    },
    {
      type: "tip",
      title: "Meme Coin Launch Pad",
      body: "Solana is the dominant chain for meme coin launches (pump.fun). Viral meme seasons drive SOL fee demand and price spikes — watch social sentiment.",
    },
  ],
  XRPUSDT: [
    {
      type: "info",
      title: "Payments & Remittance",
      body: "XRP is designed for cross-border payments. Its value thesis depends on adoption by banks and payment processors using the XRP Ledger for settlement.",
    },
    {
      type: "warning",
      title: "Regulatory Overhang",
      body: "XRP's partial SEC legal victory clarified some aspects but the regulatory environment for XRP in institutional contexts remains evolving. Monitor ongoing developments.",
    },
    {
      type: "strategy",
      title: "News-Driven Moves",
      body: "XRP reacts strongly to partnership announcements, legal updates, and central bank pilot news. Consider event-driven strategies rather than pure trend following.",
    },
    {
      type: "tip",
      title: "Low Base Price Illusion",
      body: "XRP's lower per-unit price doesn't make it cheaper in risk-adjusted terms. Always measure position size in USD value, not token count.",
    },
  ],
}
