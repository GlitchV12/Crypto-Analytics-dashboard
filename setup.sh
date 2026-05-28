#!/usr/bin/env bash
set -e

echo "==> Setting up Analytics Dashboard"

# Backend
echo ""
echo "--- Installing Go dependencies ---"
cd backend
go mod tidy
echo "Backend ready. Run with: cd backend && go run ./cmd/server"

# Frontend
echo ""
echo "--- Installing npm packages ---"
cd ../frontend
npm install
echo "Frontend ready. Run with: cd frontend && npm run dev"

echo ""
echo "==> Done! Open two terminals:"
echo "  Terminal 1: cd backend && go run ./cmd/server"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Then open http://localhost:5173"
