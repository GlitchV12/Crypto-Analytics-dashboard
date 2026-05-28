package storage

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"analytics-backend/internal/queue"

	_ "github.com/mattn/go-sqlite3"
)

const schema = `
CREATE TABLE IF NOT EXISTS trades (
	id        INTEGER PRIMARY KEY,
	symbol    TEXT    NOT NULL,
	price     REAL    NOT NULL,
	quantity  REAL    NOT NULL,
	side      TEXT    NOT NULL,
	ts        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trades_ts     ON trades(ts);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);

CREATE TABLE IF NOT EXISTS candles (
	symbol    TEXT    NOT NULL,
	open_time INTEGER NOT NULL,
	open      REAL    NOT NULL,
	high      REAL    NOT NULL,
	low       REAL    NOT NULL,
	close     REAL    NOT NULL,
	volume    REAL    NOT NULL,
	PRIMARY KEY (symbol, open_time)
);
CREATE INDEX IF NOT EXISTS idx_candles_sym ON candles(symbol, open_time);

CREATE TABLE IF NOT EXISTS alerts (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	symbol     TEXT    NOT NULL,
	direction  TEXT    NOT NULL,
	price      REAL    NOT NULL,
	active     INTEGER NOT NULL DEFAULT 1,
	created_at INTEGER NOT NULL
);
`

type DB struct {
	db *sql.DB
}

func Open(path string) (*DB, error) {
	db, err := sql.Open("sqlite3", path+"?_journal=WAL&_busy_timeout=5000&_synchronous=NORMAL")
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	db.SetMaxOpenConns(1)
	if _, err = db.Exec(schema); err != nil {
		return nil, fmt.Errorf("schema: %w", err)
	}
	return &DB{db}, nil
}

func (d *DB) BatchInsert(trades []queue.Trade) error {
	if len(trades) == 0 {
		return nil
	}
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO trades (id,symbol,price,quantity,side,ts) VALUES (?,?,?,?,?,?)`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	for _, t := range trades {
		if _, err = stmt.Exec(t.ID, t.Symbol, t.Price, t.Quantity, t.Side, t.Timestamp); err != nil {
			log.Printf("insert error: %v", err)
		}
	}
	return tx.Commit()
}

// ---- Stats types ----

type Stats struct {
	TradesPerSec  float64        `json:"tradesPerSec"`
	TotalTrades   int64          `json:"totalTrades"`
	TotalVolume   float64        `json:"totalVolume"`
	SymbolStats   []SymbolStat   `json:"symbolStats"`
	SideSplit     []SideCount    `json:"sideSplit"`
	Timeline      []TimePoint    `json:"timeline"`
	PriceHistory  []PricePoint   `json:"priceHistory"`
	Timestamp     int64          `json:"timestamp"`
}

type SymbolStat struct {
	Symbol    string  `json:"symbol"`
	Trades    int64   `json:"trades"`
	Volume    float64 `json:"volume"`
	LastPrice float64 `json:"lastPrice"`
	AvgPrice  float64 `json:"avgPrice"`
}

type SideCount struct {
	Side  string `json:"side"`
	Count int64  `json:"count"`
}

type TimePoint struct {
	Second int64 `json:"second"`
	Count  int64 `json:"count"`
}

type PricePoint struct {
	Second int64              `json:"second"`
	Prices map[string]float64 `json:"prices"`
}

type CoinMinuteBucket struct {
	Minute    int64   `json:"minute"`
	AvgPrice  float64 `json:"avgPrice"`
	Trades    int64   `json:"trades"`
	Volume    float64 `json:"volume"`
	BuyCount  int64   `json:"buyCount"`
	SellCount int64   `json:"sellCount"`
}

type CoinDetail struct {
	Symbol    string             `json:"symbol"`
	History   []CoinMinuteBucket `json:"history"`
	LastPrice float64            `json:"lastPrice"`
	MinPrice  float64            `json:"minPrice"`
	MaxPrice  float64            `json:"maxPrice"`
	Trades    int64              `json:"trades"`
	Volume    float64            `json:"volume"`
	BuyCount  int64              `json:"buyCount"`
	SellCount int64              `json:"sellCount"`
}

func (d *DB) GetCoinDetail(symbol string) (*CoinDetail, error) {
	det := &CoinDetail{Symbol: symbol}
	now := time.Now().Unix() * 1000
	window2h := now - 7_200_000

	d.db.QueryRow(`SELECT COALESCE(price,0) FROM trades WHERE symbol=? ORDER BY ts DESC LIMIT 1`, symbol).
		Scan(&det.LastPrice)

	d.db.QueryRow(`
		SELECT COALESCE(MIN(price),0), COALESCE(MAX(price),0), COUNT(*), COALESCE(SUM(price*quantity),0)
		FROM trades WHERE symbol=? AND ts > ?`, symbol, window2h,
	).Scan(&det.MinPrice, &det.MaxPrice, &det.Trades, &det.Volume)

	rows, _ := d.db.Query(`SELECT side, COUNT(*) FROM trades WHERE symbol=? AND ts > ? GROUP BY side`, symbol, window2h)
	if rows != nil {
		for rows.Next() {
			var side string
			var count int64
			rows.Scan(&side, &count)
			if side == "buy" {
				det.BuyCount = count
			} else {
				det.SellCount = count
			}
		}
		rows.Close()
	}

	rows, _ = d.db.Query(`
		SELECT (ts/60000)*60 as min_sec,
		       AVG(price),
		       COUNT(*),
		       COALESCE(SUM(price*quantity),0),
		       SUM(CASE WHEN side='buy'  THEN 1 ELSE 0 END),
		       SUM(CASE WHEN side='sell' THEN 1 ELSE 0 END)
		FROM trades WHERE symbol=? AND ts > ?
		GROUP BY min_sec ORDER BY min_sec ASC`, symbol, window2h)
	if rows != nil {
		for rows.Next() {
			var b CoinMinuteBucket
			rows.Scan(&b.Minute, &b.AvgPrice, &b.Trades, &b.Volume, &b.BuyCount, &b.SellCount)
			det.History = append(det.History, b)
		}
		rows.Close()
	}

	return det, nil
}

// ---- Candle types & methods ----

type Candle struct {
	Symbol   string  `json:"symbol"`
	OpenTime int64   `json:"openTime"` // Unix seconds
	Open     float64 `json:"open"`
	High     float64 `json:"high"`
	Low      float64 `json:"low"`
	Close    float64 `json:"close"`
	Volume   float64 `json:"volume"`
}

func (d *DB) InsertCandles(candles []Candle) error {
	if len(candles) == 0 {
		return nil
	}
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO candles (symbol,open_time,open,high,low,close,volume) VALUES (?,?,?,?,?,?,?)`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	for _, c := range candles {
		stmt.Exec(c.Symbol, c.OpenTime, c.Open, c.High, c.Low, c.Close, c.Volume)
	}
	return tx.Commit()
}

// GetCoinCandles returns OHLCV candles for a symbol, merging stored candles with
// live trade data for any minutes not yet in the candles table.
func (d *DB) GetCoinCandles(symbol string, limit int) ([]Candle, error) {
	rows, err := d.db.Query(`
		SELECT open_time, open, high, low, close, volume
		FROM candles WHERE symbol=?
		ORDER BY open_time DESC LIMIT ?`, symbol, limit)
	if err != nil {
		return nil, err
	}
	var candles []Candle
	var latestStored int64
	for rows.Next() {
		var c Candle
		c.Symbol = symbol
		rows.Scan(&c.OpenTime, &c.Open, &c.High, &c.Low, &c.Close, &c.Volume)
		candles = append(candles, c)
		if c.OpenTime > latestStored {
			latestStored = c.OpenTime
		}
	}
	rows.Close()

	// Reverse stored candles to chronological order
	for i, j := 0, len(candles)-1; i < j; i, j = i+1, j-1 {
		candles[i], candles[j] = candles[j], candles[i]
	}

	// Supplement with live trade data for minutes after the last stored candle
	since := (latestStored * 1000) // convert stored seconds back to ms
	if since == 0 {
		since = time.Now().UnixMilli() - 7_200_000 // fall back to 2h window
	}

	tradeRows, err := d.db.Query(`
		SELECT ts, price, quantity
		FROM trades WHERE symbol=? AND ts > ?
		ORDER BY ts ASC`, symbol, since)
	if err == nil {
		type accum struct{ open, high, low, close, vol float64 }
		buckets := map[int64]*accum{}
		for tradeRows.Next() {
			var ts int64
			var price, qty float64
			tradeRows.Scan(&ts, &price, &qty)
			min := (ts / 60000) * 60
			if _, ok := buckets[min]; !ok {
				buckets[min] = &accum{open: price, high: price, low: price, close: price}
			}
			b := buckets[min]
			if price > b.high { b.high = price }
			if price < b.low  { b.low  = price }
			b.close = price
			b.vol += price * qty
		}
		tradeRows.Close()
		for min, b := range buckets {
			if min <= latestStored { // don't overwrite stored candles
				continue
			}
			candles = append(candles, Candle{
				Symbol: symbol, OpenTime: min,
				Open: b.open, High: b.high, Low: b.low, Close: b.close, Volume: b.vol,
			})
		}
		// Sort merged result by open_time
		for i := 1; i < len(candles); i++ {
			for j := i; j > 0 && candles[j].OpenTime < candles[j-1].OpenTime; j-- {
				candles[j], candles[j-1] = candles[j-1], candles[j]
			}
		}
	}

	return candles, nil
}

// ---- Alert types & methods ----

type Alert struct {
	ID        int64   `json:"id"`
	Symbol    string  `json:"symbol"`
	Direction string  `json:"direction"` // "above" | "below"
	Price     float64 `json:"price"`
	Active    bool    `json:"active"`
	CreatedAt int64   `json:"createdAt"`
}

type TriggeredAlert struct {
	ID           int64   `json:"id"`
	Symbol       string  `json:"symbol"`
	Direction    string  `json:"direction"`
	TargetPrice  float64 `json:"targetPrice"`
	CurrentPrice float64 `json:"currentPrice"`
}

func (d *DB) CreateAlert(symbol, direction string, price float64) (Alert, error) {
	now := time.Now().UnixMilli()
	res, err := d.db.Exec(
		`INSERT INTO alerts (symbol,direction,price,active,created_at) VALUES (?,?,?,1,?)`,
		symbol, direction, price, now,
	)
	if err != nil {
		return Alert{}, err
	}
	id, _ := res.LastInsertId()
	return Alert{ID: id, Symbol: symbol, Direction: direction, Price: price, Active: true, CreatedAt: now}, nil
}

func (d *DB) GetAlerts() ([]Alert, error) {
	rows, err := d.db.Query(`SELECT id,symbol,direction,price,active,created_at FROM alerts ORDER BY id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var alerts []Alert
	for rows.Next() {
		var a Alert
		var active int
		rows.Scan(&a.ID, &a.Symbol, &a.Direction, &a.Price, &active, &a.CreatedAt)
		a.Active = active == 1
		alerts = append(alerts, a)
	}
	return alerts, nil
}

func (d *DB) DeleteAlert(id int64) error {
	_, err := d.db.Exec(`DELETE FROM alerts WHERE id=?`, id)
	return err
}

func (d *DB) CheckAndTriggerAlerts(latestPrices map[string]float64) ([]TriggeredAlert, error) {
	rows, err := d.db.Query(`SELECT id,symbol,direction,price FROM alerts WHERE active=1`)
	if err != nil {
		return nil, err
	}
	type row struct{ id int64; symbol, direction string; price float64 }
	var active []row
	for rows.Next() {
		var r row
		rows.Scan(&r.id, &r.symbol, &r.direction, &r.price)
		active = append(active, r)
	}
	rows.Close()

	var triggered []TriggeredAlert
	for _, a := range active {
		cur, ok := latestPrices[a.symbol]
		if !ok {
			continue
		}
		fire := (a.direction == "above" && cur >= a.price) || (a.direction == "below" && cur <= a.price)
		if fire {
			d.db.Exec(`UPDATE alerts SET active=0 WHERE id=?`, a.id)
			triggered = append(triggered, TriggeredAlert{
				ID: a.id, Symbol: a.symbol,
				Direction: a.direction, TargetPrice: a.price, CurrentPrice: cur,
			})
		}
	}
	return triggered, nil
}

func (d *DB) GetStats() (*Stats, error) {
	s := &Stats{Timestamp: time.Now().UnixMilli()}
	now := time.Now().Unix() * 1000
	window1m := now - 60_000
	window5m := now - 300_000

	// total trades & volume last 5m
	d.db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(price*quantity),0) FROM trades WHERE ts > ?`, window5m).
		Scan(&s.TotalTrades, &s.TotalVolume)

	// trades/sec over last 10s
	var recent int64
	d.db.QueryRow(`SELECT COUNT(*) FROM trades WHERE ts > ?`, now-10_000).Scan(&recent)
	s.TradesPerSec = float64(recent) / 10.0

	// per-symbol stats last 1m
	rows, _ := d.db.Query(`
		SELECT symbol,
		       COUNT(*) as trades,
		       COALESCE(SUM(price*quantity),0) as vol,
		       MAX(price) as last_price,
		       AVG(price) as avg_price
		FROM trades WHERE ts > ?
		GROUP BY symbol ORDER BY vol DESC`, window1m)
	if rows != nil {
		for rows.Next() {
			var ss SymbolStat
			rows.Scan(&ss.Symbol, &ss.Trades, &ss.Volume, &ss.LastPrice, &ss.AvgPrice)
			s.SymbolStats = append(s.SymbolStats, ss)
		}
		rows.Close()
	}

	// buy/sell split last 1m
	rows, _ = d.db.Query(`SELECT side, COUNT(*) FROM trades WHERE ts > ? GROUP BY side`, window1m)
	if rows != nil {
		for rows.Next() {
			var sc SideCount
			rows.Scan(&sc.Side, &sc.Count)
			s.SideSplit = append(s.SideSplit, sc)
		}
		rows.Close()
	}

	// timeline: trades/sec last 60s
	rows, _ = d.db.Query(`
		SELECT (ts/1000) as sec, COUNT(*) as c
		FROM trades WHERE ts > ?
		GROUP BY sec ORDER BY sec ASC`, window1m)
	if rows != nil {
		for rows.Next() {
			var tp TimePoint
			rows.Scan(&tp.Second, &tp.Count)
			s.Timeline = append(s.Timeline, tp)
		}
		rows.Close()
	}

	// price history per symbol: avg price per 5-second bucket, last 60s
	rows, _ = d.db.Query(`
		SELECT (ts/5000)*5 as bucket, symbol, AVG(price) as avg_price
		FROM trades WHERE ts > ?
		GROUP BY bucket, symbol ORDER BY bucket ASC`, window1m)
	if rows != nil {
		buckets := map[int64]map[string]float64{}
		for rows.Next() {
			var bucket int64
			var sym string
			var price float64
			rows.Scan(&bucket, &sym, &price)
			if buckets[bucket] == nil {
				buckets[bucket] = map[string]float64{}
			}
			buckets[bucket][sym] = price
		}
		rows.Close()
		for sec, prices := range buckets {
			s.PriceHistory = append(s.PriceHistory, PricePoint{Second: sec, Prices: prices})
		}
	}

	return s, nil
}
