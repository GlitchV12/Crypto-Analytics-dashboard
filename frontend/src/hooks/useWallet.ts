import { useState, useEffect } from "react"

const WALLET_KEY   = "cs_wallet"
const HISTORY_KEY  = "cs_tx_history"

export interface WalletBalances {
  USDT:    number
  BTCUSDT: number
  ETHUSDT: number
  BNBUSDT: number
  SOLUSDT: number
  XRPUSDT: number
}

export interface Transaction {
  id:        string
  type:      "buy" | "sell"
  symbol:    string
  amount:    number   // crypto amount
  price:     number   // price at time of trade
  total:     number   // USDT
  timestamp: number
  status:    "completed" | "pending" | "failed"
}

const DEFAULT_WALLET: WalletBalances = {
  USDT:    10_000,
  BTCUSDT: 0,
  ETHUSDT: 0,
  BNBUSDT: 0,
  SOLUSDT: 0,
  XRPUSDT: 0,
}

function loadWallet(): WalletBalances {
  try {
    const raw = localStorage.getItem(WALLET_KEY)
    if (raw) return JSON.parse(raw) as WalletBalances
  } catch {}
  return { ...DEFAULT_WALLET }
}

function loadHistory(): Transaction[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw) as Transaction[]
  } catch {}
  return []
}

export function useWallet() {
  const [balances, setBalances] = useState<WalletBalances>(loadWallet)
  const [history,  setHistory]  = useState<Transaction[]>(loadHistory)
  const [error,    setError]    = useState("")

  // Persist on change
  useEffect(() => {
    localStorage.setItem(WALLET_KEY, JSON.stringify(balances))
  }, [balances])

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }, [history])

  function buy(symbol: string, amount: number, price: number): boolean {
    setError("")
    const total = amount * price
    if (balances.USDT < total) {
      setError(`Insufficient USDT. Need ${total.toFixed(2)}, have ${balances.USDT.toFixed(2)}.`)
      return false
    }
    if (amount <= 0 || price <= 0) {
      setError("Invalid amount or price.")
      return false
    }
    const tx: Transaction = {
      id:        crypto.randomUUID(),
      type:      "buy",
      symbol,
      amount,
      price,
      total,
      timestamp: Date.now(),
      status:    "completed",
    }
    setBalances(prev => ({
      ...prev,
      USDT:              prev.USDT - total,
      [symbol]: (prev[symbol as keyof WalletBalances] as number) + amount,
    }))
    setHistory(prev => [tx, ...prev])
    return true
  }

  function sell(symbol: string, amount: number, price: number): boolean {
    setError("")
    const held = (balances[symbol as keyof WalletBalances] as number) ?? 0
    if (held < amount) {
      setError(`Insufficient ${symbol.replace("USDT","")}. Have ${held.toFixed(6)}.`)
      return false
    }
    if (amount <= 0 || price <= 0) {
      setError("Invalid amount or price.")
      return false
    }
    const total = amount * price
    const tx: Transaction = {
      id:        crypto.randomUUID(),
      type:      "sell",
      symbol,
      amount,
      price,
      total,
      timestamp: Date.now(),
      status:    "completed",
    }
    setBalances(prev => ({
      ...prev,
      USDT:              prev.USDT + total,
      [symbol]: (prev[symbol as keyof WalletBalances] as number) - amount,
    }))
    setHistory(prev => [tx, ...prev])
    return true
  }

  function resetWallet() {
    setBalances({ ...DEFAULT_WALLET })
    setHistory([])
    setError("")
  }

  return { balances, history, buy, sell, resetWallet, error, setError }
}
