import json
import logging
import os
import threading
import time
from datetime import datetime

import yfinance as yf
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

_cache_lock = threading.Lock()
_stock_cache: dict = {}          # symbol -> StockData dict
_last_fetch: float = 0.0
_fetch_interval = 60             # seconds between yfinance calls


# ── Config helpers ────────────────────────────────────────────────────────────

def load_config() -> dict:
    defaults = {
        "stocks_list": "AAPL,MSFT,GOOGL,AMZN,NVDA,TSLA",
        "refresh_interval": 60,
    }
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH) as f:
                defaults.update(json.load(f))
        except Exception:
            pass
    return defaults


def save_config(data: dict) -> None:
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)


config = load_config()


# ── Stock fetching ─────────────────────────────────────────────────────────────

def _fetch_ticker(symbol: str) -> dict:
    """Fetch price data for a single ticker; returns a result dict."""
    try:
        info = yf.Ticker(symbol).fast_info
        price = info.last_price
        prev  = info.previous_close
        if price is None or prev is None:
            raise ValueError("missing price data")
        change     = price - prev
        change_pct = (change / prev) * 100 if prev else 0.0
        return {
            "symbol":     symbol.upper(),
            "price":      round(price, 2),
            "prev_close": round(prev, 2),
            "change":     round(change, 2),
            "change_pct": round(change_pct, 2),
            "error":      None,
        }
    except Exception as e:
        logging.warning(f"Failed to fetch {symbol}: {e}")
        return {
            "symbol":     symbol.upper(),
            "price":      None,
            "prev_close": None,
            "change":     None,
            "change_pct": None,
            "error":      str(e),
        }


def refresh_stocks(symbols: list[str]) -> dict:
    """Fetch all symbols in parallel threads and return results keyed by symbol."""
    results: dict = {}
    threads = []

    def _worker(sym: str) -> None:
        results[sym.upper()] = _fetch_ticker(sym)

    for sym in symbols:
        t = threading.Thread(target=_worker, args=(sym,), daemon=True)
        threads.append(t)
        t.start()
    for t in threads:
        t.join(timeout=15)

    return results


def get_stock_data(force: bool = False) -> dict:
    """Return cached stock data, refreshing if the cache is stale."""
    global _stock_cache, _last_fetch, _fetch_interval

    tickers = [s.strip().upper() for s in config.get("stocks_list", "").split(",") if s.strip()]
    _fetch_interval = int(config.get("refresh_interval", 60))

    now = time.time()
    if force or not _stock_cache or (now - _last_fetch) >= _fetch_interval:
        logging.info(f"Fetching stock data for: {tickers}")
        with _cache_lock:
            fresh = refresh_stocks(tickers)
            _stock_cache = fresh
            _last_fetch  = time.time()

    return _stock_cache


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/stocks")
def api_stocks():
    force = request.args.get("force", "false").lower() == "true"
    data  = get_stock_data(force=force)
    return jsonify({
        "stocks":       list(data.values()),
        "fetched_at":   datetime.utcnow().isoformat() + "Z",
        "next_refresh": max(0, int(_fetch_interval - (time.time() - _last_fetch))),
    })


@app.route("/api/config", methods=["GET"])
def api_config_get():
    return jsonify(config)


@app.route("/api/config", methods=["POST"])
def api_config_post():
    global config, _stock_cache, _last_fetch
    body = request.get_json(force=True) or {}

    if "stocks_list" in body:
        config["stocks_list"] = body["stocks_list"]
    if "refresh_interval" in body:
        try:
            config["refresh_interval"] = max(10, int(body["refresh_interval"]))
        except ValueError:
            pass

    save_config(config)
    _stock_cache = {}
    _last_fetch  = 0.0
    return jsonify({"status": "saved", "config": config})


@app.route("/api/history/<symbol>")
def api_history(symbol: str):
    """Return 30 days of closing prices for sparkline charts."""
    period = request.args.get("period", "1mo")
    valid_periods = {"5d", "1mo", "3mo", "6mo", "1y"}
    if period not in valid_periods:
        period = "1mo"
    try:
        hist = yf.Ticker(symbol.upper()).history(period=period)
        closes = [
            {"date": str(idx.date()), "close": round(float(row["Close"]), 2)}
            for idx, row in hist.iterrows()
        ]
        return jsonify({"symbol": symbol.upper(), "history": closes})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    logging.info("Stock dashboard running on http://0.0.0.0:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
