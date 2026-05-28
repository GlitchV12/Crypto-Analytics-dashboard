import { useEffect, useRef, useState } from "react"
import { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries } from "lightweight-charts"
import type { IChartApi, ISeriesApi } from "lightweight-charts"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Bar, Line } from "recharts"
import type { Candle } from "../../types"
import { computeBB, computeRSI, computeMACD } from "../../lib/indicators"

interface Props {
  candles: Candle[]
  color:   string
}

type Indicator = "bb" | "rsi" | "macd"

const CHART_BG    = "#0F172A"
const GRID_COLOR  = "#1F2937"
const TEXT_COLOR  = "#475569"
const UP_COLOR    = "#10B981"
const DOWN_COLOR  = "#EF4444"

function fmtTime(sec: number) {
  const d = new Date(sec * 1000)
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

export function CandlestickChart({ candles, color }: Props) {
  const mainRef  = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef   = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const bbUpperRef  = useRef<ISeriesApi<"Line"> | null>(null)
  const bbMiddleRef = useRef<ISeriesApi<"Line"> | null>(null)
  const bbLowerRef  = useRef<ISeriesApi<"Line"> | null>(null)

  const [activeIndicators, setActiveIndicators] = useState<Set<Indicator>>(new Set())

  const toggleIndicator = (ind: Indicator) => {
    setActiveIndicators(prev => {
      const next = new Set(prev)
      next.has(ind) ? next.delete(ind) : next.add(ind)
      return next
    })
  }

  const showBB   = activeIndicators.has("bb")
  const showRSI  = activeIndicators.has("rsi")
  const showMACD = activeIndicators.has("macd")

  // ---- lightweight-charts setup ----
  useEffect(() => {
    if (!mainRef.current || candles.length === 0) return
    const chart = createChart(mainRef.current, {
      layout:     { background: { type: ColorType.Solid, color: CHART_BG }, textColor: TEXT_COLOR },
      grid:       { vertLines: { color: GRID_COLOR }, horzLines: { color: GRID_COLOR } },
      crosshair:  { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: GRID_COLOR },
      timeScale:  { borderColor: GRID_COLOR, timeVisible: true, secondsVisible: false },
      width:  mainRef.current.clientWidth,
      height: 300,
    })
    chartRef.current = chart

    const cs = chart.addSeries(CandlestickSeries, {
      upColor:          UP_COLOR,
      downColor:        DOWN_COLOR,
      borderUpColor:    UP_COLOR,
      borderDownColor:  DOWN_COLOR,
      wickUpColor:      UP_COLOR,
      wickDownColor:    DOWN_COLOR,
    })
    candleSeriesRef.current = cs

    // Bollinger Bands series (hidden until toggled)
    const bbUpper  = chart.addSeries(LineSeries, { color: color + "99", lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
    const bbMiddle = chart.addSeries(LineSeries, { color: color + "55", lineWidth: 1, lastValueVisible: false, priceLineVisible: false, lineStyle: 2 })
    const bbLower  = chart.addSeries(LineSeries, { color: color + "99", lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
    bbUpperRef.current  = bbUpper
    bbMiddleRef.current = bbMiddle
    bbLowerRef.current  = bbLower

    const resize = () => {
      if (mainRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: mainRef.current.clientWidth })
      }
    }
    window.addEventListener("resize", resize)

    return () => {
      window.removeEventListener("resize", resize)
      chart.remove()
      chartRef.current        = null
      candleSeriesRef.current = null
      bbUpperRef.current      = null
      bbMiddleRef.current     = null
      bbLowerRef.current      = null
    }
  }, [color])   // only recreate chart if color changes; data updates handled separately

  // ---- Update data when candles change ----
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return

    const sorted = [...candles].sort((a, b) => a.openTime - b.openTime)

    candleSeriesRef.current.setData(
      sorted.map(c => ({ time: c.openTime as any, open: c.open, high: c.high, low: c.low, close: c.close }))
    )

    const closes = sorted.map(c => c.close)
    const times  = sorted.map(c => c.openTime)

    if (bbUpperRef.current && bbMiddleRef.current && bbLowerRef.current) {
      if (showBB && closes.length >= 20) {
        const bb = computeBB(closes, times)
        bbUpperRef.current.setData(bb.map(p => ({ time: p.time as any, value: p.upper })))
        bbMiddleRef.current.setData(bb.map(p => ({ time: p.time as any, value: p.middle })))
        bbLowerRef.current.setData(bb.map(p => ({ time: p.time as any, value: p.lower })))
      } else {
        bbUpperRef.current.setData([])
        bbMiddleRef.current.setData([])
        bbLowerRef.current.setData([])
      }
    }
  }, [candles, showBB])

  // Derived indicator data for Recharts sub-charts
  const sorted = [...candles].sort((a, b) => a.openTime - b.openTime)
  const closes = sorted.map(c => c.close)
  const times  = sorted.map(c => c.openTime)

  const rsiData  = showRSI  && closes.length >= 15 ? computeRSI(closes, times)  : []
  const macdData = showMACD && closes.length >= 35 ? computeMACD(closes, times) : []

  const INDICATORS: { key: Indicator; label: string }[] = [
    { key: "bb",   label: "BB" },
    { key: "rsi",  label: "RSI" },
    { key: "macd", label: "MACD" },
  ]

  return (
    <div>
      {/* Indicator toggle buttons */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {INDICATORS.map(({ key, label }) => {
          const active = activeIndicators.has(key)
          return (
            <button
              key={key}
              onClick={() => toggleIndicator(key)}
              style={{
                padding: "3px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer",
                border:     `1px solid ${active ? color : "#334155"}`,
                background: active ? color + "22" : "transparent",
                color:      active ? color : "#64748B",
              }}
            >
              {label}
            </button>
          )
        })}
        <span style={{ fontSize: 10, color: "#334155", marginLeft: 4, alignSelf: "center" }}>
          {sorted.length} candles
        </span>
      </div>

      {/* Main candlestick chart */}
      {candles.length === 0 ? (
        <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 13 }}>
          Loading candle data…
        </div>
      ) : (
        <div ref={mainRef} style={{ height: 300 }} />
      )}

      {/* RSI sub-chart */}
      {showRSI && rsiData.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>RSI (14)</div>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={rsiData} margin={{ top: 2, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="time" tickFormatter={fmtTime} tick={{ fill: TEXT_COLOR, fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fill: TEXT_COLOR, fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: CHART_BG, border: "1px solid #334155", fontSize: 10 }}
                labelFormatter={v => fmtTime(v as number)}
                formatter={(v: number) => [v.toFixed(2), "RSI"]}
              />
              <ReferenceLine y={70} stroke="#EF444466" strokeDasharray="3 3" />
              <ReferenceLine y={30} stroke="#10B98166" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="value" stroke="#8B5CF6" fill="#8B5CF622" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* MACD sub-chart */}
      {showMACD && macdData.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>MACD (12, 26, 9)</div>
          <ResponsiveContainer width="100%" height={90}>
            <ComposedChart data={macdData} margin={{ top: 2, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="time" tickFormatter={fmtTime} tick={{ fill: TEXT_COLOR, fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: TEXT_COLOR, fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                contentStyle={{ background: CHART_BG, border: "1px solid #334155", fontSize: 10 }}
                labelFormatter={v => fmtTime(v as number)}
                formatter={(v: number, name: string) => [v.toFixed(4), name]}
              />
              <ReferenceLine y={0} stroke="#334155" />
              <Bar dataKey="histogram" fill="#3B82F644" isAnimationActive={false}
                label={false}
                // colour bars green/red based on value
              />
              <Line type="monotone" dataKey="macd"   stroke="#3B82F6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="signal" stroke="#F59E0B" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
