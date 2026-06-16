"""
Property listing scrapers and API endpoints.
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import AsyncIterator, Optional
from urllib.parse import quote, urlencode

from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession
from deep_translator import GoogleTranslator
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from shared import (
    BAYUT_ALGOLIA_APP_ID, BAYUT_ALGOLIA_API_KEY, BAYUT_ALGOLIA_URL,
    PROPERTY_IMAGES,
    _h, _jh, _city_from_location, _haversine_km, _get_coords,
    _int, _str, _clean_phone, _sse,
)

router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────────
# Platform search URL builder
# ─────────────────────────────────────────────────────────────────────────────

def _platform_search_url(platform_name: str, location: str, prop_type: str,
                         listing_type: str, min_price: Optional[int],
                         max_price: Optional[int], rooms: Optional[int]) -> str:
    loc       = location.strip()
    loc_lower = loc.lower()
    loc_slug  = loc_lower.replace(" ", "-")
    ltype     = "sale" if listing_type == "sale" else "rent"

    BAYUT_TYPES = {
        "apartment":"apartments", "villa":"villas", "house":"houses",
        "office":"offices", "land":"land", "commercial":"commercial-spaces",
        "residential":"residential-buildings", "building":"residential-buildings",
    }
    PF_SALE_TYPES = {
        "apartment":"apartments-for-sale",  "villa":"villas-for-sale",
        "house":"houses-for-sale",          "office":"offices-for-sale",
        "land":"land-for-sale",             "commercial":"commercial-for-sale",
        "residential":"whole-building-for-sale", "building":"whole-building-for-sale",
    }
    PF_RENT_TYPES = {
        "apartment":"apartments-for-rent",  "villa":"villas-for-rent",
        "house":"houses-for-rent",          "office":"offices-for-rent",
        "land":"land-for-rent",             "commercial":"commercial-for-rent",
        "residential":"whole-building-for-rent", "building":"whole-building-for-rent",
    }
    AQAR_TYPE_AR = {
        "apartment":"شقة", "villa":"فيلا", "house":"منزل",
        "land":"أرض", "office":"مكتب", "commercial":"تجاري",
        "residential":"عمارة", "building":"عمارة",
    }
    AQAR_CITY_AR = {
        "riyadh":"الرياض", "jeddah":"جدة", "dammam":"الدمام",
        "mecca":"مكة", "medina":"المدينة", "khobar":"الخبر",
        "al khobar":"الخبر", "abha":"أبها", "tabuk":"تبوك",
        "buraidah":"بريدة", "hail":"حائل", "al taif":"الطائف",
        "yanbu":"ينبع", "najran":"نجران", "jazan":"جازان",
    }

    if platform_name == "Bayut":
        seg  = "for-sale" if ltype == "sale" else "for-rent"
        prop = BAYUT_TYPES.get(prop_type, "properties")
        p = {}
        if min_price: p["price_min"] = min_price
        if max_price: p["price_max"] = max_price
        if rooms:     p["bedrooms"]  = rooms
        qs = ("?" + urlencode(p)) if p else ""
        return f"https://www.bayut.sa/{seg}/{prop}/{loc_slug}/{qs}"

    if platform_name == "Aqar":
        type_ar = AQAR_TYPE_AR.get(prop_type, "عقار")
        city_ar = AQAR_CITY_AR.get(loc_lower, loc)
        purpose_ar = "للبيع" if ltype == "sale" else "للإيجار"
        q = quote(f"{type_ar} {purpose_ar} في {city_ar}")
        return f"https://aqar.fm/search?q={q}"

    if platform_name == "PropertyFinder":
        seg = "buy" if ltype == "sale" else "rent"
        type_slug = (PF_SALE_TYPES if ltype == "sale" else PF_RENT_TYPES).get(prop_type, f"properties-for-{ltype}")
        return f"https://www.propertyfinder.sa/en/{seg}/{type_slug}-in-{loc_slug}/"

    if platform_name == "Wasalt":
        purpose = "buy" if ltype == "sale" else "rent"
        prop_slug = {"apartment":"apartment","villa":"villa","house":"house",
                     "office":"office","land":"land","commercial":"commercial"}.get(prop_type,"apartment")
        return f"https://wasalt.com/en/properties?purpose={purpose}&type={prop_slug}&city={loc_slug}"

    if platform_name == "Sakani":
        city_ar = AQAR_CITY_AR.get(loc_lower, loc)
        return f"https://sakani.sa/en/projects?city={quote(city_ar)}"

    if platform_name == "Haraj":
        type_ar = AQAR_TYPE_AR.get(prop_type, "عقار")
        city_ar = AQAR_CITY_AR.get(loc_lower, loc)
        q = quote(f"{type_ar} {city_ar}")
        return f"https://haraj.com.sa/search?q={q}"

    if platform_name == "OpenSooq":
        cat_map = {
            "apartment": "apartments",  "villa": "villas",
            "house": "houses",          "land": "lands",
            "office": "offices",        "commercial": "commercial-properties",
        }
        purpose = "for-sale" if ltype == "sale" else "for-rent"
        cat = cat_map.get(prop_type, "real-estate")
        return f"https://sa.opensooq.com/{cat}-{purpose}/{loc_slug}"

    if platform_name == "Expatriates":
        sub = "for-sale" if ltype == "sale" else "for-rent"
        return f"https://www.expatriates.com/classifieds/saudi-arabia/real-estate/{sub}/"

    if platform_name == "Mourjan":
        purpose = "for-sale" if ltype == "sale" else "for-rent"
        return f"https://sa.mourjan.com/classifieds/saudi-arabia/real-estate-{purpose}/"

    if platform_name == "Satel":
        return "https://satel.sa/compounds"

    if platform_name == "Zaahib":
        return f"https://zaahib.com/search?purpose={ltype}&city={loc_slug}"

    if platform_name == "Bezaat":
        return f"https://bezaat.com/sa/real-estate?type={ltype}&city={loc_slug}"

    if platform_name == "SaudiDeal":
        return f"https://saudi-deal.com/properties?purpose={ltype}&city={loc_slug}"

    return "https://www.bayut.sa"

# ─────────────────────────────────────────────────────────────────────────────
# Base scraper
# ─────────────────────────────────────────────────────────────────────────────

_TYPE_INCLUDE = {
    "apartment":  ["apartment","flat","studio","شقة","شقق"],
    "villa":      ["villa","فيلا","townhouse","دوبلكس","duplex"],
    "house":      ["house","منزل","townhouse"],
    "residential":["residential","building","عمارة","مبنى","عمارات","عماير"],
    "building":   ["residential","building","عمارة","مبنى","عمارات","عماير"],
    "office":     ["office","مكتب","workspace"],
    "shop":       ["shop","محل","retail","showroom","store","دكان"],
    "land":       ["land","plot","أرض","قطعة"],
    "commercial": ["commercial","shop","retail","تجاري","محل","showroom"],
}
_TYPE_EXCLUDE = {
    "apartment":  ["villa","فيلا","أرض","land plot"],
    "villa":      ["apartment","flat","studio","شقة","office","أرض","land plot","عمارة"],
    "house":      ["apartment","flat","office","أرض","عمارة"],
    "residential":["شقة","apartment","villa","فيلا","أرض","land","studio","flat","استوديو"],
    "building":   ["شقة","apartment","villa","فيلا","أرض","land","studio","flat","استوديو"],
    "office":     ["apartment","villa","land","فيلا","أرض","عمارة"],
    "shop":       ["apartment","flat","villa","فيلا","شقة","land","أرض","office","مكتب","عمارة"],
    "land":       ["apartment","villa","office","فيلا","شقة","عمارة"],
    "commercial": ["apartment","villa","فيلا","شقة"],
}


class BaseScraper:
    platform_name: str = "Unknown"
    base_url: str = ""
    mock_count: int = 8

    def __init__(self, location, min_price, max_price, rooms, property_type, listing_type,
                 area_slug: str = "", district_slug: str = "",
                 min_area: int = None, max_area: int = None):
        self.location      = location
        self.min_price     = min_price
        self.max_price     = max_price
        self.rooms         = rooms
        self.property_type = property_type.lower()
        self.listing_type  = listing_type.lower()
        self.area_slug     = area_slug     # e.g. "/riyadh/north-riyadh"
        self.district_slug = district_slug # e.g. "/riyadh/north-riyadh/al-olaya"
        self.min_area      = min_area
        self.max_area      = max_area

    async def scrape(self, client: AsyncSession) -> list[dict]:
        raise NotImplementedError

    def _type_filter(self, results: list[dict]) -> list[dict]:
        inc = _TYPE_INCLUDE.get(self.property_type, [])
        exc = _TYPE_EXCLUDE.get(self.property_type, [])
        # If no exclusion rules exist, return all results as-is
        if not exc:
            return results
        filtered = []
        for r in results:
            title = (r.get("title", "") or "").lower()
            # Exclude listings whose title contains a forbidden keyword
            if any(k in title for k in exc):
                continue
            filtered.append(r)
        return filtered

    def _with_coords(self, item: dict) -> dict:
        if "lat" not in item or not item["lat"]:
            import random
            lat, lng = _get_coords(self.location)
            item["lat"] = lat
            item["lng"] = lng
        if "area_sqm" not in item:
            import random
            item["area_sqm"] = random.randint(80, 500)
        return item

    def _extract_next_data(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "lxml")
        tag = soup.find("script", id="__NEXT_DATA__")
        if tag and tag.string:
            try:
                data = json.loads(tag.string)
                return self._walk_json(data)
            except: pass
        return []

    def _walk_json(self, data, depth=0) -> list[dict]:
        if depth > 10: return []
        out = []
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and ("price" in item or "title" in item):
                    n = self._norm(item)
                    if n: out.append(n)
                elif isinstance(item, (dict, list)):
                    out.extend(self._walk_json(item, depth+1))
        elif isinstance(data, dict):
            for k, v in data.items():
                if k in ("hits","properties","listings","results","data","searchResult","items"):
                    out.extend(self._walk_json(v, depth+1))
                elif isinstance(v, (dict, list)):
                    out.extend(self._walk_json(v, depth+1))
        seen, deduped = set(), []
        for r in out:
            key = r.get("source_url","") + str(r.get("price_sar",""))
            if key not in seen:
                seen.add(key)
                deduped.append(r)
        return deduped[:20]

    def _norm(self, item: dict) -> Optional[dict]:
        price = _int(item.get("price") or item.get("rentPrice") or item.get("pricePerYear"))
        title = _str(item.get("title") or item.get("name") or item.get("nameL1"), "")
        if not title or price <= 0: return None
        loc = item.get("location") or item.get("locationPath") or []
        if isinstance(loc, list):
            ld = " › ".join(x.get("name","") for x in loc if isinstance(x,dict)).strip(" ›")
        else:
            ld = _str(loc, self.location)
        rooms = _str(item.get("rooms") or item.get("beds") or item.get("bedrooms"))
        baths = _str(item.get("baths") or item.get("bathrooms"))
        slug = item.get("slug") or item.get("externalID") or ""
        if slug and not str(slug).isdigit():
            url = f"{self.base_url}/property/{slug}/"
        elif slug and str(slug).isdigit() and self.platform_name == "Bayut":
            url = f"{self.base_url}/property/{slug}/"
        else:
            url = _platform_search_url(
                self.platform_name, self.location, self.property_type,
                self.listing_type, self.min_price, self.max_price, self.rooms
            )
        ph_obj = item.get("phoneNumber") or item.get("agent") or {}
        contact = _str(ph_obj.get("mobile") or ph_obj.get("phone"), "") if isinstance(ph_obj,dict) else _str(ph_obj,"")
        lat, lng = _get_coords(self.location)
        if isinstance(item.get("geography"), dict):
            lat = item["geography"].get("lat", lat)
            lng = item["geography"].get("lng", lng)
        import random
        imgs = PROPERTY_IMAGES.get(self.property_type, PROPERTY_IMAGES["apartment"])
        image_url = (item.get("coverPhoto",{}) or {}).get("url","") or \
                    (item.get("photos",[{}])[0] or {}).get("url","") or \
                    item.get("image","") or item.get("thumbnail","") or random.choice(imgs)
        return {
            "title": title, "price_sar": price, "rent_period": "",
            "location_detail": ld or self.location,
            "bedrooms": rooms, "bathrooms": baths,
            "area_sqm": _int(item.get("area") or item.get("size") or item.get("areaInSqft",0)),
            "contact_number": contact,
            "source_url": url, "source_platform_name": self.platform_name,
            "image_url": image_url,
            "lat": lat, "lng": lng,
            "is_mock": False,
        }

# ─────────────────────────────────────────────────────────────────────────────
# 1. Bayut
# ─────────────────────────────────────────────────────────────────────────────

class BayutScraper(BaseScraper):
    platform_name = "Bayut"
    base_url      = "https://www.bayut.sa"

    _CAT_SLUGS = {
        "apartment": "apartments",
        "villa":     "villas",
        "house":     "townhouses",
        "office":    "offices",
        "shop":      "commercial",   # Bayut has no 'shops' — shops live under 'commercial'
        "land":      "residential-lands",
        "commercial":"showrooms",
        "residential":"residential-buildings",
        "building":  "residential-buildings",
    }
    _CITY_SLUGS = {
        "riyadh":      "/riyadh",
        "jeddah":      "/jeddah",
        "mecca":       "/mecca",
        "medina":      "/medina",
        "dammam":      "/dammam",
        "al khobar":   "/al-khobar",
        "khobar":      "/al-khobar",
        "abha":        "/abha",
        "tabuk":       "/tabuk",
        "buraidah":    "/buraidah",
        "khamis mushait": "/khamis-mushait",
        "hail":        "/hail",
        "al taif":     "/taif",
        "taif":        "/taif",
        "yanbu":       "/yanbu",
        "najran":      "/najran",
        "jazan":       "/jazan",
        "dhahran":     "/dhahran",
        "al jubail":   "/jubail",
        "jubail":      "/jubail",
    }

    def _parse_hit(self, h: dict) -> Optional[dict]:
        price = _int(h.get("price") or 0)
        title = _str(h.get("title_l1") or h.get("title"), "")
        if not title: return None

        loc_list = h.get("location") or []
        ld = " › ".join(x.get("name_l1","") for x in loc_list if isinstance(x, dict) and x.get("name_l1")).strip(" ›") or self.location

        ext_id = h.get("externalID","")
        source_url = f"{self.base_url}/property/details-{ext_id}.html" if ext_id else self.base_url

        cover = h.get("coverPhoto") or {}
        cover_id = cover.get("id") if isinstance(cover, dict) else None
        image_url = f"https://images.bayut.sa/thumbnails/{cover_id}-400x300.jpeg" if cover_id else ""

        ph = h.get("phoneNumber") or {}
        contact = ""
        if isinstance(ph, dict):
            raw_phone = ph.get("mobile") or ph.get("phone") or (ph.get("phoneNumbers") or [None])[0]
            contact = _clean_phone(raw_phone)

        agent_obj  = h.get("agent") or h.get("agency") or {}
        agency_obj = h.get("agency") or {}
        broker_name  = _str((agent_obj.get("name") if isinstance(agent_obj, dict) else ""), "")
        broker_agency = _str((agency_obj.get("name") if isinstance(agency_obj, dict) else
                              agent_obj.get("name") if isinstance(agent_obj, dict) else ""), "")
        broker_photo = _str((agent_obj.get("photo") or agent_obj.get("profilePhoto") or
                             agent_obj.get("logoUrl") if isinstance(agent_obj, dict) else ""), "")
        agent_id     = _str(agent_obj.get("externalID") or agent_obj.get("id") or
                            agent_obj.get("slug") if isinstance(agent_obj, dict) else "", "")
        broker_url   = f"{self.base_url}/en/agents/{agent_id}/" if agent_id else ""

        geo = h.get("geography") or h.get("_geoloc") or {}
        lat = geo.get("lat") or _get_coords(self.location)[0]
        lng = geo.get("lng") or _get_coords(self.location)[1]

        rooms_val = h.get("rooms")
        if rooms_val == 0:
            bedrooms = "Studio"
        elif rooms_val and int(rooms_val) > 0:
            bedrooms = str(int(rooms_val))
        else:
            bedrooms = "N/A"

        freq_raw = _str(h.get("rentFrequency") or h.get("rent_frequency"), "")
        freq_map = {"yearly": "/year", "monthly": "/month", "weekly": "/week", "daily": "/day"}
        rent_period = freq_map.get(freq_raw.lower(), "")

        return {
            "title": title,
            "price_sar": price,
            "rent_period": rent_period,
            "location_detail": ld,
            "bedrooms":  bedrooms,
            "bathrooms": _str(h.get("baths", "N/A")),
            "area_sqm":  _int(h.get("area", 0)),
            "contact_number": contact,
            "source_url": source_url,
            "source_platform_name": self.platform_name,
            "image_url": image_url,
            "lat": lat, "lng": lng,
            "broker_name":    broker_name,
            "broker_agency":  broker_agency,
            "broker_photo":   broker_photo,
            "broker_url":     broker_url,
        }

    async def scrape(self, client: AsyncSession) -> list[dict]:
        try:
            purpose  = "for-sale" if self.listing_type == "sale" else "for-rent"
            cat_slug = self._CAT_SLUGS.get(self.property_type, "apartments")

            city_str  = _city_from_location(self.location).strip().lower()
            city_slug = self._CITY_SLUGS.get(city_str,
                            f"/{city_str.replace(' ', '-')}")

            # ── Precision location filter (district > area > city) ──────────
            if self.district_slug:
                slugs = [s.strip() for s in self.district_slug.split(",") if s.strip()]
                facet_filter = [f"location.slug_l1:{s}" for s in slugs]
                query_q      = ""
            elif self.area_slug:
                facet_filter = [f"location.slug_l1:{self.area_slug}"]
                query_q      = ""
            else:
                facet_filter = [f"location.slug_l1:{city_slug}"]
                query_q = self.location.split(",")[0].strip() if "," in self.location else ""

            filters = f"purpose:{purpose} AND category.slug_l1:{cat_slug}"
            if self.min_price: filters += f" AND price>={self.min_price}"
            if self.max_price: filters += f" AND price<={self.max_price}"
            if self.rooms:     filters += f" AND rooms={self.rooms}"
            if self.min_area:  filters += f" AND area>={self.min_area}"
            if self.max_area:  filters += f" AND area<={self.max_area}"

            HITS_PER_PAGE = 100           # Algolia max per request
            MAX_PAGES     = 200           # Scaled up to fetch all properties (up to 20,000)

            _hdrs = {
                "X-Algolia-Application-Id": BAYUT_ALGOLIA_APP_ID,
                "X-Algolia-API-Key":        BAYUT_ALGOLIA_API_KEY,
                "Content-Type":             "application/json",
                "Origin":                   "https://www.bayut.sa",
                "Referer":                  "https://www.bayut.sa/",
            }

            def _payload(page: int) -> dict:
                return {
                    "query":        query_q,
                    "filters":      filters,
                    "facetFilters": [facet_filter],
                    "hitsPerPage":  HITS_PER_PAGE,
                    "page":         page,
                    "attributesToRetrieve": [
                        "title_l1","price","purpose","rooms","baths","area",
                        "externalID","slug_l1","coverPhoto","phoneNumber",
                        "geography","_geoloc","location","rentFrequency",
                        "agent","agency",
                    ],
                }

            # ── Step 1: probe page 0 with retry ────────────────────────────
            probe_data = None
            for attempt in range(3):
                try:
                    probe = await client.post(BAYUT_ALGOLIA_URL, json=_payload(0),
                                              headers=_hdrs, timeout=30)
                    if probe.status_code == 200:
                        probe_data = probe.json()
                        break
                    print(f"[Bayut Algolia] attempt {attempt+1} status={probe.status_code}")
                except Exception as ex:
                    print(f"[Bayut Algolia] attempt {attempt+1} error: {ex}")
                    await asyncio.sleep(2)

            if not probe_data:
                print("[Bayut] all probe attempts failed")
                return []

            total_hits   = probe_data.get("nbHits", 0)
            nb_pages     = probe_data.get("nbPages", 1)
            pages_needed = min(nb_pages, MAX_PAGES)

            print(f"[Bayut] {total_hits} total hits → fetching {pages_needed} pages in parallel")
            all_hits = list(probe_data.get("hits", []))

            # ── Step 2: fetch remaining pages in PARALLEL ──────────────────
            if pages_needed > 1:
                tasks = [
                    client.post(BAYUT_ALGOLIA_URL, json=_payload(p),
                                headers=_hdrs, timeout=30)
                    for p in range(1, pages_needed)
                ]
                responses = await asyncio.gather(*tasks, return_exceptions=True)
                for resp in responses:
                    if isinstance(resp, Exception):
                        continue
                    if resp.status_code == 200:
                        all_hits.extend(resp.json().get("hits", []))

            # ── Step 3: parse + filter ─────────────────────────────────────
            parsed  = [self._parse_hit(h) for h in all_hits]
            results = [x for x in parsed if x]
            results = self._type_filter(results)

            level = "district" if self.district_slug else "area" if self.area_slug else "city"
            print(f"[Bayut] {len(results)}/{total_hits} listings returned (filter={level})")
            return results
        except Exception as e:
            print(f"[Bayut] error: {e}")
            return []


# ─────────────────────────────────────────────────────────────────────────────
# 2. Aqar
# ─────────────────────────────────────────────────────────────────────────────

class AqarScraper(BaseScraper):
    platform_name = "Aqar"
    base_url = "https://sa.aqar.fm"

    _SUBREGIONS: dict[str, list[str]] = {
        "jeddah": ["شمال-جدة", "جنوب-جدة", "شرق-جدة", "غرب-جدة", "وسط-جدة"],
        "riyadh": ["شمال-الرياض", "جنوب-الرياض", "شرق-الرياض", "غرب-الرياض", "وسط-الرياض"],
        "dammam": ["شمال-الدمام", "جنوب-الدمام", "شرق-الدمام", "غرب-الدمام", "وسط-الدمام"],
    }

    _SLUGS: dict[tuple[str,str], str] = {
        ("apartment",  "rent"): "شقق-للإيجار",
        ("apartment",  "sale"): "شقق-للبيع",
        ("villa",      "rent"): "فلل-للإيجار",
        ("villa",      "sale"): "فلل-للبيع",
        ("house",      "rent"): "بيت-للإيجار",
        ("house",      "sale"): "بيت-للبيع",
        ("residential","rent"): "عمائر-للإيجار",
        ("residential","sale"): "عمائر-للبيع",
        ("building",   "rent"): "عمائر-للإيجار",
        ("building",   "sale"): "عمائر-للبيع",
        ("land",       "sale"): "أراضي-للبيع",
        ("land",       "rent"): "أراضي-للإيجار",
        ("office",     "rent"): "مكتب-تجاري-للإيجار",
        ("office",     "sale"): "مكاتب-للبيع",
        ("shop",       "rent"): "محلات-للإيجار",
        ("shop",       "sale"): "محلات-للبيع",
        ("commercial", "rent"): "محلات-للإيجار",
        ("commercial", "sale"): "محلات-للبيع",
    }
    _CITIES: dict[str, str] = {
        "riyadh":    "الرياض",
        "jeddah":    "جدة",
        "mecca":     "مكة-المكرمة",
        "medina":    "المدينة-المنورة",
        "dammam":    "الدمام",
        "khobar":    "الخبر",
        "al khobar": "الخبر",
        "abha":      "أبها",
        "tabuk":     "تبوك",
        "hail":      "حائل",
        "buraidah":  "بريدة",
        "taif":      "الطائف",
        "al taif":   "الطائف",
        "yanbu":     "ينبع",
        "najran":    "نجران",
        "jazan":     "جازان",
    }
    _RENT_PERIOD: dict[str, str] = {
        "سنوي":  "/year",
        "شهري":  "/month",
        "أسبوعي": "/week",
        "يومي":  "/day",
    }

    def _extract_listings(self, text: str) -> list[dict]:
        import json, re
        clean_text = text.replace('\\"', '"')
        matches = list(re.finditer(r'\{"id":\d+,"sov_campaign_id"', clean_text))
        listings, seen = [], set()
        for m in matches:
            start = m.start()
            depth, end = 0, start
            for i, ch in enumerate(clean_text[start:], start):
                if ch == "{":   depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            try:
                obj = json.loads(clean_text[start:end])
                lid = obj.get("id")
                if lid and lid not in seen:
                    seen.add(lid)
                    listings.append(obj)
            except Exception:
                pass
        return listings

    def _process_item(self, item: dict, city_bbox: Optional[tuple], district_ar: str, seen_ids: set) -> Optional[dict]:
        import random
        item_id = item.get("id")
        if not item_id or item_id in seen_ids: return None
        seen_ids.add(item_id)

        path = _str(item.get("path"), "")
        if not path: return None

        # Property type filter based on URL path
        selected_types = [t.strip() for t in self.property_type.split(",") if t.strip()]
        path_lower = path.lower()

        def _type_ok():
            for t in selected_types:
                if t == "apartment" and ("شقق" in path_lower or "شقه" in path_lower or "شقة" in path_lower):
                    return True
                if t == "villa" and ("فلل" in path_lower or "فيلا" in path_lower or "فلا" in path_lower):
                    return True
                if t == "house" and ("بيت" in path_lower or "منازل" in path_lower or "منزل" in path_lower or "شعبية" in path_lower):
                    return True
                if t in ("residential", "building") and ("عمائر" in path_lower or "عمارة" in path_lower):
                    return True
                if t == "land" and ("أراضي" in path_lower or "ارض" in path_lower or "أرض" in path_lower):
                    return True
                if t == "office" and ("مكاتب" in path_lower or "مكتب" in path_lower):
                    return True
                if t in ("shop", "commercial") and ("محلات" in path_lower or "محل" in path_lower or "تجاري" in path_lower):
                    return True
            return False

        if not _type_ok():
            return None

        price = _int(item.get("price") or 0)
        title = _str(item.get("title"), "")
        if not title: return None

        rpt = _str(item.get("rent_period_text"), "")
        rent_period = self._RENT_PERIOD.get(rpt, "")
        ld = _str(item.get("address_text") or item.get("district") or item.get("city"), "") or self.location.title()

        geo = item.get("location") or {}
        lat = float(geo.get("lat") or 0)
        lng = float(geo.get("lng") or 0)

        # Strict bounding-box: drop anything outside requested city
        if city_bbox and lat and lng:
            lat_min, lat_max, lng_min, lng_max = city_bbox
            if not (lat_min <= lat <= lat_max and lng_min <= lng <= lng_max):
                return None

        if not lat: lat = _get_coords(self.location)[0]
        if not lng: lng = _get_coords(self.location)[1]

        # District filter
        if district_ar:
            def _norm(t): return t.replace("أ","ا").replace("إ","ا").replace("آ","ا").replace("ة","ه").replace("ي","ى")
            norm_search = _norm(district_ar)
            norm_loc = _norm(ld)
            search_words = [w for w in norm_search.split() if len(w) >= 3 and w not in ["حي", "مدينة", "منطقة"]]
            if search_words:
                matches = sum(1 for w in search_words if w in norm_loc)
                if not (matches > 0 and (matches == len(search_words) or len(search_words) == 1)):
                    return None

        # Determine property type for image fallback
        matched_type = "apartment"
        for t in selected_types:
            if t == "villa" and ("فلل" in path or "فيلا" in path): matched_type = "villa"; break
            if t == "house" and ("بيت" in path or "منزل" in path): matched_type = "house"; break
            if t in ("residential","building") and ("عمائر" in path or "عمارة" in path): matched_type = "building"; break
            if t == "land" and ("أراضي" in path or "أرض" in path): matched_type = "land"; break
            if t == "office" and "مكتب" in path: matched_type = "office"; break
            if t in ("shop","commercial") and ("محلات" in path or "تجاري" in path): matched_type = "commercial"; break

        main_img = item.get("mainImage") or (item.get("imgs") or [None])[0]
        imgs = PROPERTY_IMAGES.get(matched_type, PROPERTY_IMAGES["apartment"])
        image_url = f"https://images.aqar.fm/webp/750x0/props/{main_img}" if main_img else random.choice(imgs)

        source_url = f"{self.base_url}{path}" if path else f"{self.base_url}/عقارات"

        if self.min_price and price < self.min_price: return None
        if self.max_price and price > self.max_price: return None
        if self.rooms:
            beds = _int(item.get("beds") or 0)
            if beds and beds != self.rooms: return None

        # Parse search result user objects as broker fallbacks
        user_obj = item.get("user") or {}
        user_id = item.get("user_id") or ""
        b_name = _str(user_obj.get("name") or user_obj.get("company_name"), "")
        b_agency = _str(user_obj.get("company_name") or user_obj.get("name"), "")
        b_photo = ""
        raw_logo = user_obj.get("company_logo") or user_obj.get("img") or ""
        if raw_logo:
            b_photo = f"https://images.aqar.fm/{raw_logo}" if not str(raw_logo).startswith("http") else raw_logo
        b_url = f"https://sa.aqar.fm/user/{user_id}" if user_id else ""

        return {
            "title":                title,
            "price_sar":            price,
            "rent_period":          rent_period,
            "location_detail":      ld,
            "bedrooms":             _str(item.get("beds"), "N/A") if item.get("beds") else "N/A",
            "bathrooms":            _str(item.get("wc"),   "N/A") if item.get("wc")   else "N/A",
            "area_sqm":             _int(item.get("area") or 0),
            "contact_number":       "",
            "source_url":           source_url,
            "source_platform_name": self.platform_name,
            "image_url":            image_url,
            "lat": lat, "lng": lng,
            "broker_name":          b_name,
            "broker_agency":        b_agency,
            "broker_photo":         b_photo,
            "broker_url":           b_url,
            "rega_license_number":  "",
            "rega_license_url":     "",
            "deed_number":          "",
        }

    async def _enrich_listing(self, client: AsyncSession, r: dict, sem: asyncio.Semaphore):
        path_str = r.get("source_url", "").replace(self.base_url, "")
        if not path_str or not path_str.startswith("/"):
            return r
        detail_url = f"{self.base_url}{path_str}"
        try:
            import random
            await asyncio.sleep(random.uniform(0.1, 0.3))
            async with sem:
                resp = await client.get(detail_url, headers={
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
                    "Referer": self.base_url + "/",
                }, timeout=12)
                
                if resp.status_code == 200:
                    html_text = resp.text
                    # Extract phone: e.g. \"responsible_employee_phone_number\":\"0555560010\"
                    phone_match = re.search(r'responsible_employee_phone_number\\?":\\?"(\d+)\\?"', html_text)
                    phone = phone_match.group(1) if phone_match else ""
                    if phone and len(phone) >= 8:
                        r["contact_number"] = _clean_phone(phone)
                    
                    # Extract employee/broker name
                    name_match = re.search(r'responsible_employee_name\\?":\\?"([^"\\]+)\\?"', html_text)
                    b_emp_name = name_match.group(1) if name_match else ""
                    if b_emp_name:
                        r["broker_name"] = b_emp_name
                    
                    # Extract REGA license details
                    lic_match = re.search(r'ad_license_number\\?":\\?"([^"\\]+)\\?"', html_text)
                    if lic_match:
                        r["rega_license_number"] = lic_match.group(1)
                    
                    lic_url_match = re.search(r'ad_license_url\\?":\\?"([^"\\]+)\\?"', html_text)
                    if lic_url_match:
                        # Replace escaped slashes
                        r["rega_license_url"] = lic_url_match.group(1).replace("\\/", "/")
                    
                    deed_match = re.search(r'deed_number\\?":\\?"([^"\\]+)\\?"', html_text)
                    if deed_match:
                        r["deed_number"] = deed_match.group(1)
        except Exception as ex:
             print(f"[Aqar Detail Enrich] Error on {detail_url}: {ex}")
        return r

    async def scrape(self, client: AsyncSession) -> AsyncIterator[dict]:
        import random
        try:
            city_str   = _city_from_location(self.location).strip().lower()
            loc_lower  = self.location.strip().lower()
            city_ar    = self._CITIES.get(city_str, self._CITIES.get(loc_lower, "الرياض"))
            purpose_en = "sale" if self.listing_type == "sale" else "rent"

            # Extract district
            parts       = [p.strip() for p in self.location.split(",")]
            district_en = parts[0] if len(parts) >= 2 else ""
            district_ar = ""
            if district_en and district_en.lower() != city_str:
                try:
                    district_ar = GoogleTranslator(source="en", target="ar").translate(district_en)
                except Exception:
                    pass

            selected_types = [t.strip() for t in self.property_type.split(",") if t.strip()] or ["apartment"]

            # ── City bounding boxes ──────────────────────────────────────────
            CITY_BBOX: dict[str, tuple] = {
                "jeddah":    (21.0, 21.9, 38.8, 39.5),
                "riyadh":    (24.3, 25.2, 46.3, 47.2),
                "mecca":     (21.2, 21.6, 39.6, 40.2),
                "medina":    (24.2, 24.7, 39.4, 39.9),
                "dammam":    (26.1, 26.7, 49.8, 50.4),
                "khobar":    (26.1, 26.5, 50.0, 50.4),
                "al khobar": (26.1, 26.5, 50.0, 50.4),
                "tabuk":     (28.2, 28.6, 36.3, 36.8),
                "abha":      (18.0, 18.5, 42.3, 42.8),
            }
            city_bbox = CITY_BBOX.get(city_str)

            # ── RSC request headers ──────────────────────────────────────────
            hdrs = {
                "RSC": "1",
                "Accept": "text/x-component, */*",
                "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
                "Referer": self.base_url + "/",
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            }

            # ── Per-page fetch with retry ────────────────────────────────────
            async def _fetch_one(url: str) -> list[dict]:
                for attempt in range(3):
                    try:
                        r = await client.get(url, headers=hdrs, timeout=20)
                        if r.status_code == 200:
                            return self._extract_listings(r.text)
                        if r.status_code == 429:
                            await asyncio.sleep(3.0 + attempt * 3.0 + random.uniform(0, 2))
                        else:
                            break
                    except Exception:
                        await asyncio.sleep(1.0)
                return []

            # ── Total-page detector ──────────────────────────────────────────
            def _total_pages(text: str, max_pages: int) -> int:
                m = re.search(r'"total"\s*:\s*(\d+)', text)
                if m:
                    total = int(m.group(1))
                    return min(max_pages, max(1, (total + 19) // 20))
                return min(max_pages, 100)

            # ── Concurrent crawler for one base URL ──────────────────────────
            CONCURRENCY = 15  # safe limit; Vercel gives fresh IPs per invocation
            sem = asyncio.Semaphore(CONCURRENCY)

            async def _crawl_url(base_url: str, max_pages: int):
                # Page 1 — also tells us total
                try:
                    r1 = await client.get(base_url, headers=hdrs, timeout=20)
                except Exception as ex:
                    print(f"[Aqar] page-1 error {base_url}: {ex}")
                    return

                if r1.status_code != 200:
                    print(f"[Aqar] page-1 status={r1.status_code} for {base_url}")
                    return

                page1_items = self._extract_listings(r1.text)
                for item in page1_items:
                    parsed = self._process_item(item, city_bbox, district_ar, seen_ids)
                    if parsed:
                        yield parsed

                total_pages = _total_pages(r1.text, max_pages)
                if total_pages <= 1:
                    return

                # Pages 2..total_pages — all in parallel, capped by semaphore
                async def _bounded(p: int):
                    async with sem:
                        return await _fetch_one(f"{base_url}/{p}")

                tasks = [_bounded(p) for p in range(2, total_pages + 1)]
                for coro in asyncio.as_completed(tasks):
                    listings = await coro
                    for item in listings:
                        parsed = self._process_item(item, city_bbox, district_ar, seen_ids)
                        if parsed:
                            yield parsed

            # ── Build URL list ───────────────────────────────────────────────
            seen_ids: set = set()
            urls_to_scrape: list[tuple[str, int]] = []

            for pt in selected_types:
                cat_slug = self._SLUGS.get((pt, purpose_en))
                if not cat_slug:
                    continue
                if district_ar:
                    slug_dist = district_ar.replace(" ", "-").replace("أ","ا").replace("إ","ا").replace("آ","ا")
                    if not slug_dist.startswith("حي-"):
                        slug_dist = f"حي-{slug_dist}"
                    urls_to_scrape.append(
                        (f"{self.base_url}/{quote(cat_slug)}/{quote(city_ar)}/{quote(slug_dist)}", 200)
                    )
                else:
                    urls_to_scrape.append(
                        (f"{self.base_url}/{quote(cat_slug)}/{quote(city_ar)}", 2000)
                    )
                    for subreg in self._SUBREGIONS.get(city_str, []):
                        urls_to_scrape.append(
                            (f"{self.base_url}/{quote(cat_slug)}/{quote(city_ar)}/{quote(subreg)}", 500)
                        )

            # ── Main loop: stream results as they arrive ─────────────────────
            for target_url, max_pages in urls_to_scrape:
                async for listing in _crawl_url(target_url, max_pages):
                    yield listing

        except Exception as e:
            print(f"[Aqar] scrape error: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# 3. PropertyFinder SA
# ─────────────────────────────────────────────────────────────────────────────

class PropertyFinderScraper(BaseScraper):
    platform_name = "PropertyFinder"
    base_url = "https://www.propertyfinder.sa"

    _TYPES = {
        "apartment":  "apartments",
        "villa":      "villas",
        "house":      "houses",
        "land":       "land",
        "office":     "offices",
        "commercial": "commercial-properties",
    }
    _CITIES = {
        "riyadh":    "riyadh",
        "jeddah":    "jeddah",
        "mecca":     "makkah-al-mukarramah",
        "makkah":    "makkah-al-mukarramah",
        "medina":    "madinah",
        "dammam":    "dammam",
        "khobar":    "al-khobar",
        "al khobar": "al-khobar",
        "dhahran":   "dhahran",
        "jubail":    "jubail",
        "al jubail": "jubail",
        "abha":      "abha",
        "taif":      "taif",
        "al taif":   "taif",
        "tabuk":     "tabuk",
        "hail":      "hail",
        "buraidah":  "buraidah",
        "yanbu":     "yanbu",
    }

    async def scrape(self, client: AsyncSession) -> list[dict]:
        try:
            city_str   = _city_from_location(self.location).strip().lower()
            loc_lower  = self.location.strip().lower()
            city_slug  = self._CITIES.get(city_str, self._CITIES.get(loc_lower, "ar-riyadh"))
            type_slug  = self._TYPES.get(self.property_type, "apartments")
            purpose    = "for-sale" if self.listing_type == "sale" else "for-rent"
            # Correct PropertyFinder SA URL pattern
            base_url   = f"{self.base_url}/en/{purpose}/{city_slug}/{type_slug}/"

            results = []
            for page in range(1, 51):  # up to 50 pages
                page_url = base_url if page == 1 else f"{base_url}?page={page}"
                try:
                    r = await client.get(page_url, headers={
                        "Accept": "text/html,application/xhtml+xml,*/*",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Referer": "https://www.google.com/",
                    }, timeout=20)
                except Exception as ex:
                    print(f"[PropertyFinder] fetch error page {page}: {ex}")
                    break

                if r.status_code == 404:
                    try:
                        alt = f"{self.base_url}/en/{purpose}/{city_slug}/{type_slug}"
                        r = await client.get(alt if page == 1 else f"{alt}?page={page}",
                                             headers={"Accept": "text/html,*/*"}, timeout=20)
                    except Exception:
                        break

                if r.status_code != 200:
                    print(f"[PropertyFinder] HTTP {r.status_code} for {page_url}")
                    break

                m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.S)
                if not m:
                    print("[PropertyFinder] no __NEXT_DATA__")
                    break

                data  = json.loads(m.group(1))
                sr    = data.get("props", {}).get("pageProps", {}).get("searchResult", {})
                props = sr.get("properties", []) if isinstance(sr, dict) else []
                if not props:
                    break

                for p in props:
                    title = _str(p.get("title"), "")
                    if not title:
                        continue

                    price_obj   = p.get("price") or {}
                    price       = _int(price_obj.get("value") or 0)
                    period_raw  = _str(price_obj.get("period"), "").lower()
                    rent_period = "/year" if "year" in period_raw else "/month" if "month" in period_raw else ""
                    if self.listing_type == "sale":
                        rent_period = ""

                    loc_obj = p.get("location") or {}
                    ld      = _str(loc_obj.get("full_name"), self.location.title())
                    coords  = loc_obj.get("coordinates") or {}
                    lat     = float(coords.get("lat") or 0) or _get_coords(self.location)[0]
                    lng     = float(coords.get("lon") or coords.get("lng") or 0) or _get_coords(self.location)[1]

                    imgs      = p.get("images") or []
                    image_url = (imgs[0].get("medium") or imgs[0].get("small") or "") if imgs else ""

                    beds  = _str(p.get("bedrooms"),  "N/A")
                    baths = _str(p.get("bathrooms"), "N/A")
                    sz    = p.get("size") or {}
                    area  = _int(sz.get("value") or 0)

                    agent_obj  = p.get("agent")  or {}
                    broker_obj = p.get("broker") or {}
                    raw_phone  = ""
                    for co in (p.get("contact_options") or []):
                        if co.get("type") == "phone":
                            raw_phone = _str(co.get("value"), "")
                            break
                    if not raw_phone:
                        raw_phone = _str(broker_obj.get("phone"), "")
                    phone = _clean_phone(raw_phone)

                    broker_name   = _str(agent_obj.get("name") or broker_obj.get("name"), "")
                    broker_agency = _str(broker_obj.get("name") or
                                        (broker_obj.get("agency") or {}).get("name"), "")
                    broker_photo  = _str(agent_obj.get("image"), "")
                    broker_url    = ""

                    source_url = _str(p.get("share_url"), base_url)
                    if not source_url.startswith("http"):
                        source_url = f"{self.base_url}{source_url}"

                    if self.min_price and price and price < self.min_price: continue
                    if self.max_price and price and price > self.max_price: continue
                    if self.rooms:
                        b = _int(p.get("bedrooms") or 0)
                        if b and b != self.rooms: continue

                    results.append({
                        "title":                title,
                        "price_sar":            price,
                        "rent_period":          rent_period,
                        "location_detail":      ld,
                        "bedrooms":             beds,
                        "bathrooms":            baths,
                        "area_sqm":             area,
                        "contact_number":       phone,
                        "source_url":           source_url,
                        "source_platform_name": self.platform_name,
                        "image_url":            image_url,
                        "lat": lat, "lng": lng,
                        "broker_name":    broker_name,
                        "broker_agency":  broker_agency,
                        "broker_photo":   broker_photo,
                        "broker_url":     broker_url,
                    })

            print(f"[PropertyFinder] {len(results)} listings from {base_url}")
            return results

        except Exception as e:
            print(f"[PropertyFinder] error: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# 4. Wasalt
# ─────────────────────────────────────────────────────────────────────────────

class WasaltScraper(BaseScraper):
    platform_name = "Wasalt"
    base_url = "https://wasalt.sa"
    _IMG_CDN = "https://imagedelivery.net/1DNKFJPRaeUdy_j8F7HT3w/production/properties"

    _TYPES = {
        "apartment": "apartments", "villa": "villas",
        "house":     "houses",     "land":  "land",
        "office":    "offices",    "commercial": "commercial",
        "residential": "buildings", "building": "buildings",
    }
    _CITIES = {
        "riyadh":    "riyadh",    "jeddah":   "jeddah",
        "mecca":     "makkah",    "medina":   "madinah",
        "dammam":    "dammam",    "khobar":   "al-khobar",
        "al khobar": "al-khobar", "abha":     "abha",
        "tabuk":     "tabuk",     "hail":     "hail",
        "buraidah":  "buraidah",  "taif":     "al-taif",
        "al taif":   "al-taif",   "yanbu":    "yanbu",
        "najran":    "najran",    "jazan":    "jazan",
    }

    async def scrape(self, client: AsyncSession) -> list[dict]:
        try:
            city_str  = _city_from_location(self.location).strip().lower()
            loc_lower = self.location.strip().lower()
            city_slug = self._CITIES.get(city_str, self._CITIES.get(loc_lower, "riyadh"))
            type_slug = self._TYPES.get(self.property_type, "apartments")
            purpose   = "sale" if self.listing_type == "sale" else "rent"
            base_url  = f"{self.base_url}/en/{type_slug}-for-{purpose}-in-{city_slug}"

            hdrs = {
                "Accept":          "text/html,application/xhtml+xml,*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer":         self.base_url + "/en/",
            }

            results  = []
            seen_ids: set = set()
            MAX_PAGES = 340  # 10,871 listings / 32 per page ≈ 340 pages

            # Fetch page 1 first to get totalPages
            try:
                async with AsyncSession(impersonate="safari15_3") as safari:
                    r1 = await safari.get(base_url, headers=hdrs, timeout=20)
            except Exception as ex:
                print(f"[Wasalt] page 1 error: {ex}")
                return []

            if r1.status_code != 200:
                print(f"[Wasalt] HTTP {r1.status_code}")
                return []

            m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r1.text, re.S)
            if not m:
                print("[Wasalt] no __NEXT_DATA__ on page 1")
                return []

            data0  = json.loads(m.group(1))
            sr0    = data0.get("props", {}).get("pageProps", {}).get("searchResult", {})
            props0 = sr0.get("properties", []) if isinstance(sr0, dict) else []
            total_pages = int(sr0.get("totalPages") or 1)
            total_pages = min(total_pages, MAX_PAGES)

            for p in self._parse_props(props0, seen_ids, purpose, city_slug):
                results.append(p)

            print(f"[Wasalt] {sr0.get('count', '?')} total listings, {total_pages} pages")

            # Fetch remaining pages in parallel (batches of 20 to avoid overload)
            BATCH = 20
            for batch_start in range(2, total_pages + 1, BATCH):
                batch_pages = range(batch_start, min(batch_start + BATCH, total_pages + 1))
                tasks = []
                for pg in batch_pages:
                    page_url = f"{base_url}?page={pg}"
                    tasks.append(client.get(page_url, headers=hdrs, timeout=20))

                responses = await asyncio.gather(*tasks, return_exceptions=True)
                for resp in responses:
                    if isinstance(resp, Exception):
                        continue
                    if resp.status_code != 200:
                        continue
                    m2 = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', resp.text, re.S)
                    if not m2:
                        continue
                    data2  = json.loads(m2.group(1))
                    sr2    = data2.get("props", {}).get("pageProps", {}).get("searchResult", {})
                    props2 = sr2.get("properties", []) if isinstance(sr2, dict) else []
                    for p in self._parse_props(props2, seen_ids, purpose, city_slug):
                        results.append(p)

            print(f"[Wasalt] {len(results)} listings fetched total")
            return results

        except Exception as e:
            print(f"[Wasalt] error: {e}")
            import traceback; traceback.print_exc()
        return []


    def _parse_props(self, raw: list, seen_ids: set, purpose: str, city_slug: str) -> list[dict]:
        results = []
        for p in raw:
            pi    = p.get("propertyInfo") or p
            loc   = p.get("location")     or {}
            _own  = p.get("propertyOwner") or p.get("owner") or {}
            owner = _own if isinstance(_own, dict) else (_own[0] if isinstance(_own, list) and _own else {})
            files = p.get("propertyFiles") or {}
            attrs = {a["key"]: a["value"]
                     for a in (p.get("attributes") or [])
                     if isinstance(a, dict) and "key" in a}

            prop_id = str(p.get("id") or p.get("propertyId") or "")
            if not prop_id or prop_id in seen_ids:
                continue
            seen_ids.add(prop_id)

            title = _str(pi.get("title") or p.get("title"), "")
            if not title:
                continue

            if purpose == "rent":
                price = _int(pi.get("expectedRent") or pi.get("conversionPrice") or
                             p.get("price") or p.get("rentPrice") or 0)
            else:
                price = _int(pi.get("salePrice") or pi.get("conversionPrice") or
                             p.get("price") or p.get("salePrice") or 0)

            freq_raw    = _str(pi.get("expectedRentType") or p.get("rentType"), "").lower()
            rent_period = "/year" if "year" in freq_raw else "/month" if "month" in freq_raw else ""
            if purpose == "sale":
                rent_period = ""

            ld  = _str(pi.get("address") or pi.get("district") or pi.get("zone") or
                       p.get("district") or p.get("address"), self.location.title())
            lat = float(loc.get("lat") or p.get("lat") or 0) or _get_coords(self.location)[0]
            lng = float(loc.get("lon") or loc.get("lng") or p.get("lng") or 0) or _get_coords(self.location)[1]

            imgs      = files.get("images") if isinstance(files, dict) else (p.get("images") or [])
            image_url = (f"{self._IMG_CDN}/{prop_id}/images/{imgs[0]}/public" if imgs
                         else _str(p.get("thumbnail") or p.get("coverImage"), ""))

            phone = _clean_phone(
                owner.get("phone") or owner.get("whatsApp") or
                (p.get("contactDetails") or {}).get("phoneNumber") or
                p.get("phone") or ""
            )
            broker_name   = _str(owner.get("enName") or owner.get("name") or
                                 owner.get("fullName") or p.get("brokerName"), "")
            broker_agency = _str(owner.get("companyName") or
                                 (owner.get("company") or {}).get("name") or
                                  owner.get("agencyName") or p.get("agencyName"), "")
            raw_avatar    = owner.get("userAvatar") or owner.get("companyLogo") or ""
            broker_photo  = (f"https://images.wasalt.sa/{raw_avatar}"
                             if raw_avatar and not raw_avatar.startswith("http") and "null" not in raw_avatar
                             else _str(raw_avatar if raw_avatar and "null" not in str(raw_avatar) else "", ""))
            owner_slug    = _str(owner.get("slug"), "")
            broker_url    = f"https://wasalt.sa/en/agents/{owner_slug}" if owner_slug else ""

            slug       = _str(pi.get("slug") or p.get("slug"), "")
            source_url = (f"{self.base_url}/en/property/{slug}" if slug
                          else f"{self.base_url}/en/property/{prop_id}" if prop_id
                          else f"{self.base_url}/en/{self._TYPES.get(self.property_type,'apartments')}-for-{purpose}-in-{city_slug}")

            if self.min_price and price and price < self.min_price: continue
            if self.max_price and price and price > self.max_price: continue
            if self.rooms:
                beds = _int(attrs.get("noOfBedrooms") or p.get("bedrooms") or 0)
                if beds and beds != self.rooms: continue

            results.append({
                "title":                title,
                "price_sar":            price,
                "rent_period":          rent_period,
                "location_detail":      ld,
                "bedrooms":             _str(attrs.get("noOfBedrooms") or p.get("bedrooms"), "N/A"),
                "bathrooms":            _str(attrs.get("noOfBathrooms") or p.get("bathrooms"), "N/A"),
                "area_sqm":             _int(attrs.get("builtUpArea") or p.get("area") or 0),
                "contact_number":       phone,
                "source_url":           source_url,
                "source_platform_name": self.platform_name,
                "image_url":            image_url,
                "lat": lat, "lng": lng,
                "broker_name":    broker_name,
                "broker_agency":  broker_agency,
                "broker_photo":   broker_photo,
                "broker_url":     broker_url,
            })
        return results

    async def _scrape_html(self, client: AsyncSession,
                           city_slug: str, type_slug: str, purpose: str) -> list[dict]:
        """HTML fallback — fetches page 1 only from the website."""
        url = f"{self.base_url}/en/{type_slug}-for-{purpose}-in-{city_slug}"
        try:
            async with AsyncSession(impersonate="safari15_3") as safari:
                r = await safari.get(url, headers={
                    "Accept":          "text/html,application/xhtml+xml,*/*",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Referer":         self.base_url + "/en/",
                }, timeout=20)
            if r.status_code != 200:
                print(f"[Wasalt HTML] HTTP {r.status_code}")
                return []
            m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.S)
            if not m:
                return []
            data  = json.loads(m.group(1))
            sr    = data.get("props", {}).get("pageProps", {}).get("searchResult", {})
            props = sr.get("properties", []) if isinstance(sr, dict) else []
            return self._parse_props(props, set(), purpose, city_slug)
        except Exception as ex:
            print(f"[Wasalt HTML fallback] {ex}")
            return []



# ─────────────────────────────────────────────────────────────────────────────
# 5. Sakani
# ─────────────────────────────────────────────────────────────────────────────

class SakaniScraper(BaseScraper):
    platform_name = "Sakani"
    base_url = "https://sakani.sa"
    mock_count = 5

    async def scrape(self, client):
        try:
            url = f"{self.base_url}/en/projects?city={quote(self.location)}"
            r = await client.get(url, headers=_h(self.base_url), timeout=15)
            if r.status_code==200:
                found = self._extract_next_data(r.text)
                if found: return [self._with_coords(x) for x in found]
        except Exception as e:
            print(f"[Sakani]: {e}")
        return []

# ─────────────────────────────────────────────────────────────────────────────
# 6. Haraj
# ─────────────────────────────────────────────────────────────────────────────

class HarajScraper(BaseScraper):
    platform_name = "Haraj"
    base_url = "https://haraj.com.sa"
    mock_count = 8

    async def scrape(self, client):
        try:
            city_str = _city_from_location(self.location).strip().lower()
            city_ar = {"riyadh":"الرياض","jeddah":"جدة","dammam":"الدمام",
                       "mecca":"مكة","medina":"المدينة","khobar":"الخبر",
                       "abha":"أبها","tabuk":"تبوك","hail":"حائل",
                       "buraidah":"بريدة","medina":"المدينة المنورة"}.get(
                           city_str, city_str)
            prop_ar = {"apartment":"شقة","villa":"فيلا","house":"منزل",
                       "land":"أرض","office":"مكتب"}.get(self.property_type,"عقار")
            q = f"{prop_ar} {city_ar}"
            url = f"{self.base_url}/search?q={quote(q)}&cat=real-estate"
            r = await client.get(url, headers=_h(self.base_url), timeout=15)
            if r.status_code==200:
                soup = BeautifulSoup(r.text,"lxml")
                cards = soup.find_all("div", class_=re.compile(r"post|listing|card",re.I))[:20]
                results = []
                for card in cards:
                    title_el = card.find(re.compile(r"^h[1-6]$")) or card.find(class_=re.compile(r"title",re.I))
                    price_el = card.find(class_=re.compile(r"price",re.I))
                    if not (title_el and price_el): continue
                    price = _int(re.sub(r"[^\d]","",price_el.get_text()))
                    if price<=0: continue
                    link = card.find("a",href=True)
                    href = link["href"] if link else ""
                    url2 = f"{self.base_url}{href}" if href.startswith("/") else href
                    lat,lng = _get_coords(self.location)
                    results.append({
                        "title": title_el.get_text(" ",strip=True),
                        "price_sar": price, "rent_period": "",
                        "location_detail": self.location.title(),
                        "bedrooms":"N/A","bathrooms":"N/A","area_sqm":0,
                        "contact_number":"",
                        "source_url": url2 or self.base_url,
                        "source_platform_name": self.platform_name,
                        "lat":lat,"lng":lng,
                    })
                if results: return self._type_filter(results)
        except Exception as e:
            print(f"[Haraj]: {e}")
        return []

# ─────────────────────────────────────────────────────────────────────────────
# 7. OpenSooq
# ─────────────────────────────────────────────────────────────────────────────

class OpenSooqScraper(BaseScraper):
    platform_name = "OpenSooq"
    base_url = "https://sa.opensooq.com"
    mock_count = 6

    async def scrape(self, client):
        try:
            prop_slug = {"apartment":"apartments-for-sale","villa":"villas",
                         "house":"houses","land":"land","office":"offices"}.get(
                             self.property_type,"real-estate")
            city_slug = _city_from_location(self.location).strip().lower().replace(' ','-')
            url = f"{self.base_url}/en/{prop_slug}/{city_slug}"
            r = await client.get(url, headers=_h(self.base_url), timeout=15)
            if r.status_code==200:
                soup = BeautifulSoup(r.text,"lxml")
                for sc in soup.find_all("script"):
                    txt = sc.string or ""
                    if '"price"' in txt and '"title"' in txt:
                        try:
                            m = re.search(r'\[(\{.*?"price".*?\})\]',txt,re.S)
                            if m:
                                arr = json.loads("["+m.group(1)+"]")
                                found = [self._norm(x) for x in arr if self._norm(x)]
                                if found: return [self._with_coords(x) for x in found]
                        except: pass
        except Exception as e:
            print(f"[OpenSooq]: {e}")
        return []

# ─────────────────────────────────────────────────────────────────────────────
# 8. Expatriates
# ─────────────────────────────────────────────────────────────────────────────

class ExpatriatesScraper(BaseScraper):
    platform_name = "Expatriates"
    base_url = "https://www.expatriates.com"
    mock_count = 6

    _CITIES = {
        "riyadh": "riyadh", "jeddah": "jeddah", "dammam": "dammam",
        "mecca": "mecca", "medina": "medina", "khobar": "al-khobar",
        "al khobar": "al-khobar", "abha": "abha", "tabuk": "tabuk",
    }

    async def scrape(self, client):
        try:
            city_str = _city_from_location(self.location).strip().lower()
            city_slug = self._CITIES.get(city_str, city_str.replace(" ", "-"))
            url = f"{self.base_url}/classifieds/saudi-arabia/{city_slug}/real-estate/"
            r = await client.get(url, headers=_h(self.base_url), timeout=15)
            if r.status_code==200:
                soup = BeautifulSoup(r.text,"lxml")
                cards = soup.find_all("div",class_=re.compile(r"classifiedsDiv|listing",re.I))[:20]
                results = []
                for card in cards:
                    a = card.find("a",href=True)
                    title_el = card.find(class_=re.compile(r"title|heading",re.I)) or a
                    price_el = card.find(class_=re.compile(r"price|amount",re.I))
                    if not title_el: continue
                    price = _int(re.sub(r"[^\d]","",price_el.get_text())) if price_el else 0
                    lat,lng = _get_coords(self.location)
                    results.append({
                        "title": title_el.get_text(" ",strip=True)[:120],
                        "price_sar": price, "rent_period": "",
                        "location_detail": self.location.title(),
                        "bedrooms":"N/A","bathrooms":"N/A","area_sqm":0,
                        "contact_number":"",
                        "source_url": f"{self.base_url}{a['href']}" if a and a.get("href","").startswith("/") else self.base_url,
                        "source_platform_name": self.platform_name,
                        "lat":lat,"lng":lng,
                    })
                if results: return self._type_filter(results)
        except Exception as e:
            print(f"[Expatriates]: {e}")
        return []

# ─────────────────────────────────────────────────────────────────────────────
# 9. Mourjan
# ─────────────────────────────────────────────────────────────────────────────

class MourjanScraper(BaseScraper):
    platform_name = "Mourjan"
    base_url = "https://sa.mourjan.com"
    mock_count = 6

    async def scrape(self, client):
        try:
            ltype = "for-sale" if self.listing_type=="sale" else "for-rent"
            city_slug = _city_from_location(self.location).strip().lower().replace(' ', '-')
            url = f"{self.base_url}/classifieds/real-estate/{ltype}/{city_slug}"
            r = await client.get(url, headers=_h(self.base_url), timeout=15)
            if r.status_code==200:
                found = self._extract_next_data(r.text)
                if found: return [self._with_coords(x) for x in found]
        except Exception as e:
            print(f"[Mourjan]: {e}")
        return []

# ─────────────────────────────────────────────────────────────────────────────
# 10. Satel
# ─────────────────────────────────────────────────────────────────────────────

class SatelScraper(BaseScraper):
    platform_name = "Satel"
    base_url = "https://satel.sa"
    mock_count = 4

    async def scrape(self, client):
        try:
            r = await client.get(self.base_url, headers=_h(self.base_url), timeout=15)
            if r.status_code==200:
                found = self._extract_next_data(r.text)
                if found: return [self._with_coords(x) for x in found]
        except Exception as e:
            print(f"[Satel]: {e}")
        return []

# ─────────────────────────────────────────────────────────────────────────────
# 11. Zaahib
# ─────────────────────────────────────────────────────────────────────────────

class ZaahibScraper(BaseScraper):
    platform_name = "Zaahib"
    base_url = "https://www.zaahib.com"
    mock_count = 5

    async def scrape(self, client):
        try:
            url = f"{self.base_url}/properties?city={quote(self.location)}&type={self.listing_type}"
            r = await client.get(url, headers=_jh(self.base_url), timeout=15)
            if r.status_code==200:
                try:
                    data = r.json()
                    items = data.get("data",data.get("properties",[]))
                    if isinstance(items,list) and items:
                        return [self._with_coords(self._norm(x)) for x in items if self._norm(x)]
                except: pass
                found = self._extract_next_data(r.text)
                if found: return [self._with_coords(x) for x in found]
        except Exception as e:
            print(f"[Zaahib]: {e}")
        return []

# ─────────────────────────────────────────────────────────────────────────────
# 12. Bezaat
# ─────────────────────────────────────────────────────────────────────────────

class BezaatScraper(BaseScraper):
    platform_name = "Bezaat"
    base_url = "https://bezaat.com"
    mock_count = 5

    async def scrape(self, client):
        try:
            url = f"{self.base_url}/sa/real-estate/{self.listing_type}/{self.property_type}"
            r = await client.get(url, headers=_h(self.base_url), timeout=15)
            if r.status_code==200:
                found = self._extract_next_data(r.text)
                if found: return [self._with_coords(x) for x in found]
        except Exception as e:
            print(f"[Bezaat]: {e}")
        return []

# ─────────────────────────────────────────────────────────────────────────────
# 13. SaudiDeal
# ─────────────────────────────────────────────────────────────────────────────

class DealScraper(BaseScraper):
    platform_name = "SaudiDeal"
    base_url = "https://saudi-deal.com"
    mock_count = 5

    async def scrape(self, client):
        try:
            url = f"{self.base_url}/real-estate?city={quote(self.location)}&purpose={self.listing_type}"
            r = await client.get(url, headers=_h(self.base_url), timeout=15)
            if r.status_code==200:
                found = self._extract_next_data(r.text)
                if found: return [self._with_coords(x) for x in found]
        except Exception as e:
            print(f"[SaudiDeal]: {e}")
        return []

# ─────────────────────────────────────────────────────────────────────────────
# Platform registry
# ─────────────────────────────────────────────────────────────────────────────

ALL_SCRAPERS = {
    "bayut":          BayutScraper,
    "aqar":           AqarScraper,
    "propertyfinder": PropertyFinderScraper,
    "wasalt":         WasaltScraper,
    "sakani":         SakaniScraper,
    "haraj":          HarajScraper,
    "opensooq":       OpenSooqScraper,
    "expatriates":    ExpatriatesScraper,
    "mourjan":        MourjanScraper,
    "satel":          SatelScraper,
    "zaahib":         ZaahibScraper,
    "bezaat":         BezaatScraper,
    "saudideal":      DealScraper,
}

def _build_scrapers(platforms, kwargs) -> list[BaseScraper]:
    prop_type = kwargs.get("property_type", "apartment")
    property_types = [t.strip() for t in prop_type.split(",") if t.strip()]
    
    scrapers = []
    platform_list = platforms or list(ALL_SCRAPERS.keys())
    keys = [p.lower().replace(" ","").replace("-","") for p in platform_list]
    
    # 1. Build AqarScraper only once with the full comma-separated property_type
    if "aqar" in keys:
        kw = dict(kwargs, property_type=prop_type)
        scrapers.append(AqarScraper(**kw))
        
    # 2. Build other scrapers per category
    other_keys = [k for k in keys if k != "aqar"]
    for pt in property_types:
        kw = dict(kwargs, property_type=pt)
        for k in other_keys:
            if k in ALL_SCRAPERS:
                scrapers.append(ALL_SCRAPERS[k](**kw))
                
    return scrapers

class PropertyAggregator:
    def __init__(self, **kwargs):
        self.scrapers = _build_scrapers(kwargs.pop("platforms", None), kwargs)

    async def _run_scraper(self, scraper: BaseScraper, client: AsyncSession) -> list[dict]:
        res = scraper.scrape(client)
        if hasattr(res, "__anext__") or hasattr(res, "__aiter__"):
            out = []
            async for item in res:
                out.append(item)
            return out
        else:
            return await res

    async def aggregate(self) -> list[dict]:
        async with AsyncSession(impersonate="chrome124") as client:
            tasks = [self._run_scraper(s, client) for s in self.scrapers]
            results = await asyncio.gather(*tasks, return_exceptions=True)
        out = []
        for r in results:
            if isinstance(r, list):
                out.extend(r)
            elif isinstance(r, Exception):
                print(f"[Aggregator Exception] Error running scraper: {r}")
        return out

# ─────────────────────────────────────────────────────────────────────────────
# API routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/platforms")
def get_platforms():
    platform_meta = {
        "bayut":          {"label":"Bayut",         "url":"bayut.sa",         "tier":"premium"},
        "aqar":           {"label":"Aqar",           "url":"aqar.fm",          "tier":"premium"},
        "propertyfinder": {"label":"PropertyFinder", "url":"propertyfinder.sa","tier":"premium"},
        "wasalt":         {"label":"Wasalt",         "url":"wasalt.com",       "tier":"premium"},
        "sakani":         {"label":"Sakani",         "url":"sakani.sa",        "tier":"government"},
        "haraj":          {"label":"Haraj",          "url":"haraj.com.sa",     "tier":"classifieds"},
        "opensooq":       {"label":"OpenSooq",       "url":"sa.opensooq.com",  "tier":"classifieds"},
        "expatriates":    {"label":"Expatriates",    "url":"expatriates.com",  "tier":"classifieds"},
        "mourjan":        {"label":"Mourjan",        "url":"sa.mourjan.com",   "tier":"classifieds"},
        "satel":          {"label":"Satel",          "url":"satel.sa",         "tier":"niche"},
        "zaahib":         {"label":"Zaahib",         "url":"zaahib.com",       "tier":"niche"},
        "bezaat":         {"label":"Bezaat",         "url":"bezaat.com",       "tier":"niche"},
        "saudideal":      {"label":"SaudiDeal",      "url":"saudi-deal.com",   "tier":"niche"},
    }
    return platform_meta


@router.get("/api/locations")
async def get_locations(
    city:      Optional[str] = Query(None),
    area_slug: Optional[str] = Query(None),
):
    """
    Real-time location hierarchy from Bayut Algolia.
    - No params           → list of city names
    - ?city=riyadh        → list of areas in that city
    - ?area_slug=/riyadh/north-riyadh → list of districts in that area
    """
    _hdrs = {
        "X-Algolia-Application-Id": BAYUT_ALGOLIA_APP_ID,
        "X-Algolia-API-Key":        BAYUT_ALGOLIA_API_KEY,
        "Content-Type":             "application/json",
        "Origin":                   "https://www.bayut.sa",
        "Referer":                  "https://www.bayut.sa/",
    }

    # ── No params: return cities ───────────────────────────────────────────
    if not city and not area_slug:
        from shared import CITY_COORDS
        city_names = sorted(set([
            k.title() for k in CITY_COORDS.keys()
            if k not in ("khobar", "ahsa", "taif", "jubail")
        ]))
        return {"cities": city_names}

    async with AsyncSession(impersonate="chrome124") as client:

        # ── area_slug given: return districts ──────────────────────────────
        if area_slug:
            try:
                payload = {
                    "query":        "",
                    "facetFilters": [[f"location.slug_l1:{area_slug}"]],
                    "attributesToRetrieve": ["location"],
                    "hitsPerPage":  200,
                    "page":         0,
                }
                r = await client.post(BAYUT_ALGOLIA_URL, json=payload, headers=_hdrs, timeout=12)
                districts: dict[str, str] = {}
                if r.status_code == 200:
                    for hit in r.json().get("hits", []):
                        for loc in hit.get("location", []):
                            if loc.get("level") == 3:
                                sl   = loc.get("slug_l1", "")
                                name = loc.get("name_l1", "")
                                if sl and name and sl not in districts:
                                    districts[sl] = name
                print(f"[/api/locations] {len(districts)} districts for area '{area_slug}'")
                return {
                    "districts": [
                        {"slug": s, "name": n}
                        for s, n in sorted(districts.items(), key=lambda x: x[1])
                    ]
                }
            except Exception as e:
                print(f"[/api/locations districts] {e}")
                return {"districts": []}

        # ── city given: return areas ───────────────────────────────────────
        city_lower = city.strip().lower()
        city_slug  = BayutScraper._CITY_SLUGS.get(
            city_lower,
            f"/{city_lower.replace(' ', '-')}"
        )
        try:
            all_hits = []
            for pg in range(3):
                payload = {
                    "query":        "",
                    "facetFilters": [[f"location.slug_l1:{city_slug}"]],
                    "attributesToRetrieve": ["location"],
                    "hitsPerPage":  200,
                    "page":         pg,
                }
                r = await client.post(BAYUT_ALGOLIA_URL, json=payload, headers=_hdrs, timeout=12)
                if r.status_code != 200 or not r.json().get("hits"):
                    break
                all_hits.extend(r.json()["hits"])

            areas: dict[str, str] = {}
            for hit in all_hits:
                for loc in hit.get("location", []):
                    if loc.get("level") == 2:
                        sl   = loc.get("slug_l1", "")
                        name = loc.get("name_l1", "")
                        if sl and name and sl not in areas:
                            areas[sl] = name

            print(f"[/api/locations] {len(areas)} areas for '{city_lower}'")
            return {
                "areas": [
                    {"slug": s, "name": n}
                    for s, n in sorted(areas.items(), key=lambda x: x[1])
                ]
            }
        except Exception as e:
            print(f"[/api/locations areas] {e}")
            return {"areas": []}




@router.get("/api/stream")
async def stream(
    location:      str            = Query(...),
    min_price:     Optional[int]  = Query(None),
    max_price:     Optional[int]  = Query(None),
    rooms:         Optional[int]  = Query(None),
    property_type: str            = Query("apartment"),
    listing_type:  str            = Query("sale"),
    platforms:     Optional[str]  = Query(None),
    area_slug:     Optional[str]  = Query(None),
    district_slug: Optional[str]  = Query(None),
    min_area:      Optional[int]  = Query(None),
    max_area:      Optional[int]  = Query(None),
):
    property_types = [t.strip() for t in property_type.split(",") if t.strip()] or ["apartment"]

    PRICE_BUFFER = 0.05
    buf_min = int(min_price * (1 - PRICE_BUFFER)) if min_price else None
    buf_max = int(max_price * (1 + PRICE_BUFFER)) if max_price else None

    platform_list = [p.strip() for p in platforms.split(",")] if platforms else None

    kw = dict(
        location=location, min_price=buf_min, max_price=buf_max,
        rooms=rooms, property_type=property_type, listing_type=listing_type,
        area_slug=area_slug or "", district_slug=district_slug or "",
        min_area=min_area, max_area=max_area,
    )
    scrapers = _build_scrapers(platform_list, kw)

    DISTRICT_RADIUS_KM = 10.0
    is_district = "," in location
    centroid: list[float] = []

    def _in_district(item: dict) -> bool:
        if not centroid:
            return True
        lat, lng = item.get("lat"), item.get("lng")
        if not lat or not lng:
            return False
        return _haversine_km(centroid[0], centroid[1], lat, lng) <= DISTRICT_RADIUS_KM

    async def gen() -> AsyncIterator[str]:
        import asyncio
        seen_urls: set[str] = set()

        # ── Announce all platforms at once ────────────────────────────────
        for sc in scrapers:
            yield _sse({"status": "scanning", "platform": sc.platform_name,
                        "message": f"Scanning {sc.platform_name}…"})

        # ── Shared queue — every scraper pushes into it ────────────────────
        queue: asyncio.Queue = asyncio.Queue()

        async def _run_one(sc: BaseScraper):
            # ── Each scraper gets its OWN session so they don't interfere ──
            async with AsyncSession(impersonate="chrome124") as http_client:
                try:
                    res = sc.scrape(http_client)
                    count = 0
                    if hasattr(res, "__anext__") or hasattr(res, "__aiter__"):
                        async for item in res:
                            await queue.put(("result", sc.platform_name, item, None))
                            count += 1
                    else:
                        items = await res
                        for item in items:
                            await queue.put(("result", sc.platform_name, item, None))
                            count += 1
                    await queue.put(("done", sc.platform_name, None, count))
                except Exception as ex:
                    print(f"[stream/{sc.platform_name}] error: {ex}")
                    await queue.put(("error", sc.platform_name, None, str(ex)))

        # Launch ALL scrapers concurrently — each with its own session
        tasks = [asyncio.create_task(_run_one(sc)) for sc in scrapers]
        remaining = len(tasks)

        while remaining > 0:
            kind, plat, item, extra = await queue.get()

            if kind == "result":
                url_key = item.get("source_url", "")
                if url_key and url_key in seen_urls:
                    continue
                if url_key:
                    seen_urls.add(url_key)
                if is_district:
                    if not centroid and item.get("lat") and item.get("lng"):
                        centroid.append(item["lat"])
                        centroid.append(item["lng"])
                    if centroid and not _in_district(item):
                        continue
                yield _sse({"status": "result", "listing": item})

            elif kind == "done":
                yield _sse({"status": "platform_done", "platform": plat, "count": extra})
                remaining -= 1

            elif kind == "error":
                yield _sse({"status": "error", "platform": plat, "message": str(extra)})
                remaining -= 1

        for t in tasks:
            t.cancel()

        yield _sse({"status": "complete"})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/api/properties")
async def batch(
    location:      str            = Query(...),
    min_price:     Optional[int]  = Query(None),
    max_price:     Optional[int]  = Query(None),
    rooms:         Optional[int]  = Query(None),
    property_type: str            = Query("apartment"),
    listing_type:  str            = Query("sale"),
    platforms:     Optional[str]  = Query(None),
    min_area:      Optional[int]  = Query(None),
    max_area:      Optional[int]  = Query(None),
):
    agg = PropertyAggregator(location=location, min_price=min_price, max_price=max_price,
                              rooms=rooms, property_type=property_type, listing_type=listing_type,
                              platforms=[p.strip() for p in platforms.split(",")] if platforms else None,
                              min_area=min_area, max_area=max_area)
    listings = await agg.aggregate()
    return {"status":"success","count":len(listings),"listings":listings}


@router.get("/api/cities")
def cities():
    from shared import CITY_COORDS
    return sorted(CITY_COORDS.keys())


@router.get("/health")
def health():
    return {"status":"ok","platforms":len(ALL_SCRAPERS)}
