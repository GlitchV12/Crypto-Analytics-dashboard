package binance

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"

	"analytics-backend/internal/queue"
)

var Pairs = []string{"btcusdt", "ethusdt", "bnbusdt", "solusdt", "xrpusdt"}

var (
	TradesReceived   atomic.Int64
	ConnectAttempts  atomic.Int64
	Connected        atomic.Int32
	LastError        atomic.Value
	MsgsReceived     atomic.Int64
	EnvParseErrors   atomic.Int64
	TradeParseErrors atomic.Int64
	WrongEventType   atomic.Int64
)

// tickerResponse from GET /api/v3/ticker/24hr
type tickerResponse struct {
	Symbol             string `json:"symbol"`
	LastPrice          string `json:"lastPrice"`
	PriceChangePercent string `json:"priceChangePercent"`
	Volume             string `json:"volume"`       // base asset volume
	QuoteVolume        string `json:"quoteVolume"`  // USDT volume
	HighPrice          string `json:"highPrice"`
	LowPrice           string `json:"lowPrice"`
	Count              int64  `json:"count"` // number of trades in 24h
}

// aggTradeResponse from GET /api/v3/aggTrades
type aggTradeResponse struct {
	ID       int64  `json:"a"`
	Price    string `json:"p"`
	Quantity string `json:"q"`
	IsMaker  bool   `json:"m"`
	Time     int64  `json:"T"`
}

// Run polls Binance REST API — avoids WebSocket geo-blocks on cloud servers.
func Run(q *queue.Queue) {
	client := &http.Client{Timeout: 10 * time.Second}

	symbols := make([]string, len(Pairs))
	for i, p := range Pairs {
		symbols[i] = `"` + toUpper(p) + `"`
	}
	tickerURL := `https://api.binance.com/api/v3/ticker/24hr?symbols=[` +
		joinStrings(symbols, ",") + `]`

	log.Printf("binance: starting REST polling — %v", Pairs)

	for {
		ConnectAttempts.Add(1)
		if err := pollTicker(client, tickerURL, q); err != nil {
			LastError.Store(err.Error())
			log.Printf("binance REST ticker error: %v", err)
			Connected.Store(0)
			time.Sleep(3 * time.Second)
			continue
		}

		// Fetch recent aggTrades for each symbol to get realistic trade flow
		for _, pair := range Pairs {
			sym := toUpper(pair)
			if err := pollAggTrades(client, sym, q); err != nil {
				log.Printf("binance REST aggTrades %s error: %v", sym, err)
			}
			time.Sleep(120 * time.Millisecond) // gentle rate limiting
		}

		Connected.Store(1)
		time.Sleep(2 * time.Second)
	}
}

func pollTicker(client *http.Client, url string, q *queue.Queue) error {
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("ticker HTTP %d", resp.StatusCode)
	}

	var tickers []tickerResponse
	if err := json.NewDecoder(resp.Body).Decode(&tickers); err != nil {
		return err
	}

	MsgsReceived.Add(1)
	if MsgsReceived.Load() <= 3 {
		log.Printf("binance REST: got %d tickers", len(tickers))
	}

	for _, t := range tickers {
		price, _ := strconv.ParseFloat(t.LastPrice, 64)
		qty, _   := strconv.ParseFloat(t.Volume, 64)
		if price == 0 {
			continue
		}
		// Push a synthetic trade so the DB + stats pipeline gets price data
		q.Push(queue.Trade{
			ID:        time.Now().UnixNano(),
			Symbol:    t.Symbol,
			Price:     price,
			Quantity:  qty / 1000, // normalise — actual vol posted via aggTrades
			Side:      "buy",
			Timestamp: time.Now().UnixMilli(),
		})
		TradesReceived.Add(1)
	}
	return nil
}

func pollAggTrades(client *http.Client, symbol string, q *queue.Queue) error {
	url := "https://api.binance.com/api/v3/aggTrades?symbol=" + symbol + "&limit=20"
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil // non-fatal
	}

	var trades []aggTradeResponse
	if err := json.NewDecoder(resp.Body).Decode(&trades); err != nil {
		return err
	}

	for _, t := range trades {
		price, _ := strconv.ParseFloat(t.Price, 64)
		qty, _   := strconv.ParseFloat(t.Quantity, 64)
		if price == 0 {
			continue
		}
		side := "buy"
		if t.IsMaker {
			side = "sell"
		}
		q.Push(queue.Trade{
			ID:        t.ID,
			Symbol:    symbol,
			Price:     price,
			Quantity:  qty,
			Side:      side,
			Timestamp: t.Time,
		})
		TradesReceived.Add(1)
	}
	return nil
}

func toUpper(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'a' && c <= 'z' {
			b[i] = c - 32
		}
	}
	return string(b)
}

func joinStrings(ss []string, sep string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
