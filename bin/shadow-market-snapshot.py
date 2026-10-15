#!/usr/bin/env python3
"""Fetch six public daily-candle responses, once. No keys or trading APIs."""
import concurrent.futures
import datetime
import json
import sys
import urllib.request
from pathlib import Path

SYMBOLS = ['BTC-USD','ETH-USD','SOL-USD','AVAX-USD','LINK-USD','DOGE-USD']
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
def fetch(symbol):
    url=f'https://api.exchange.coinbase.com/products/{symbol}/candles?granularity=86400'
    result={'symbol':symbol,'source_url':url,'request_at':now()}
    try:
        request=urllib.request.Request(url,headers={'User-Agent':'Shadow-Research-Prototype/0.1'})
        with urllib.request.urlopen(request,timeout=20) as response:
            result['final_url']=response.geturl()
            if result['final_url']!=url: raise ValueError('Unexpected redirected source')
            data=response.read(2_000_001)
            if len(data)>2_000_000: raise ValueError('Response exceeds size limit')
            result.update(http_status=response.status,raw_text=data.decode('utf-8'))
    except Exception as error: result['error']=f'{type(error).__name__}: {str(error)[:160]}'
    result['response_at']=now()
    return result
if len(sys.argv)!=2: raise SystemExit('Usage: python3 bin/shadow-market-snapshot.py NEW_COLLECTION_JSON')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor: assets=list(executor.map(fetch,SYMBOLS))
collection={'schema':'shadow-market-collection/1','mode':'PUBLIC_API_SNAPSHOT','fetched_at':now(),'assets':assets}
with Path(sys.argv[1]).open('x',encoding='utf-8') as output: json.dump(collection,output,indent=2)
print(json.dumps({'saved':sys.argv[1],'received':sum('raw_text' in a for a in assets),'failed':sum('error' in a for a in assets)}))
