package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"analytics-backend/internal/binance"
	"analytics-backend/internal/queue"
	"analytics-backend/internal/storage"
	"analytics-backend/internal/wsHub"
)

const (
	batchSize     = 200
	flushInterval = 150 * time.Millisecond
	queueCap      = 50_000
)

// latestPrices tracks the most recent price for each symbol — used for alert checks.
var (
	latestPrices   = map[string]float64{}
	latestPricesMu sync.RWMutex
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./analytics.db"
	}

	db, err := storage.Open(dbPath)
	if err != nil {
		log.Fatalf("db: %v", err)
	}

	q := queue.New(queueCap)
	hub := wsHub.New()

	// Backfill historical candles from Binance REST API on startup.
	go backfillCandles(db)

	go batchWriter(q, db, hub)
	go binance.Run(q)

	mux := http.NewServeMux()
	handler := corsMiddleware(mux)

	mux.HandleFunc("/ws", hub.ServeWS)

	mux.HandleFunc("/api/stats", func(w http.ResponseWriter, r *http.Request) {
		stats, err := db.GetStats()
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
	})

	mux.HandleFunc("/api/debug", func(w http.ResponseWriter, r *http.Request) {
		lastErr, _ := binance.LastError.Load().(string)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"binanceConnected": binance.Connected.Load() == 1,
			"connectAttempts":  binance.ConnectAttempts.Load(),
			"msgsReceived":     binance.MsgsReceived.Load(),
			"tradesReceived":   binance.TradesReceived.Load(),
			"envParseErrors":   binance.EnvParseErrors.Load(),
			"tradeParseErrors": binance.TradeParseErrors.Load(),
			"wrongEventType":   binance.WrongEventType.Load(),
			"queueDropped":     q.Dropped(),
			"lastError":        lastErr,
		})
	})

	// /api/coin/:symbol         — coin detail (minute buckets, stats)
	// /api/coin/:symbol/candles — OHLCV candles (historical + live)
	mux.HandleFunc("/api/coin/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/coin/")
		w.Header().Set("Content-Type", "application/json")

		if strings.HasSuffix(path, "/candles") {
			symbol := strings.ToUpper(strings.TrimSuffix(path, "/candles"))
			if symbol == "" {
				http.Error(w, "missing symbol", http.StatusBadRequest)
				return
			}
			candles, err := db.GetCoinCandles(symbol, 600)
			if err != nil {
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
			json.NewEncoder(w).Encode(candles)
			return
		}

		symbol := strings.ToUpper(path)
		if symbol == "" {
			http.Error(w, "missing symbol", http.StatusBadRequest)
			return
		}
		det, err := db.GetCoinDetail(symbol)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(det)
	})

	// GET /api/alerts       — list all alerts
	// POST /api/alerts      — create alert  { symbol, direction, price }
	mux.HandleFunc("/api/alerts", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.Method {
		case http.MethodGet:
			alerts, err := db.GetAlerts()
			if err != nil {
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
			if alerts == nil {
				alerts = []storage.Alert{}
			}
			json.NewEncoder(w).Encode(alerts)

		case http.MethodPost:
			var body struct {
				Symbol    string  `json:"symbol"`
				Direction string  `json:"direction"`
				Price     float64 `json:"price"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "bad request", http.StatusBadRequest)
				return
			}
			if body.Symbol == "" || (body.Direction != "above" && body.Direction != "below") || body.Price <= 0 {
				http.Error(w, "invalid fields", http.StatusBadRequest)
				return
			}
			alert, err := db.CreateAlert(body.Symbol, body.Direction, body.Price)
			if err != nil {
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(alert)

		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// DELETE /api/alerts/:id
	mux.HandleFunc("/api/alerts/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		idStr := strings.TrimPrefix(r.URL.Path, "/api/alerts/")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || id <= 0 {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}
		if err := db.DeleteAlert(id); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	log.Printf("Server listening on :%s — streaming %v from Binance", port, binance.Pairs)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal(err)
	}
}

func batchWriter(q *queue.Queue, db *storage.DB, hub *wsHub.Hub) {
	batch := make([]queue.Trade, 0, batchSize)
	flushTicker := time.NewTicker(flushInterval)
	broadcastTicker := time.NewTicker(500 * time.Millisecond)
	defer flushTicker.Stop()
	defer broadcastTicker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}
		if err := db.BatchInsert(batch); err != nil {
			log.Printf("batch insert: %v", err)
		}
		batch = batch[:0]
	}

	for {
		select {
		case t := <-q.Chan():
			batch = append(batch, t)
			if len(batch) >= batchSize {
				flush()
			}
			// Track latest price per symbol for alert checks.
			latestPricesMu.Lock()
			latestPrices[t.Symbol] = t.Price
			latestPricesMu.Unlock()

		case <-flushTicker.C:
			flush()

		case <-broadcastTicker.C:
			if hub.ClientCount() > 0 {
				stats, err := db.GetStats()
				if err == nil {
					hub.Broadcast(map[string]any{"type": "stats", "payload": stats})
				}
			}
			// Check price alerts regardless of connected clients.
			latestPricesMu.RLock()
			prices := make(map[string]float64, len(latestPrices))
			for k, v := range latestPrices {
				prices[k] = v
			}
			latestPricesMu.RUnlock()

			if len(prices) > 0 {
				triggered, err := db.CheckAndTriggerAlerts(prices)
				if err == nil {
					for _, ta := range triggered {
						hub.Broadcast(map[string]any{"type": "alert_triggered", "payload": ta})
						log.Printf("alert triggered: %s %s $%.4f (current $%.4f)", ta.Symbol, ta.Direction, ta.TargetPrice, ta.CurrentPrice)
					}
				}
			}
		}
	}
}

// backfillCandles fetches 1000 1-minute candles per pair from Binance REST API
// and stores them so historical data is available immediately on startup.
func backfillCandles(db *storage.DB) {
	client := &http.Client{Timeout: 15 * time.Second}
	for _, pair := range binance.Pairs {
		symbol := strings.ToUpper(pair)
		url := "https://api.binance.com/api/v3/klines?symbol=" + symbol + "&interval=1m&limit=1000"

		resp, err := client.Get(url)
		if err != nil {
			log.Printf("backfill %s: %v", symbol, err)
			continue
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			log.Printf("backfill read %s: %v", symbol, err)
			continue
		}

		var raw [][]json.RawMessage
		if err := json.Unmarshal(body, &raw); err != nil {
			log.Printf("backfill parse %s: %v", symbol, err)
			continue
		}

		parseFloat := func(r json.RawMessage) float64 {
			var s string
			json.Unmarshal(r, &s)
			v, _ := strconv.ParseFloat(s, 64)
			return v
		}

		candles := make([]storage.Candle, 0, len(raw))
		for _, row := range raw {
			if len(row) < 6 {
				continue
			}
			var openTimeMs int64
			json.Unmarshal(row[0], &openTimeMs)
			candles = append(candles, storage.Candle{
				Symbol:   symbol,
				OpenTime: openTimeMs / 1000, // store as seconds
				Open:     parseFloat(row[1]),
				High:     parseFloat(row[2]),
				Low:      parseFloat(row[3]),
				Close:    parseFloat(row[4]),
				Volume:   parseFloat(row[5]),
			})
		}

		if err := db.InsertCandles(candles); err != nil {
			log.Printf("backfill insert %s: %v", symbol, err)
		} else {
			log.Printf("backfilled %d candles for %s", len(candles), symbol)
		}
		time.Sleep(200 * time.Millisecond) // gentle rate limiting
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
