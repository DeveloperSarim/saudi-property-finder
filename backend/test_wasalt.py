import asyncio
import json
import re
from curl_cffi.requests import AsyncSession

async def main():
    base_url = "https://wasalt.com/en/villas-for-sale-in-jeddah"
    hdrs = {
        "Accept":          "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer":         "https://wasalt.com/en/",
    }
    async with AsyncSession(impersonate="safari15_3") as safari:
        r = await safari.get(base_url, headers=hdrs, timeout=20)
        print("Status:", r.status_code)
        m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.S)
        if m:
            data = json.loads(m.group(1))
            sr = data.get("props", {}).get("pageProps", {}).get("searchResult", {})
            props = sr.get("properties", [])
            print("Type of properties:", type(props))
            print("Total properties:", len(props))
            types = set(type(x) for x in props)
            print("All element types:", types)
            for idx, x in enumerate(props):
                if not isinstance(x, dict):
                    print(f"Index {idx} is type {type(x)}: {str(x)[:200]}")
        else:
            print("No __NEXT_DATA__ found")

asyncio.run(main())
