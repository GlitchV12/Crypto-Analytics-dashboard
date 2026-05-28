package binance

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"analytics-backend/internal/queue"

	"github.com/gorilla/websocket"
)

var Pairs = []string{"btcusdt", "ethusdt", "bnbusdt", "solusdt", "xrpusdt"}

const wsURL = "wss://stream.binance.com:9443/stream?streams="

var (
	TradesReceived  atomic.Int64
	ConnectAttempts atomic.Int64
	Connected       atomic.Int32
	LastError       atomic.Value
	MsgsReceived    atomic.Int64 // raw messages from WS
	EnvParseErrors  atomic.Int64 // failed envelope unmarshal
	TradeParseErrors atomic.Int64 // failed inner trade unmarshal
	WrongEventType  atomic.Int64 // event type != "trade"
)

type envelope struct {
	Stream string          `json:"stream"`
	Data   json.RawMessage `json:"data"`
}

type rawTrade struct {
	EventType string `json:"e"`
	EventTime int64  `json:"E"` // must be explicit — Go JSON is case-insensitive, "E" would collide with "e" otherwise
	TradeID   int64  `json:"t"`
	Symbol    string `json:"s"`
	Price     string `json:"p"`
	Quantity  string `json:"q"`
	IsMaker   bool   `json:"m"`
	TradeTime int64  `json:"T"`
}

func Run(q *queue.Queue) {
	streams := make([]string, len(Pairs))
	for i, p := range Pairs {
		streams[i] = p + "@trade"
	}
	url := wsURL + strings.Join(streams, "/")
	log.Printf("binance: connecting to %s", url)

	for {
		ConnectAttempts.Add(1)
		Connected.Store(0)
		if err := connect(url, q); err != nil {
			msg := err.Error()
			LastError.Store(msg)
			log.Printf("binance ws error: %v — reconnecting in 3s", err)
		}
		time.Sleep(3 * time.Second)
	}
}

var dialer = &websocket.Dialer{
	HandshakeTimeout: 10 * time.Second,
	NetDial: func(network, addr string) (net.Conn, error) {
		return (&net.Dialer{Timeout: 10 * time.Second}).Dial(network, addr)
	},
	Proxy: http.ProxyFromEnvironment,
}

func connect(url string, q *queue.Queue) error {
	conn, _, err := dialer.Dial(url, nil)
	if err != nil {
		return err
	}
	defer conn.Close()
	Connected.Store(1)
	log.Printf("binance: connected — streaming %d pairs", len(Pairs))

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			Connected.Store(0)
			return err
		}
		MsgsReceived.Add(1)

		// Log first 5 raw messages so we can see the real format
		if MsgsReceived.Load() <= 5 {
			log.Printf("binance raw msg #%d: %s", MsgsReceived.Load(), truncate(msg, 200))
		}

		var env envelope
		if err := json.Unmarshal(msg, &env); err != nil {
			EnvParseErrors.Add(1)
			continue
		}
		if env.Data == nil {
			WrongEventType.Add(1)
			continue
		}

		var rt rawTrade
		if err := json.Unmarshal(env.Data, &rt); err != nil {
			if TradeParseErrors.Add(1) <= 3 {
				log.Printf("binance trade parse error: %v | data: %s", err, truncate(env.Data, 150))
			}
			continue
		}
		if rt.EventType != "trade" {
			WrongEventType.Add(1)
			continue
		}

		price, _ := strconv.ParseFloat(rt.Price, 64)
		qty, _ := strconv.ParseFloat(rt.Quantity, 64)
		side := "buy"
		if rt.IsMaker {
			side = "sell"
		}

		q.Push(queue.Trade{
			ID:        rt.TradeID,
			Symbol:    rt.Symbol,
			Price:     price,
			Quantity:  qty,
			Side:      side,
			Timestamp: rt.TradeTime,
		})
		TradesReceived.Add(1)
	}
}

func truncate(b []byte, n int) string {
	if len(b) <= n {
		return string(b)
	}
	return string(b[:n]) + "..."
}
