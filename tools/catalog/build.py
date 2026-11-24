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


def get(url, data=None, headers=None, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
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
            "shaders": g.get("shading_units") or None, "tmus": g.get("texture_mapping_units") or None,
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
        items.append({k: v for k, v in it.items() if v not in (None, "", 0)})
    log(f"GPUs: {len(items)}")
    category(
        "gpu", "Graphics chips (GPUs)", "hardware",
        "Every desktop, laptop, workstation and console graphics chip since 1986, with full specifications.",
        [("generation", "Generation", None), ("architecture", "Architecture", None), ("gpu_chip", "GPU chip", None),
         ("date", "Release date", None), ("foundry", "Foundry", None), ("process_nm", "Process", "nm"),
         ("transistors_m", "Transistors", "million"), ("die_mm2", "Die size", "mm²"), ("bus", "Bus interface", None),
         ("base_clock", "Base clock", "MHz"), ("boost_clock", "Boost clock", "MHz"), ("memory", "Memory", None),
         ("memory_type", "Memory type", None), ("memory_bus", "Memory bus", "bit"), ("memory_clock", "Memory clock", "MHz"),
         ("bandwidth", "Bandwidth", "GB/s"), ("shaders", "Shading units", None), ("tmus", "TMUs", None), ("rops", "ROPs", None),
         ("sms", "SM / CU count", None), ("tensor_cores", "Tensor cores", None), ("rt_cores", "RT cores", None),
         ("l1_kb", "L1 cache", "KB"), ("l2_mb", "L2 cache", "MB"), ("fp32", "FP32 performance", "GFLOPS"),
         ("fp16", "FP16 performance", "GFLOPS"), ("fp64", "FP64 performance", "GFLOPS"), ("pixel_rate", "Pixel rate", "GPixel/s"),
         ("texture_rate", "Texture rate", "GTexel/s"), ("tdp", "TDP", "W"), ("psu", "Suggested PSU", "W"),
         ("power_connectors", "Power connectors", None), ("outputs", "Outputs", None), ("slots", "Slot width", None),
         ("length_mm", "Board length", "mm"), ("directx", "DirectX", None), ("opengl", "OpenGL", None), ("vulkan", "Vulkan", None),
         ("opencl", "OpenCL", None), ("cuda", "CUDA", None), ("shader_model", "Shader model", None)],
        ["maker", "year", "generation", "architecture", "memory_type"], items, [SRC_TPU],
    )
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
        time.sleep(0.2)
    return out


def build_wikidata_cpus():
    """Processors on Wikidata: anything that has a number of cores, or is a microprocessor model."""
    qids = set()
    queries = {
        "has core count": "SELECT DISTINCT ?i WHERE { ?i wdt:P1141 ?c . }",
        "microprocessor subclass": "SELECT DISTINCT ?i WHERE { ?i wdt:P31/wdt:P279* wd:Q5297 . }",
        "CPU subclass": "SELECT DISTINCT ?i WHERE { ?i wdt:P31/wdt:P279* wd:Q5300 . }",
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
def pcpp(t):
    try:
        return json.loads(get(PCPP.format(t)))
    except Exception as e:  # noqa: BLE001
        log(f"pcpp {t} failed: {e}")
        return []


def rng(v, unit="", scale=1):
    if isinstance(v, list) and len(v) == 2:
        a, b = v
        return f"{num(a * scale)}–{num(b * scale)}{(' ' + unit) if unit else ''}"
    return None if v is None else f"{num(v)}{(' ' + unit) if unit else ''}"


def mk(name, extra):
    it = {"id": slug(name), "name": name, "maker": brand(name)}
    it.update({k: v for k, v in extra.items() if v not in (None, "", [], "None")})
    return it


ARCH_YEAR = {"K10": 2007, "Skylake": 2015, "Haswell": 2013, "Sandy Bridge": 2011, "Piledriver": 2012, "Ivy Bridge": 2012,
             "Kaby Lake": 2017, "Core": 2006, "Coffee Lake": 2017, "Coffee Lake Refresh": 2018, "Haswell Refresh": 2014,
             "Wolfdale": 2008, "Comet Lake": 2020, "Broadwell": 2015, "Yorkfield": 2008, "Steamroller": 2014, "Zen 4": 2022,
             "Lynx": 2011, "Zen 2": 2019, "Zen": 2017, "Nehalem": 2008, "Zen+": 2018, "Bulldozer": 2011, "Zen 3": 2020,
             "Raptor Lake": 2022, "Alder Lake": 2021, "Raptor Lake Refresh": 2023, "Westmere": 2010, "Rocket Lake": 2021,
             "Excavator": 2015, "Arrow Lake": 2024, "Jaguar": 2013, "Zen 5": 2024, "Cascade Lake": 2019, "Puma+": 2014}


def build_cpus(wd_items):
    rows = pcpp("cpu")
    items = []
    seen = set()
    for r in rows:
        it = mk(r["name"], {
            "microarchitecture": r.get("microarchitecture"), "cores": r.get("core_count"),
            "base_clock": r.get("core_clock"), "boost_clock": r.get("boost_clock"), "tdp": r.get("tdp"),
            "graphics": r.get("graphics"), "year": ARCH_YEAR.get(r.get("microarchitecture") or ""),
        })
        if it.get("year"):
            it["year_note"] = "approx. (from architecture)"
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
        items.append(w)
        added += 1
    log(f"CPUs: {len(rows)} from PCPartPicker + {added} more from Wikidata")
    category(
        "cpu", "Processors (CPUs)", "hardware",
        "Desktop, laptop and server processors, from early chips to the newest releases.",
        [("microarchitecture", "Microarchitecture", None), ("date", "Release date", None), ("cores", "Cores", None),
         ("base_clock", "Base clock", "GHz"), ("boost_clock", "Boost clock", "GHz"), ("tdp", "TDP", "W"),
         ("graphics", "Integrated graphics", None)],
        ["maker", "year", "microarchitecture"], items, [SRC_PCPP, SRC_WD],
        note="Release years marked approx. come from the chip's architecture.",
    )


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
        items.append(mk(r["name"], {
            "chipset": chip, "memory": f"{num(r['memory'])} GB" if r.get("memory") else None,
            "core_clock": r.get("core_clock"), "boost_clock": r.get("boost_clock"), "length_mm": r.get("length"),
            "color": r.get("color"), "year": g.get("year") if g else None, "date": g.get("date") if g else None,
            "chip_id": g["id"] if g else None,
        }))
    category("graphics-card", "Graphics cards", "hardware",
             "Retail graphics cards from MSI, Asus, Gigabyte, Sapphire and every other board partner.",
             [("chipset", "GPU", None), ("memory", "Memory", None), ("core_clock", "Core clock", "MHz"),
              ("boost_clock", "Boost clock", "MHz"), ("length_mm", "Length", "mm"), ("color", "Color", None)],
             ["maker", "year", "chipset"], items, [SRC_PCPP, SRC_TPU])

    rows = pcpp("motherboard")
    category("motherboard", "Motherboards", "hardware", "Motherboards for every socket and form factor.",
             [("socket", "Socket", None), ("form_factor", "Form factor", None), ("memory_slots", "Memory slots", None),
              ("max_memory", "Max memory", "GB"), ("color", "Color", None)],
             ["maker", "socket", "form_factor"],
             [mk(r["name"], {k: r.get(k) for k in ("socket", "form_factor", "memory_slots", "max_memory", "color")}) for r in rows],
             [SRC_PCPP])

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
        if r.get("type") == "SSD":
            ssd.append(it)
        else:
            if r.get("type") and str(r.get("type")).isdigit():
                it["rpm"] = int(r["type"])
            hdd.append(it)
    flds = [("capacity", "Capacity", None), ("form_factor", "Form factor", None), ("interface", "Interface", None), ("cache", "Cache", None)]
    category("ssd", "SSDs", "hardware", "Solid state drives: NVMe, SATA, M.2 and more.", flds, ["maker", "interface", "form_factor"], ssd, [SRC_PCPP])
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
            items.append(mk(r["name"], ex))
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
                    out[f[:-5]] = json.load(open(os.path.join(EXTRA, f), encoding="utf-8")).get("items", [])
                except Exception as e:  # noqa: BLE001
                    log(f"bad extra file {f}: {e}")
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    gpu_by_norm = build_gpus()
    try:
        wd = [] if os.environ.get("SKIP_WIKIDATA") else build_wikidata_cpus()
    except Exception as e:  # noqa: BLE001
        log(f"Wikidata failed, CPUs from PCPartPicker only: {e}")
        wd = []
    build_cpus(wd)
    build_pcpp_categories(gpu_by_norm)
    extra = load_extra()
    have = {c["id"] for c in CATEGORIES}
    for cid, name, group, desc in EXTRA_CATEGORIES:
        if cid not in have:
            category(cid, name, group, desc, [], ["maker", "year"], [], [SRC_EXTRA],
                     note="New category: items are added as they appear in the news.")
    for c in CATEGORIES:
        add = extra.get(c["id"], [])
        if add:
            ids = {i["id"] for i in c["items"]}
            c["items"].extend(i for i in add if i.get("id") and i["id"] not in ids)
            if SRC_EXTRA not in c["sources"]:
                c["sources"].append(SRC_EXTRA)

    today = dt.date.today().isoformat()
    index = {"version": today, "updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "categories": []}
    for c in CATEGORIES:
        c["items"].sort(key=lambda i: (-(i.get("year") or 0), i["name"].lower()))
        # Make ids unique inside a category.
        seen: dict[str, int] = {}
        for i in c["items"]:
            n = seen.get(i["id"], 0)
            seen[i["id"]] = n + 1
            if n:
                i["id"] = f"{i['id']}-{n + 1}"
        body = json.dumps({k: c[k] for k in ("id", "name", "group", "description", "fields", "filters", "sources", "note", "items")},
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


if __name__ == "__main__":
    main()
