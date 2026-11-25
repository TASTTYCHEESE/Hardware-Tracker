"""Builds the PC Hardware catalog (catalog/*.json) that the app downloads.

Runs weekly on GitHub Actions (.github/workflows/catalog.yml) so new hardware
shows up in the app on its own. Sources:
  * dbgpu (MIT)              every GPU chip since 1986, from TechPowerUp's GPU database
  * docyx/pc-part-dataset    ~67,000 parts and peripherals listed on PCPartPicker (MIT)
  * Wikidata (CC0)           processors with release dates and specs
  * catalog-extra/*.json     hand-added items (filled in by the daily recap job)

Usage: python tools/catalog/build.py [out_dir]
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.error
import urllib.request

OUT = sys.argv[1] if len(sys.argv) > 1 else "catalog"
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXTRA = os.path.join(ROOT, "catalog-extra")
UA = "HardwareTrackerCatalog/1.0 (open-source hardware catalog builder)"
PCPP = "https://raw.githubusercontent.com/docyx/pc-part-dataset/main/data/json/{}.json"

SRC_TPU = {"name": "TechPowerUp GPU Database (via dbgpu)", "url": "https://www.techpowerup.com/gpu-specs/"}
SRC_PCPP = {"name": "PCPartPicker (via pc-part-dataset)", "url": "https://github.com/docyx/pc-part-dataset"}
SRC_WD = {"name": "Wikidata", "url": "https://www.wikidata.org/"}
SRC_EXTRA = {"name": "Hardware Tracker news recaps", "url": "https://github.com/TASTTYCHEESE/Hardware-Tracker"}


def log(*a):
    print(*a, flush=True)


def get(url, data=None, headers=None, tries=6):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            # Wikidata rate limits: wait as long as it asks (or longer each time).
            wait = int(e.headers.get("Retry-After") or 0) if e.code == 429 else 0
            wait = max(wait, 15 * (i + 1)) if e.code == 429 else 5 * (i + 1)
            log(f"  retry {i + 1} in {wait}s {url[:90]}: {e}")
            time.sleep(min(wait, 120))
        except Exception as e:  # noqa: BLE001
            log(f"  retry {i + 1} {url[:90]}: {e}")
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"failed: {url}")


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:90]


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def num(v):
    if v is None or v == "":
        return None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


MULTI_BRANDS = [
    "Western Digital", "Cooler Master", "be quiet!", "Lian Li", "Fractal Design", "Silicon Power", "Super Flower",
    "In Win", "Creative Labs", "Turtle Beach", "Mad Catz", "Thermal Grizzly", "Noctua", "Sound BlasterX",
    "Phanteks", "Audio-Technica", "Beyerdynamic", "Monster Digital", "Seasonic", "Team Group", "Fifine",
    "Das Keyboard", "Harman Kardon", "Bang & Olufsen", "Sound Blaster", "Ducky", "Glorious", "Mountain", "HP HyperX", "Logitech G", "Razer", "Red Dragon",
]


def brand(name: str) -> str:
    for b in MULTI_BRANDS:
        if name.lower().startswith(b.lower() + " ") or name.lower() == b.lower():
            if b == "HP HyperX":
                return "HyperX"
            if b == "Logitech G":
                return "Logitech"
            return b
    first = name.split()[0] if name.split() else "Unknown"
    return {"be": "be quiet!", "TEAMGROUP": "TEAMGROUP", "SeaSonic": "Seasonic"}.get(first, first)


# ---------------------------------------------------------------------------
# Category definitions. "group" decides Hardware vs Peripherals in the app.
# fields: (key, label, unit) in display order. Fields not listed still show.
# ---------------------------------------------------------------------------
CATEGORIES: list[dict] = []


def category(cid, name, group, desc, fields, filters, items, sources, note=""):
    CATEGORIES.append({
        "id": cid, "name": name, "group": group, "description": desc,
        "fields": [{"k": k, "label": l, **({"unit": u} if u else {})} for k, l, u in fields],
        "filters": filters, "items": items, "sources": sources, "note": note,
    })


# ---- GPUs (chips) ----------------------------------------------------------
GPU_DATA: dict = {}


def build_gpus():
    if os.environ.get("DBGPU_JSON"):  # local testing: a JSON export of the dbgpu data
        specs = json.load(open(os.environ["DBGPU_JSON"], encoding="utf-8"))
    else:
        from dbgpu import GPUDatabase  # type: ignore

        specs = [dataclasses.asdict(s) for s in GPUDatabase.default().specs]
    items = []
    for g in specs:
        rd = g.get("release_date")
        date = rd.isoformat() if hasattr(rd, "isoformat") else (str(rd) if rd else None)

        def ver(a):
            ma, mi = g.get(f"{a}_major_version"), g.get(f"{a}_minor_version")
            return None if ma is None else f"{ma}.{mi or 0}"

        mem = g.get("memory_size_gb")
        mem_s = None
        if mem:
            mem_s = f"{round(mem * 1024)} MB" if mem < 1 else f"{num(round(mem, 1))} GB"
        it = {
            "id": slug(f"{g['manufacturer']}-{g['name']}-{g.get('tpu_id') or ''}"),
            "name": g["name"], "maker": g["manufacturer"], "date": date, "year": int(date[:4]) if date else None,
            "generation": g.get("generation"), "architecture": g.get("architecture"), "gpu_chip": g.get("gpu_name"),
            "foundry": g.get("foundry"), "process_nm": g.get("process_size_nm"),
            "transistors_m": num(g.get("transistor_count_m")), "die_mm2": num(g.get("die_size_mm2")),
            "bus": g.get("bus_interface"),
            "base_clock": num(g.get("base_clock_mhz")), "boost_clock": num(g.get("boost_clock_mhz")),
            "memory": mem_s, "memory_type": g.get("memory_type"), "memory_bus": g.get("memory_bus_bits"),
            "memory_clock": num(g.get("memory_clock_mhz")), "bandwidth": num(g.get("memory_bandwidth_gb_s")),
            "cores": g.get("shading_units") or None, "tmus": g.get("texture_mapping_units") or None,
            "rops": g.get("render_output_processors") or None, "sms": g.get("streaming_multiprocessors") or None,
            "tensor_cores": g.get("tensor_cores") or None, "rt_cores": g.get("ray_tracing_cores") or None,
            "l1_kb": num(g.get("l1_cache_kb")) or None, "l2_mb": num(g.get("l2_cache_mb")) or None,
            "fp32": num(g.get("single_float_performance_gflop_s")), "fp16": num(g.get("half_float_performance_gflop_s")),
            "fp64": num(g.get("double_float_performance_gflop_s")),
            "pixel_rate": num(g.get("pixel_rate_gpixel_s")) or None, "texture_rate": num(g.get("texture_rate_gtexel_s")) or None,
            "tdp": g.get("thermal_design_power_w"), "psu": g.get("suggested_psu_w"),
            "power_connectors": g.get("power_connectors"), "outputs": g.get("display_connectors") or None,
            "slots": g.get("board_slot_width"), "length_mm": num(g.get("board_length_mm")),
            "directx": ver("directx"), "opengl": ver("opengl"), "vulkan": ver("vulkan"), "opencl": ver("opencl"),
            "cuda": ver("cuda"), "shader_model": ver("shader_model"),
            "link": g.get("tpu_url"),
        }
        # TechPowerUp leaves AMD compute units and Intel Xe cores empty; they follow from the core count.
        arch, sh = (g.get("architecture") or ""), g.get("shading_units") or 0
        if not it["sms"] and sh:
            if re.match(r"(GCN|RDNA|CDNA)", arch) and sh % 64 == 0:
                it["sms"] = sh // 64
            elif re.match(r"Xe2?-HPG", arch) and sh % 128 == 0:
                it["sms"] = sh // 128
        items.append({k: v for k, v in it.items() if v not in (None, "", 0)})
    log(f"GPUs: {len(items)}")
    for i in items:
        i["kind"] = "GPU chip"
    # How many Steam users have each chip (latest month and all-time peak).
    usage, month = steam_usage("Video Card Description")
    by_norm = {norm(i["name"]): i for i in items}
    keys = sorted(by_norm, key=len)
    matched = 0
    for name, u in usage.items():
        s = re.sub(r"^(NVIDIA|AMD|ATI|Intel)\s+", "", name, flags=re.I)
        s = s.replace("Laptop GPU", "Mobile").replace("(TM)", "").replace("(R)", "")
        k = norm(s)
        # The survey doesn't split memory variants (RTX 3060 8 GB / 12 GB), so every variant gets the family's share.
        targets = [by_norm[k]] if k in by_norm else [by_norm[kk] for kk in keys if kk.startswith(k) and re.fullmatch(r"\d+(gb|mb)?", kk[len(k):])]
        if not targets:
            continue
        matched += 1
        for g in targets:
            if u["share"] is not None:
                g["steam_share"] = max(g.get("steam_share", 0), u["share"])
            if u["peak"] > g.get("steam_peak", 0):
                g["steam_peak"], g["steam_peak_month"] = u["peak"], u["peak_month"]
    GPU_DATA["steam_month"] = month
    log(f"Steam survey matched {matched} GPU chips")
    GPU_DATA["fields"] = [("generation", "Generation", None), ("architecture", "Architecture", None), ("gpu_chip", "GPU chip", None),
         ("date", "Release date", None), ("foundry", "Foundry", None), ("process_nm", "Process", "nm"),
         ("transistors_m", "Transistors", "million"), ("die_mm2", "Die size", "mm²"), ("bus", "Bus interface", None),
         ("base_clock", "Base clock", "MHz"), ("boost_clock", "Boost clock", "MHz"), ("memory", "Memory", None),
         ("memory_type", "Memory type", None), ("memory_bus", "Memory bus", "bit"), ("memory_clock", "Memory clock", "MHz"),
         ("bandwidth", "Bandwidth", "GB/s"), ("cores", "Cores (CUDA / stream processors)", None), ("tmus", "Texture units (TMUs)", None), ("rops", "Render output units (ROPs)", None),
         ("sms", "Streaming multiprocessors / compute units", None), ("tensor_cores", "Tensor cores", None), ("rt_cores", "Ray tracing cores", None),
         ("l1_kb", "L1 cache", "KB"), ("l2_mb", "L2 cache", "MB"), ("fp32", "FP32 performance", "GFLOPS"),
         ("fp16", "FP16 performance", "GFLOPS"), ("fp64", "FP64 performance", "GFLOPS"), ("pixel_rate", "Pixel rate", "GPixel/s"),
         ("texture_rate", "Texture rate", "GTexel/s"), ("tdp", "TDP", "W"), ("psu", "Suggested PSU", "W"),
         ("power_connectors", "Power connectors", None), ("outputs", "Outputs", None), ("slots", "Slot width", None),
         ("length_mm", "Board length", "mm"), ("directx", "DirectX version", None), ("opengl", "OpenGL version", None), ("vulkan", "Vulkan version", None),
         ("opencl", "OpenCL version", None), ("cuda", "CUDA compute capability (version)", None), ("shader_model", "Shader model version", None)]
    GPU_DATA["items"] = items
    return {norm(i["name"]): i for i in items}


# ---- Wikidata processors ----------------------------------------------------
WD_SPARQL = "https://query.wikidata.org/sparql"
WD_API = "https://www.wikidata.org/w/api.php"


def sparql(q):
    raw = get(WD_SPARQL + "?" + urllib.parse.urlencode({"query": q, "format": "json"}),
              headers={"Accept": "application/sparql-results+json"})
    return json.loads(raw)["results"]["bindings"]


def wd_entities(ids, props="claims|labels"):
    out = {}
    ids = list(ids)
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        raw = get(WD_API + "?" + urllib.parse.urlencode({
            "action": "wbgetentities", "ids": "|".join(chunk), "props": props, "languages": "en", "format": "json"}))
        out.update(json.loads(raw).get("entities", {}))
        time.sleep(1.0)  # stay well under Wikidata's rate limits
        if (i // 50) % 40 == 0:
            log(f"  Wikidata entities {i + len(chunk)}/{len(ids)}")
    return out


def build_wikidata_cpus():
    """Processors on Wikidata: anything that has a number of cores, or is a microprocessor model."""
    qids = set()
    queries = {
        # Anything with a "number of processor cores" statement: ~11,000 CPUs and SoCs.
        "has core count": "SELECT DISTINCT ?i WHERE { ?i wdt:P1141 ?c . }",
    }
    for label, q in queries.items():
        try:
            rows = sparql(q)
            ids = {r["i"]["value"].rsplit("/", 1)[1] for r in rows}
            log(f"Wikidata {label}: {len(ids)}")
            qids |= ids
        except Exception as e:  # noqa: BLE001
            log(f"Wikidata {label} failed: {e}")
    qids = {q for q in qids if q.startswith("Q")}
    log(f"Wikidata candidate processors: {len(qids)}")
    if not qids:
        return []
    ents = wd_entities(sorted(qids))
    # Collect every property and item id we need labels for.
    pids, refs = set(), set()
    for e in ents.values():
        for pid, claims in e.get("claims", {}).items():
            pids.add(pid)
            for c in claims:
                dv = c.get("mainsnak", {}).get("datavalue", {})
                if dv.get("type") == "wikibase-entityid":
                    refs.add(dv["value"]["id"])
                elif dv.get("type") == "quantity":
                    u = dv["value"].get("unit", "")
                    if "/entity/" in u:
                        refs.add(u.rsplit("/", 1)[1])
    labels = {}
    for k, e in wd_entities(sorted(pids | refs), props="labels").items():
        labels[k] = e.get("labels", {}).get("en", {}).get("value", k)
    SKIP = {"P31", "P279", "P373", "P910", "P646", "P2671", "P18", "P154", "P856", "P1424", "P5008", "P6366",
            "P8408", "P10283", "P3417", "P2924", "P7502", "P1343", "P1889", "P460", "P361", "P527", "P155", "P156",
            "P1269", "P3984", "P1813", "P2888", "P4839", "P5824", "P10565", "P9100", "P1482", "P8814"}
    UNIT_SHORT = {"megahertz": "MHz", "gigahertz": "GHz", "kilohertz": "kHz", "hertz": "Hz", "watt": "W", "nanometre": "nm",
                  "kibibyte": "KiB", "mebibyte": "MiB", "gibibyte": "GiB", "kilobyte": "KB", "megabyte": "MB",
                  "byte": "B", "volt": "V", "square millimetre": "mm²", "micrometre": "µm", "gigabyte": "GB", "degree Celsius": "°C"}
    items = []
    for qid, e in ents.items():
        name = e.get("labels", {}).get("en", {}).get("value")
        claims = e.get("claims", {})
        if not name or not claims:
            continue
        specs: dict[str, str] = {}
        maker = date = None
        for pid, cs in claims.items():
            if pid in SKIP:
                continue
            vals = []
            for c in cs:
                dv = c.get("mainsnak", {}).get("datavalue")
                if not dv:
                    continue
                t, v = dv["type"], dv["value"]
                if t == "wikibase-entityid":
                    vals.append(labels.get(v["id"], v["id"]))
                elif t == "quantity":
                    amt = num(float(v["amount"]))
                    u = v.get("unit", "1")
                    ul = labels.get(u.rsplit("/", 1)[1], "") if "/entity/" in u else ""
                    vals.append(f"{amt} {UNIT_SHORT.get(ul, ul)}".strip())
                elif t == "time":
                    vals.append(v["time"].lstrip("+")[:10].replace("-00", ""))
                elif t == "string":
                    if pid.startswith("P") and len(v) < 120 and not v.startswith("http"):
                        vals.append(v)
                elif t == "monolingualtext":
                    vals.append(v.get("text", ""))
            vals = [x for x in dict.fromkeys(vals) if x]
            if not vals:
                continue
            if pid == "P176":  # manufacturer
                maker = vals[0]
            if pid in ("P571", "P577", "P580") and not date:
                date = vals[0]
            specs[labels.get(pid, pid)] = ", ".join(vals[:6])
        if len(specs) < 2:
            continue
        year = int(date[:4]) if date and date[:4].isdigit() else None
        items.append({"id": "wd-" + qid.lower(), "name": name, "maker": maker or "Unknown", "year": year,
                      "date": date if date and len(date) >= 7 else None, "wd": specs,
                      "link": f"https://www.wikidata.org/wiki/{qid}"})
    log(f"Wikidata processors with specs: {len(items)}")
    return items


# ---- PCPartPicker dataset ------------------------------------------------
# PCPartPicker lists parts most popular first, so the position in the dataset is a popularity rank.
RANK: dict[str, list[int]] = {}  # name -> ranks of rows with that name, in order (names repeat, e.g. "Sapphire PULSE")


def pcpp(t):
    try:
        rows = json.loads(get(PCPP.format(t)))
    except Exception as e:  # noqa: BLE001
        log(f"pcpp {t} failed: {e}")
        rows = []
    RANK.clear()
    for i, r in enumerate(rows):
        RANK.setdefault(r.get("name", ""), []).append(i + 1)
    return rows


# ---- Steam Hardware Survey (via jdegene/steamHWsurvey): how many gamers use each GPU / VR headset ----
STEAM_CSV = "https://raw.githubusercontent.com/jdegene/steamHWsurvey/master/shs.csv"
SRC_STEAM = {"name": "Steam Hardware Survey (via steamHWsurvey)", "url": "https://store.steampowered.com/hwsurvey"}


def steam_usage(category_name):
    """name -> {share (latest month, %), peak (%), peak_month} for one survey category."""
    import csv
    import io

    try:
        text = get(STEAM_CSV).decode("utf-8")
    except Exception as e:  # noqa: BLE001
        log(f"Steam survey failed: {e}")
        return {}, ""
    rows = [r for r in csv.DictReader(io.StringIO(text)) if r["category"] == category_name and r["name"] != "Other"]
    if not rows:
        return {}, ""
    last = max(r["date"] for r in rows)
    out: dict[str, dict] = {}
    for r in rows:
        try:
            pct = float(r["percentage"]) * 100
        except ValueError:
            continue
        o = out.setdefault(r["name"], {"share": None, "peak": 0.0, "peak_month": ""})
        if pct > o["peak"]:
            o["peak"], o["peak_month"] = round(pct, 2), r["date"][:7]
        if r["date"] == last:
            o["share"] = round(pct, 2)
    log(f"Steam survey {category_name}: {len(out)} names, latest {last}")
    return out, last[:7]


def rng(v, unit="", scale=1):
    if isinstance(v, list) and len(v) == 2:
        a, b = v
        return f"{num(a * scale)}–{num(b * scale)}{(' ' + unit) if unit else ''}"
    return None if v is None else f"{num(v)}{(' ' + unit) if unit else ''}"


def mk(name, extra):
    it = {"id": slug(name), "name": name, "maker": brand(name)}
    if RANK.get(name):
        it["pop_rank"] = RANK[name].pop(0)
    it.update({k: v for k, v in extra.items() if v not in (None, "", [], "None")})
    return it


ARCH_YEAR = {"K10": 2007, "Skylake": 2015, "Haswell": 2013, "Sandy Bridge": 2011, "Piledriver": 2012, "Ivy Bridge": 2012,
             "Kaby Lake": 2017, "Core": 2006, "Coffee Lake": 2017, "Coffee Lake Refresh": 2018, "Haswell Refresh": 2014,
             "Wolfdale": 2008, "Comet Lake": 2020, "Broadwell": 2015, "Yorkfield": 2008, "Steamroller": 2014, "Zen 4": 2022,
             "Lynx": 2011, "Zen 2": 2019, "Zen": 2017, "Nehalem": 2008, "Zen+": 2018, "Bulldozer": 2011, "Zen 3": 2020,
             "Raptor Lake": 2022, "Alder Lake": 2021, "Raptor Lake Refresh": 2023, "Westmere": 2010, "Rocket Lake": 2021,
             "Excavator": 2015, "Arrow Lake": 2024, "Jaguar": 2013, "Zen 5": 2024, "Cascade Lake": 2019, "Puma+": 2014}


def wd_fields(wd: dict) -> dict:
    """Pull the common CPU columns out of Wikidata's labelled statements."""
    out = {}
    for label, v in wd.items():
        l = label.lower()
        first = v.split(",")[0].strip()
        m = re.match(r"([\d.]+)\s*(\w+)?", first)
        if l == "number of processor cores" and m:
            out["cores"] = num(float(m.group(1)))
        elif l in ("number of threads", "number of hardware threads") and m:
            out["threads"] = num(float(m.group(1)))
        elif l in ("frequency", "clock speed", "clock rate") and m and "base_clock" not in out:
            val, unit = float(m.group(1)), (m.group(2) or "").lower()
            out["base_clock"] = num(round(val / 1000, 3)) if unit == "mhz" else (num(val) if unit == "ghz" else None)
        elif "socket" in l:
            out["socket"] = first
        elif "microarchitecture" in l:
            out["microarchitecture"] = first
        elif l in ("thermal design power", "power consumption") and m:
            out["tdp"] = num(float(m.group(1)))
        elif l in ("fabrication process", "manufacturing process", "process node") and first:
            out["process"] = first
    return {k: v for k, v in out.items() if v is not None}


FOUNDRIES = {"TSMC", "GlobalFoundries", "Samsung Electronics", "UMC", "SMIC", "Tower Semiconductor Ltd."}
NOT_A_CHIP = ("TOP500 System ID", "computer performance", "height", "width", "thickness", "mass", "operating system",
              "display size", "battery capacity")


def clean_wd(items):
    """Wikidata's core-count property is also used for supercomputers and phones: keep only chips."""
    out = []
    for w in items:
        wd = w.get("wd", {})
        if any(k in wd for k in NOT_A_CHIP):
            continue
        chipish = any(k in wd for k in ("clock frequency", "frequency", "socket supported", "microarchitecture",
                                        "instruction set", "fabrication method", "thermal design power",
                                        "number of processor threads", "WikiChip article ID"))
        if not chipish:
            continue
        w = dict(w)
        maker = w.get("maker") or "Unknown"
        designer = (wd.get("developer") or wd.get("designed by") or "").split(",")[0].strip()
        if (maker in FOUNDRIES or maker == "Unknown") and designer:
            maker = designer
        w["maker"] = maker
        if not w.get("year"):
            for k in ("inception", "publication date", "commercialization date", "announcement date"):
                v = wd.get(k, "")
                if v[:4].isdigit():
                    w["year"] = int(v[:4])
                    w["date"] = v[:10] if len(v) >= 7 else None
                    break
        out.append(w)
    return out


# Typical platform specs per CPU architecture (desktop parts). Shown with a note that they're per family.
ARCH_SPECS = {
    "Zen 5": ("AM5", "TSMC N4 (cores), N6 (I/O)", "DDR5", "PCIe 5.0"),
    "Zen 4": ("AM5", "TSMC N5 (cores), N6 (I/O)", "DDR5", "PCIe 5.0"),
    "Zen 3": ("AM4", "TSMC N7", "DDR4", "PCIe 4.0 (3.0 on APUs)"),
    "Zen 2": ("AM4", "TSMC N7", "DDR4", "PCIe 4.0 (3.0 on APUs)"),
    "Zen+": ("AM4", "GlobalFoundries 12 nm", "DDR4", "PCIe 3.0"),
    "Zen": ("AM4", "GlobalFoundries 14 nm", "DDR4", "PCIe 3.0"),
    "Excavator": ("AM4 / FM2+", "28 nm", "DDR4 / DDR3", "PCIe 3.0"),
    "Steamroller": ("FM2+", "GlobalFoundries 28 nm", "DDR3", "PCIe 3.0"),
    "Piledriver": ("AM3+ / FM2", "GlobalFoundries 32 nm", "DDR3", "PCIe 2.0"),
    "Bulldozer": ("AM3+", "GlobalFoundries 32 nm", "DDR3", "PCIe 2.0"),
    "Lynx": ("FM1", "GlobalFoundries 32 nm", "DDR3", "PCIe 2.0"),
    "K10": ("AM2+ / AM3", "65 / 45 nm", "DDR2 / DDR3", "PCIe 2.0"),
    "Jaguar": ("AM1", "TSMC 28 nm", "DDR3", "PCIe 2.0"),
    "Arrow Lake": ("LGA 1851", "TSMC N3B (compute tile)", "DDR5", "PCIe 5.0"),
    "Raptor Lake Refresh": ("LGA 1700", "Intel 7", "DDR5 / DDR4", "PCIe 5.0"),
    "Raptor Lake": ("LGA 1700", "Intel 7", "DDR5 / DDR4", "PCIe 5.0"),
    "Alder Lake": ("LGA 1700", "Intel 7", "DDR5 / DDR4", "PCIe 5.0"),
    "Rocket Lake": ("LGA 1200", "Intel 14 nm", "DDR4", "PCIe 4.0"),
    "Comet Lake": ("LGA 1200", "Intel 14 nm", "DDR4", "PCIe 3.0"),
    "Coffee Lake Refresh": ("LGA 1151 (300 series)", "Intel 14 nm", "DDR4", "PCIe 3.0"),
    "Coffee Lake": ("LGA 1151 (300 series)", "Intel 14 nm", "DDR4", "PCIe 3.0"),
    "Kaby Lake": ("LGA 1151", "Intel 14 nm", "DDR4 / DDR3L", "PCIe 3.0"),
    "Skylake": ("LGA 1151 / LGA 2066", "Intel 14 nm", "DDR4 / DDR3L", "PCIe 3.0"),
    "Cascade Lake": ("LGA 2066", "Intel 14 nm", "DDR4", "PCIe 3.0"),
    "Broadwell": ("LGA 1150 / LGA 2011-3", "Intel 14 nm", "DDR3 / DDR4", "PCIe 3.0"),
    "Haswell Refresh": ("LGA 1150", "Intel 22 nm", "DDR3", "PCIe 3.0"),
    "Haswell": ("LGA 1150 / LGA 2011-3", "Intel 22 nm", "DDR3 / DDR4", "PCIe 3.0"),
    "Ivy Bridge": ("LGA 1155 / LGA 2011", "Intel 22 nm", "DDR3", "PCIe 3.0"),
    "Sandy Bridge": ("LGA 1155 / LGA 2011", "Intel 32 nm", "DDR3", "PCIe 2.0"),
    "Westmere": ("LGA 1156 / LGA 1366", "Intel 32 nm", "DDR3", "PCIe 2.0"),
    "Nehalem": ("LGA 1156 / LGA 1366", "Intel 45 nm", "DDR3", "PCIe 2.0"),
    "Wolfdale": ("LGA 775", "Intel 45 nm", "DDR2 / DDR3", "PCIe 2.0"),
    "Yorkfield": ("LGA 775", "Intel 45 nm", "DDR2 / DDR3", "PCIe 2.0"),
    "Core": ("LGA 775", "Intel 65 nm", "DDR2 / DDR3", "PCIe 1.1"),
}


def cpu_extras(name, arch):
    out = {}
    sp = ARCH_SPECS.get(arch or "")
    if sp:
        out.update({"socket": sp[0], "process": sp[1], "memory_support": sp[2], "pcie": sp[3],
                    "platform_note": "Socket, process, memory and PCIe are typical for this architecture"})
    n = name.upper()
    if "INTEL" in n:
        out["unlocked"] = "Yes" if re.search(r"\d{3,5}K(F|S)?\b", n) or "EXTREME" in n or re.search(r"\d{4,5}X(E)?\b", n) else "No"
    elif "RYZEN" in n:
        out["unlocked"] = "Yes"
    if "X3D" in n:
        out["cache_note"] = "3D V-Cache (stacked L3)"
    return out


# Launch years for well-known desktop lines where the architecture year would be wrong (refreshes, late SKUs).
MODEL_YEARS = [
    (r"RYZEN 9 9(950|900)X3D", 2025), (r"RYZEN 7 9800X3D", 2024), (r"RYZEN \d 9\d{3}F?\b", 2025),
    (r"RYZEN \d 9\d{3}X\b", 2024), (r"RYZEN \d 9\d00\b", 2024),
    (r"RYZEN \d 8\d{3}G", 2024), (r"RYZEN \d 8\d{3}F", 2024), (r"RYZEN \d 8\d00\b", 2024),
    (r"RYZEN 5 7600X3D", 2024), (r"RYZEN \d 7\d{3}X3D", 2023), (r"RYZEN 5 7500F", 2023), (r"RYZEN \d 7\d00\b", 2023),
    (r"RYZEN \d 7\d{3}X\b", 2022),
    (r"RYZEN 7 5700X3D", 2024), (r"RYZEN 5 5600X3D", 2023), (r"RYZEN 7 5800X3D", 2022),
    (r"RYZEN \d 5\d{3}(GT|XT)\b", 2024), (r"RYZEN \d 5\d{3}(F)?\b", 2022), (r"RYZEN \d 5\d{3}G\b", 2021),
    (r"RYZEN \d 5\d{3}X\b", 2020),
    (r"CORE ULTRA \d 2\d{2}", 2024),
    (r"I\d-14\d{3}(K|KF|KS)\b", 2023), (r"I\d-14\d{3}", 2024), (r"I\d-13\d{3}(K|KF)\b", 2022), (r"I\d-13\d{3}", 2023),
    (r"I\d-12\d{3}(K|KF)\b", 2021), (r"I\d-12\d{3}", 2022),
]


def model_year(name):
    n = name.upper()
    for pat, year in MODEL_YEARS:
        if re.search(pat, n):
            return year
    return None


def boost_or_none(r):
    """PCPartPicker sometimes has a boost clock below the base clock; that's a data error, so leave it out."""
    b, c = r.get("boost_clock"), r.get("core_clock")
    try:
        return None if b is not None and c is not None and float(b) < float(c) else b
    except (TypeError, ValueError):
        return b


def build_cpus(wd_items):
    wd_items = clean_wd(wd_items)
    rows = pcpp("cpu")
    items = []
    seen = set()
    for r in rows:
        it = mk(r["name"], {
            "microarchitecture": r.get("microarchitecture"), "cores": r.get("core_count"),
            "base_clock": r.get("core_clock"), "boost_clock": boost_or_none(r), "tdp": r.get("tdp"),
            "graphics": r.get("graphics"), "year": ARCH_YEAR.get(r.get("microarchitecture") or ""),
            **cpu_extras(r["name"], r.get("microarchitecture")),
        })
        my = model_year(r["name"])
        if my:
            it["year"] = my
        elif it.get("year"):
            it["year_note"] = "approx., from the architecture"
        items.append(it)
        seen.add(norm(r["name"]))
    # Wikidata adds history (8086 onwards) and fills release dates for matching chips.
    by_norm = {norm(i["name"]): i for i in items}
    added = 0
    for w in wd_items:
        n = norm(w["name"])
        cand = by_norm.get(n) or (by_norm.get(norm(f"{w['maker']} {w['name']}")) if w.get("maker") else None)
        if cand:
            cand["wd"] = w["wd"]
            cand["link"] = w["link"]
            if w.get("year"):
                cand["year"], cand["date"] = w["year"], w.get("date")
                cand.pop("year_note", None)
            continue
        items.append({**w, **wd_fields(w["wd"])})
        added += 1
    log(f"CPUs: {len(rows)} from PCPartPicker + {added} more from Wikidata")
    category(
        "cpu", "Processors (CPUs)", "hardware",
        "Desktop, laptop and server processors, from early chips to the newest releases.",
        [("microarchitecture", "Microarchitecture", None), ("cores", "Cores", None), ("threads", "Threads", None),
         ("base_clock", "Base clock", "GHz"), ("boost_clock", "Boost clock", "GHz"), ("socket", "Socket", None),
         ("tdp", "TDP", "W"), ("process", "Process", None), ("graphics", "Integrated graphics", None),
         ("memory_support", "Memory support", None), ("pcie", "PCIe", None), ("unlocked", "Unlocked multiplier", None),
         ("cache_note", "Cache", None), ("date", "Release date", None), ("platform_note", "Note", None)],
        ["maker", "year", "microarchitecture", "socket", "cores"], items, [SRC_PCPP, SRC_WD],
        note="Release years marked approx. come from the chip's architecture.",
    )


CHIPSETS = ["X870E", "X870", "B850", "B840", "X670E", "X670", "B650E", "B650", "A620", "X570", "B550", "A520", "X470", "B450",
            "X370", "B350", "A320", "X300", "A300", "TRX50", "WRX90", "TRX40", "WRX80", "X399", "990FX", "990X", "970", "A88X",
            "A85X", "A78", "A75", "A68H", "A58", "A55", "AM1", "Z890", "B860", "H810", "W880", "Z790", "B760", "H770", "H610",
            "Z690", "B660", "H670", "W680", "Z590", "B560", "H570", "H510", "W580", "Z490", "B460", "H470", "H410", "W480", "Z390",
            "B365", "B360", "H370", "H310", "Z370", "Q370", "Z270", "B250", "H270", "Q270", "Z170", "B150", "H170", "H110", "Q170",
            "X299", "X99", "X79", "C612", "C602", "Z97", "H97", "Z87", "H87", "B85", "H81", "Q87", "Z77", "Z75", "H77", "B75",
            "Z68", "P67", "H67", "H61", "Q67", "X58", "P55", "H57", "H55", "P45", "P43", "G41", "G31", "X48", "X38", "P35"]
CHIPSET_RE = re.compile(r"(?<![A-Z0-9])(" + "|".join(CHIPSETS) + r")(?![0-9])")
SOCKET_MEM = {"AM5": "DDR5", "AM4": "DDR4", "LGA1851": "DDR5", "LGA1200": "DDR4", "LGA1151": "DDR4", "LGA2066": "DDR4",
              "sTRX4": "DDR4", "sWRX8": "DDR4", "TR4": "DDR4", "sTR5": "DDR5", "LGA1150": "DDR3", "LGA1155": "DDR3",
              "LGA1156": "DDR3", "LGA1366": "DDR3", "LGA2011": "DDR3", "LGA2011-3": "DDR4", "AM3+": "DDR3", "AM3": "DDR3",
              "FM2+": "DDR3", "FM2": "DDR3", "FM1": "DDR3", "AM1": "DDR3", "LGA775": "DDR2 / DDR3", "AM2+": "DDR2"}


def board_extras(name, socket):
    out = {}
    n = name.upper()
    m = CHIPSET_RE.search(n)
    if m:
        out["chipset"] = m.group(1)
    sock = socket.replace(" ", "")
    if re.search(r"/D3\b|\bD3\b|DDR3", n):
        out["memory_type"] = "DDR3"
    elif re.search(r"/D4\b|\bD4\b|DDR4", n):
        out["memory_type"] = "DDR4"
    elif sock == "LGA1700":
        out["memory_type"] = "DDR4" if re.search(r"DDR4|\bD4\b|-D4\b", n) else ("DDR5" if "DDR5" in n else "DDR4 or DDR5 (check model)")
    elif sock in SOCKET_MEM:
        out["memory_type"] = SOCKET_MEM[sock]
    if re.search(r"WI-?FI|\bAX\b|\bAC\b|WIRELESS", n):
        out["wifi"] = "Yes"
    return out


def build_pcpp_categories(gpu_by_norm):
    # Graphics cards (board partner models), linked to their GPU chip for the release year.
    rows = pcpp("video-card")
    # Desktop chips first, so "GeForce RTX 4060 Ti" matches the desktop card, not a mobile one.
    keys = sorted(gpu_by_norm, key=lambda k: ("mobile" in k or "max-q" in k, len(k)))

    def find_chip(chip):
        c = re.sub(r"\s+(LHR|G5|G6|OEM)\b", "", chip)
        c = re.sub(r"\s+-\s+\d+$", "", c)
        for cand in (c, re.sub(r"\s*\d+\s*GB$", "", c)):
            n = norm(cand)
            if n in gpu_by_norm:
                return gpu_by_norm[n]
            for k in keys:
                if k.startswith(n) and re.fullmatch(r"\d+(mb|gb)?", k[len(n):] or "0"):
                    return gpu_by_norm[k]
        return None

    items = []
    for r in rows:
        chip = r.get("chipset") or ""
        g = find_chip(chip)
        card = mk(r["name"], {
            "kind": "Retail card", "chipset": chip, "memory": f"{num(r['memory'])} GB" if r.get("memory") else None,
            "core_clock": r.get("core_clock"), "boost_clock": boost_or_none(r), "length_mm": r.get("length"),
            "color": r.get("color"), "year": g.get("year") if g else None, "date": g.get("date") if g else None,
            "chip_id": g["id"] if g else None,
        })
        if g:  # columns and filters come from the GPU chip; the app shows the chip's full specs too
            if card.get("pop_rank"):
                g["pop_rank"] = min(g.get("pop_rank", 10**9), card["pop_rank"])
            # Steam usage stays on the chip (Steam counts chips, not retail cards); the card panel shows the chip's.
            for k in ("generation", "architecture", "memory_type", "memory_bus", "cores", "sms", "tensor_cores", "rt_cores", "tdp", "bus", "outputs"):
                if g.get(k) and k not in card:
                    card[k] = g[k]
        items.append(card)
    chip_fields = [tuple(f) for f in GPU_DATA.get("fields", [])]
    first = ["generation", "memory", "cores", "architecture"]
    gpu_fields = [("kind", "Type", None)] + [f for k in first for f in chip_fields if f[0] == k] + [("chipset", "GPU", None)]
    gpu_fields += [f for f in chip_fields if f[0] not in first]
    gpu_fields += [("core_clock", "Core clock", "MHz"), ("color", "Color", None)]
    category("gpu", "Graphics cards (GPUs)", "hardware",
             "Every graphics chip since 1986 with full specifications, plus retail cards from MSI, Asus, Gigabyte, Sapphire and the other board partners.",
             gpu_fields, ["kind", "maker", "year", "generation", "architecture", "memory_type"],
             GPU_DATA.get("items", []) + items, [SRC_TPU, SRC_PCPP, SRC_STEAM])

    rows = pcpp("motherboard")
    boards = []
    for r in rows:
        it = mk(r["name"], {k: r.get(k) for k in ("socket", "form_factor", "memory_slots", "max_memory", "color")})
        it.update(board_extras(r["name"], r.get("socket") or ""))
        boards.append(it)
    category("motherboard", "Motherboards", "hardware", "Motherboards for every socket and form factor.",
             [("socket", "Socket", None), ("chipset", "Chipset", None), ("form_factor", "Form factor", None),
              ("memory_type", "Memory type", None), ("memory_slots", "Memory slots", None),
              ("max_memory", "Max memory", "GB"), ("wifi", "Wi-Fi", None), ("color", "Color", None)],
             ["maker", "socket", "chipset", "form_factor", "memory_type"], boards, [SRC_PCPP])

    rows = pcpp("memory")
    items = []
    for r in rows:
        sp, mo = r.get("speed"), r.get("modules")
        items.append(mk(r["name"], {
            "type": f"DDR{sp[0]}" if isinstance(sp, list) and sp[0] else None,
            "speed": f"DDR{sp[0]}-{sp[1]}" if isinstance(sp, list) and sp[0] else None,
            "kit": f"{mo[0]} × {num(mo[1])} GB" if isinstance(mo, list) else None,
            "capacity": num(mo[0] * mo[1]) if isinstance(mo, list) else None,
            "cas_latency": r.get("cas_latency"), "first_word_latency": r.get("first_word_latency"), "color": r.get("color"),
        }))
    category("memory", "Memory (RAM)", "hardware", "Desktop memory kits, DDR to DDR5.",
             [("type", "Type", None), ("speed", "Speed", None), ("kit", "Kit", None), ("capacity", "Total capacity", "GB"),
              ("cas_latency", "CAS latency", None), ("first_word_latency", "First word latency", "ns"), ("color", "Color", None)],
             ["maker", "type", "capacity"], items, [SRC_PCPP])

    rows = pcpp("internal-hard-drive")
    ssd, hdd = [], []
    for r in rows:
        cap = r.get("capacity")
        it = mk(r["name"], {
            "capacity": f"{num(cap / 1000)} TB" if cap and cap >= 1000 else (f"{num(cap)} GB" if cap else None),
            "form_factor": r.get("form_factor"), "interface": r.get("interface"),
            "cache": f"{num(r['cache'])} MB" if r.get("cache") else None,
        })
        iface = r.get("interface") or ""
        if r.get("type") == "SSD":
            it["protocol"] = "NVMe" if "PCIe" in iface else ("SAS" if "SAS" in iface else "SATA" if ("SATA" in iface or "mSATA" in iface) else None)
            if not it["protocol"]:
                it.pop("protocol")
        if r.get("type") == "SSD":
            ssd.append(it)
        else:
            if r.get("type") and str(r.get("type")).isdigit():
                it["rpm"] = int(r["type"])
            hdd.append(it)
    flds = [("capacity", "Capacity", None), ("form_factor", "Form factor", None), ("interface", "Interface", None), ("cache", "Cache", None)]
    category("ssd", "SSDs", "hardware", "Solid state drives: NVMe, SATA, M.2 and more.",
             [flds[0], ("protocol", "Protocol", None)] + flds[1:], ["maker", "protocol", "interface", "form_factor"], ssd, [SRC_PCPP])
    category("hdd", "Hard drives (HDD)", "hardware", "Spinning hard drives for desktops, NAS and servers.",
             flds + [("rpm", "Spindle speed", "RPM")], ["maker", "rpm", "form_factor"], hdd, [SRC_PCPP])

    simple = [
        ("power-supply", "power-supply", "Power supplies (PSU)", "hardware", "ATX, SFX and other power supplies.",
         [("wattage", "Wattage", "W"), ("type", "Type", None), ("efficiency", "80 PLUS rating", None), ("modular", "Modular", None), ("color", "Color", None)],
         ["maker", "efficiency", "type"]),
        ("cpu-cooler", "cpu-cooler", "CPU coolers", "hardware", "Air coolers and all-in-one liquid coolers.",
         [("size", "Radiator size", "mm"), ("rpm", "Fan speed", "RPM"), ("noise_level", "Noise", "dB"), ("color", "Color", None)],
         ["maker", "size"]),
        ("case", "case", "Cases", "hardware", "PC cases from mini-ITX to full tower.",
         [("type", "Type", None), ("side_panel", "Side panel", None), ("external_volume", "Volume", "L"),
          ("internal_35_bays", "3.5\" bays", None), ("psu", "Included PSU", "W"), ("color", "Color", None)],
         ["maker", "type", "side_panel"]),
        ("case-fan", "case-fan", "Case fans", "hardware", "Case and radiator fans.",
         [("size", "Size", "mm"), ("rpm", "Speed", "RPM"), ("airflow", "Airflow", "CFM"), ("noise_level", "Noise", "dB"), ("pwm", "PWM", None), ("color", "Color", None)],
         ["maker", "size"]),
        ("fan-controller", "fan-controller", "Fan controllers", "hardware", "Fan hubs and controllers.",
         [("channels", "Channels", None), ("channel_wattage", "Watts per channel", "W"), ("pwm", "PWM", None), ("form_factor", "Form factor", None)],
         ["maker"]),
        ("thermal-paste", "thermal-paste", "Thermal paste", "hardware", "Thermal compounds.", [("amount", "Amount", "g")], ["maker"]),
        ("sound-card", "sound-card", "Sound cards", "hardware", "Internal sound cards.",
         [("channels", "Channels", None), ("digital_audio", "Bit depth", "bit"), ("snr", "Signal to noise", "dB"),
          ("sample_rate", "Sample rate", "kHz"), ("chipset", "Chipset", None), ("interface", "Interface", None)],
         ["maker", "interface"]),
        ("network-card", "wired-network-card", "Network cards (wired)", "hardware", "Ethernet adapters.",
         [("interface", "Interface", None), ("color", "Color", None)], ["maker", "interface"]),
        ("wifi-card", "wireless-network-card", "Wi-Fi cards", "hardware", "Wireless network adapters.",
         [("protocol", "Wi-Fi standard", None), ("interface", "Interface", None), ("color", "Color", None)], ["maker", "protocol", "interface"]),
        ("optical-drive", "optical-drive", "Optical drives", "hardware", "CD, DVD and Blu-ray drives.",
         [("bd", "Blu-ray read", "x"), ("dvd", "DVD read", "x"), ("cd", "CD read", "x"), ("bd_write", "Blu-ray write", None),
          ("dvd_write", "DVD write", None), ("cd_write", "CD write", None)], ["maker"]),
        ("case-accessory", "case-accessory", "Case accessories", "hardware", "Lighting kits, card readers and other case add-ons.",
         [("type", "Type", None), ("form_factor", "Bay size", "\"")], ["maker", "type"]),
        ("ups", "ups", "UPS (battery backup)", "hardware", "Uninterruptible power supplies.",
         [("capacity_w", "Capacity", "W"), ("capacity_va", "Capacity", "VA")], ["maker"]),
        ("os", "os", "Operating systems", "hardware", "Retail and OEM operating system editions.",
         [("mode", "Architecture", "bit"), ("max_memory", "Max memory", "GB")], ["maker"]),
        # Peripherals
        ("monitor", "monitor", "Monitors", "peripherals", "Gaming, office and professional monitors.",
         [("screen_size", "Screen size", "\""), ("resolution", "Resolution", None), ("refresh_rate", "Refresh rate", "Hz"),
          ("response_time", "Response time", "ms"), ("panel_type", "Panel", None), ("aspect_ratio", "Aspect ratio", None)],
         ["maker", "panel_type", "refresh_rate", "resolution"]),
        ("keyboard", "keyboard", "Keyboards", "peripherals", "Mechanical, membrane, wired and wireless keyboards.",
         [("style", "Style", None), ("switches", "Switches", None), ("backlit", "Backlight", None), ("tenkeyless", "Tenkeyless", None),
          ("connection_type", "Connection", None), ("color", "Color", None)], ["maker", "style", "connection_type"]),
        ("mouse", "mouse", "Mice", "peripherals", "Gaming and office mice.",
         [("tracking_method", "Sensor", None), ("connection_type", "Connection", None), ("max_dpi", "Max DPI", None),
          ("hand_orientation", "Hand", None), ("color", "Color", None)], ["maker", "connection_type", "tracking_method"]),
        ("headphones", "headphones", "Headphones & headsets", "peripherals", "Headphones, headsets and earbuds.",
         [("type", "Type", None), ("frequency_response", "Frequency response", None), ("microphone", "Microphone", None),
          ("wireless", "Wireless", None), ("enclosure_type", "Enclosure", None), ("color", "Color", None)], ["maker", "type", "wireless"]),
        ("speakers", "speakers", "Speakers", "peripherals", "Desktop speakers and sound bars.",
         [("configuration", "Channels", None), ("wattage", "Power", "W"), ("frequency_response", "Frequency response", None), ("color", "Color", None)],
         ["maker", "configuration"]),
        ("webcam", "webcam", "Webcams", "peripherals", "Webcams and streaming cameras.",
         [("resolutions", "Resolutions", None), ("connection", "Connection", None), ("focus_type", "Focus", None), ("fov", "Field of view", "°"), ("os", "OS support", None)],
         ["maker", "focus_type"]),
        ("external-storage", "external-hard-drive", "External storage", "peripherals", "Portable and desktop external drives.",
         [("type", "Type", None), ("interface", "Interface", None), ("capacity", "Capacity", "GB"), ("color", "Color", None)], ["maker", "type"]),
    ]
    for cid, src, name, group, desc, fields, filters in simple:
        rows = pcpp(src)
        items = []
        for r in rows:
            ex = {}
            for k, v in r.items():
                if k in ("name", "price", "price_per_gb"):
                    continue
                if k == "frequency_response" and isinstance(v, list):
                    v = f"{num(v[0])} Hz – {num(v[1])} kHz"
                elif k == "resolution" and isinstance(v, list):
                    v = f"{v[0]} × {v[1]}"
                elif k in ("airflow", "noise_level", "rpm", "size") and isinstance(v, list):
                    v = rng(v)
                elif isinstance(v, bool):
                    v = "Yes" if v else "No"
                elif isinstance(v, list):
                    v = ", ".join(str(x) for x in v)
                elif k == "efficiency" and isinstance(v, str):
                    v = "80 PLUS" if v == "plus" else f"80 PLUS {v.title()}"
                ex[k] = v
            it = mk(r["name"], ex)
            if cid == "monitor":
                res, size = r.get("resolution"), r.get("screen_size")
                if isinstance(res, list) and size:
                    it["ppi"] = round((res[0] ** 2 + res[1] ** 2) ** 0.5 / size)
                    it["resolution_class"] = ("8K" if res[1] >= 4320 else "5K" if res[0] >= 5120 and res[1] >= 2880 else
                                              "4K / UHD" if res[1] >= 2160 else "1440p" if res[1] >= 1440 else
                                              "1080p" if res[1] >= 1080 else "720p" if res[1] >= 720 else "Below 720p")
            items.append(it)
        if cid == "monitor":
            fields = fields[:2] + [("resolution_class", "Class", None), ("ppi", "Pixel density", "PPI")] + fields[2:]
            filters = filters + ["resolution_class"]
        if cid == "cpu-cooler":
            # A radiator size means an all-in-one liquid cooler; everything else is an air cooler.
            for it in items:
                it["type"] = "AIO liquid" if it.get("size") else "Air"
            fields = [("type", "Type", None)] + fields
            filters = ["maker", "type", "size"]
            aio = []
            for it in items:
                if it.get("size"):
                    a = dict(it)
                    a.pop("type", None)
                    m = re.match(r"(\d+)", str(a["size"]))
                    if m:
                        fans = {120: 1, 140: 1, 240: 2, 280: 2, 360: 3, 420: 3, 480: 4}.get(int(m.group(1)))
                        if fans:
                            a["fans"] = fans
                    aio.append(a)
            category("aio", "AIO water coolers", "hardware", "All-in-one liquid CPU coolers, by radiator size.",
                     [("size", "Radiator size", "mm"), ("fans", "Fans (typical)", None), ("rpm", "Fan speed", "RPM"),
                      ("noise_level", "Noise", "dB"), ("color", "Color", None)],
                     ["maker", "size", "color"], aio, [SRC_PCPP])
        category(cid, name, group, desc, fields, filters, items, [SRC_PCPP])


# Categories the user asked for that no open dataset covers yet: they start empty
# (or with hand-added items from catalog-extra) and fill in through the news job.
EXTRA_CATEGORIES = [
    ("chipset", "Chipsets", "hardware", "Motherboard chipsets (Intel Z/B/H, AMD X/B/A series)."),
    ("capture-card", "Capture cards", "hardware", "Internal and external video capture cards."),
    ("cooling-custom", "Custom water cooling", "hardware", "Water blocks, pumps, reservoirs and radiators."),
    ("microphone", "Microphones", "peripherals", "USB and XLR microphones for streaming and calls."),
    ("controller", "Game controllers", "peripherals", "Gamepads, arcade sticks, wheels and flight sticks."),
    ("mousepad", "Mouse pads", "peripherals", "Cloth, hard and glass mouse pads."),
    ("vr-headset", "VR headsets", "peripherals", "PC virtual reality headsets."),
    ("printer", "Printers & scanners", "peripherals", "Inkjet, laser and 3D printers, and scanners."),
    ("router", "Routers & networking", "peripherals", "Routers, mesh Wi-Fi and network switches."),
    ("drawing-tablet", "Drawing tablets", "peripherals", "Pen tablets and pen displays."),
    ("streaming", "Streaming gear", "peripherals", "Stream decks, lights and audio interfaces."),
]


def load_extra():
    """catalog-extra/<category>.json: {"items": [...]} added by hand or by the recap job."""
    out = {}
    if os.path.isdir(EXTRA):
        for f in os.listdir(EXTRA):
            if f.endswith(".json"):
                try:
                    out[f[:-5]] = json.load(open(os.path.join(EXTRA, f), encoding="utf-8"))
                except Exception as e:  # noqa: BLE001
                    log(f"bad extra file {f}: {e}")
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    gpu_by_norm = build_gpus()
    # Wikidata results are kept in catalog-cache/ so a rate-limited run keeps last week's data.
    cache = os.path.join(ROOT, "catalog-cache", "wikidata-cpus.json")
    wd = []
    if not os.environ.get("SKIP_WIKIDATA"):
        try:
            wd = build_wikidata_cpus()
        except Exception as e:  # noqa: BLE001
            log(f"Wikidata failed: {e}")
    if len(wd) > 100:
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        with open(cache, "w", encoding="utf-8") as f:
            json.dump(wd, f, ensure_ascii=False, separators=(",", ":"))
    elif os.path.exists(cache):
        wd = json.load(open(cache, encoding="utf-8"))
        log(f"Using cached Wikidata processors: {len(wd)}")
    build_cpus(wd)
    build_pcpp_categories(gpu_by_norm)
    # VR headsets: specs entered by hand (tools/catalog/vr_specs.py), plus how many Steam VR users have each one.
    vr, vr_month = steam_usage("VR Headsets")
    if vr:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import vr_specs
        merged: dict[str, dict] = {}
        for name, u in vr.items():
            if name in vr_specs.SKIP:
                continue
            name = vr_specs.ALIASES.get(name, name)
            maker = name.split()[0]
            maker = {"Oculus": "Meta (Oculus)", "Meta": "Meta (Oculus)", "Windows": "Microsoft (WMR)"}.get(maker, maker)
            it = merged.setdefault(name, {"id": slug(name), "name": name.replace(" HMD", "") if name == "Valve Index HMD" else name, "maker": maker})
            if u["share"] is not None:
                it["steam_share"] = max(it.get("steam_share", 0), u["share"])
            if u["peak"] > it.get("steam_peak", 0):
                it["steam_peak"], it["steam_peak_month"] = u["peak"], u["peak_month"]
        for name, spec in vr_specs.SPECS.items():
            it = merged.setdefault(name, {"id": slug(name), "name": name, "maker": name.split()[0]})
            it.update({k: v for k, v in spec.items() if v is not None})
        heads = list(merged.values())
        category("vr-headset", "VR headsets", "peripherals",
                 "VR headsets used for PC gaming: display, resolution, refresh rate, field of view, tracking and more.",
                 vr_specs.FIELDS + [("steam_share", "Share of Steam VR users (latest)", "%"), ("steam_peak", "Peak share of Steam VR users", "%"),
                                    ("steam_peak_month", "Peak month", None)],
                 ["maker", "year", "type", "display"], heads, [SRC_STEAM, {"name": "Manufacturer spec sheets", "url": "https://github.com/TASTTYCHEESE/Hardware-Tracker/blob/main/tools/catalog/vr_specs.py"}])
    extra = load_extra()
    have = {c["id"] for c in CATEGORIES}
    for cid, name, group, desc in EXTRA_CATEGORIES:
        if cid not in have:
            # A hand-made file can bring its own spec columns and filters.
            spec = extra.get(cid, {})
            category(cid, name, group, desc, [tuple(f) for f in spec.get("fields", [])], spec.get("filters", ["maker", "year"]), [],
                     [SRC_EXTRA] + spec.get("sources", []),
                     note=spec.get("note", "New products are added as they appear in the news."))
    for c in CATEGORIES:
        add = extra.get(c["id"], {}).get("items", [])
        if add:
            ids = {i["id"] for i in c["items"]}
            c["items"].extend(i for i in add if i.get("id") and i["id"] not in ids)
            if SRC_EXTRA not in c["sources"]:
                c["sources"].append(SRC_EXTRA)

    # Popularity (PCPartPicker rank) and usage (Steam survey) fields, where a category has them.
    for c in CATEGORIES:
        keys = {k for i in c["items"] for k in i}
        have = {f["k"] for f in c["fields"]}
        c["sorts"] = [x for x, k in (("popular", "pop_rank"), ("used", "steam_share")) if k in keys or (x == "used" and "steam_peak" in keys)]
        for k, label, unit in (("pop_rank", "Popularity rank (PCPartPicker, 1 = most popular)", None),
                               ("steam_share", "Steam users (latest survey)", "%"), ("steam_peak", "Steam users (peak)", "%"),
                               ("steam_peak_month", "Steam peak month", None)):
            if k in keys and k not in have:
                c["fields"].append({"k": k, "label": label, **({"unit": unit} if unit else {})})

    today = dt.date.today().isoformat()
    index = {"version": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H%M"), "updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "categories": []}
    # Laptop chips: say "Laptop GPU" (what Nvidia, AMD and Intel call them now), not "Mobile". Ids stay the same.
    for c in CATEGORIES:
        if c["id"] in ("gpu", "graphics-card"):
            for i in c["items"]:
                for k in ("name", "chipset"):
                    if isinstance(i.get(k), str):
                        i[k] = re.sub(r"\bMobile\b", "Laptop GPU", i[k])
                if isinstance(i.get("generation"), str):
                    i["generation"] = re.sub(r"\bMobile\b", "Laptop", i["generation"])
    for c in CATEGORIES:
        disambiguate(c)
        c["items"].sort(key=lambda i: (-(i.get("year") or 0), i["name"].lower()))
        # Make ids unique inside a category.
        seen: dict[str, int] = {}
        for i in c["items"]:
            n = seen.get(i["id"], 0)
            seen[i["id"]] = n + 1
            if n:
                i["id"] = f"{i['id']}-{n + 1}"
        body = json.dumps({k: c[k] for k in ("id", "name", "group", "description", "fields", "filters", "sorts", "sources", "note", "items")},
                          ensure_ascii=False, separators=(",", ":"))
        with open(os.path.join(OUT, f"{c['id']}.json"), "w", encoding="utf-8") as f:
            f.write(body)
        years = [i["year"] for i in c["items"] if i.get("year")]
        makers = {i.get("maker") for i in c["items"] if i.get("maker")}
        index["categories"].append({
            "id": c["id"], "name": c["name"], "group": c["group"], "description": c["description"],
            "count": len(c["items"]), "makers": len(makers), "years": [min(years), max(years)] if years else None,
            "bytes": len(body.encode()), "file": f"{c['id']}.json",
        })
        log(f"{c['id']:18} {len(c['items']):6} items  {len(body) // 1024:6} KB")
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    log(f"Total items: {sum(c['count'] for c in index['categories'])}")


# Fields that tell same-named listings apart, best first ("Acer Nitro OC" -> "Acer Nitro OC (Radeon RX 9070 XT)").
TELL_APART = ["chipset", "capacity", "speed", "kit", "cas_latency", "size", "screen_size", "resolution", "refresh_rate",
              "wattage", "memory", "socket", "form_factor", "interface", "type", "connection_type", "color"]
META_KEYS = {"id", "pop_rank", "link", "steam_share", "steam_peak", "steam_peak_month", "first_word_latency", "date", "year",
             "year_note", "chip_id", "wd", "name"}


def disambiguate(c):
    """Same-named rows: drop exact duplicates, then add the specs that differ to the name."""
    units = {f["k"]: f.get("unit") for f in c["fields"]}
    groups: dict[str, list] = {}
    for i in c["items"]:
        groups.setdefault(i["name"].strip().lower(), []).append(i)
    drop = set()
    for rows in groups.values():
        if len(rows) < 2:
            continue
        rows.sort(key=lambda i: i.get("pop_rank") or 10**9)
        sigs = set()
        for i in rows:
            sig = json.dumps({k: v for k, v in i.items() if k not in META_KEYS}, sort_keys=True, ensure_ascii=False)
            if sig in sigs:
                drop.add(id(i))
            sigs.add(sig)
        rows = [i for i in rows if id(i) not in drop]
        if len(rows) < 2:
            continue
        keys = [k for k in TELL_APART + sorted({k for i in rows for k in i} - META_KEYS - set(TELL_APART) - {"maker"})
                if len({json.dumps(i.get(k)) for i in rows}) > 1]
        use: list = [k for k in keys if k in ("chipset", "capacity", "speed", "cas_latency", "wattage", "screen_size")]

        def distinct(ks):
            return len({tuple(json.dumps(i.get(x)) for x in ks) for i in rows})
        while len(use) < 5 and distinct(use) < len(rows):  # greedily add the field that separates the most rows
            best = max((k for k in keys if k not in use), key=lambda k: (distinct(use + [k]), -keys.index(k)), default=None)
            if best is None or distinct(use + [best]) == distinct(use):
                break
            use.append(best)
        use.sort(key=keys.index)

        def fmt(k, v):
            if v is None or v == "":
                return None
            if k == "cas_latency":
                return f"CL{v}"
            u = units.get(k)
            if not u or u in str(v):
                return str(v)
            return f"{v}{u}" if u in ('"', "%", "″") else f"{v} {u}"
        for i in rows:
            extra = [x for x in (fmt(k, i.get(k)) for k in use) if x and x.lower() not in i["name"].lower()]
            if extra:
                i["name"] = f"{i['name']} ({', '.join(extra)})"
    if drop:
        c["items"] = [i for i in c["items"] if id(i) not in drop]
        log(f"{c['id']}: dropped {len(drop)} duplicate listings")


if __name__ == "__main__":
    main()
