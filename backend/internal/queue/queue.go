package queue

import (
	"sync/atomic"
)

// Trade represents a single executed trade from Binance.
type Trade struct {
	ID        int64   `json:"id"`
	Symbol    string  `json:"symbol"`
	Price     float64 `json:"price"`
	Quantity  float64 `json:"quantity"`
	Side      string  `json:"side"`      // buy | sell
	Timestamp int64   `json:"timestamp"` // unix ms
}

// Queue is a non-blocking, channel-backed trade queue.
type Queue struct {
	ch      chan Trade
	dropped atomic.Int64
}

func New(capacity int) *Queue {
	return &Queue{ch: make(chan Trade, capacity)}
}

// Push enqueues a trade. Drops silently if buffer is full.
func (q *Queue) Push(t Trade) bool {
	select {
	case q.ch <- t:
		return true
	default:
		q.dropped.Add(1)
		return false
	}
}

func (q *Queue) Chan() <-chan Trade { return q.ch }
func (q *Queue) Dropped() int64    { return q.dropped.Load() }
