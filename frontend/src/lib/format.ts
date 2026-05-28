export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M"
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K"
  return n.toFixed(0)
}

export function formatUSD(n: number): string {
  if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(2) + "B"
  if (n >= 1_000_000)     return "$" + (n / 1_000_000).toFixed(2) + "M"
  if (n >= 1_000)         return "$" + (n / 1_000).toFixed(1) + "K"
  return "$" + n.toFixed(2)
}

export function formatPrice(n: number): string {
  if (n >= 1000) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 })
  if (n >= 1)    return "$" + n.toFixed(4)
  return "$" + n.toFixed(6)
}

export function formatRate(n: number): string {
  return n.toFixed(1) + "/s"
}

// Strip USDT suffix for display
export function shortSym(s: string): string {
  return s.replace("USDT", "")
}
