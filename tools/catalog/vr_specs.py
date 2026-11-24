"""Hand-entered VR headset specifications (manufacturer spec sheets), merged with the
Steam Hardware Survey names. Keys: survey name. Leave out anything not certain."""

F = ["type", "display", "resolution_per_eye", "refresh_rate", "fov", "lenses", "tracking", "connection",
     "processor", "eye_tracking", "weight_g", "launch_price_usd"]
FIELDS = [
    ("type", "Type", None), ("display", "Display", None), ("resolution_per_eye", "Resolution per eye", None),
    ("refresh_rate", "Max refresh rate", "Hz"), ("fov", "Field of view", "°"), ("lenses", "Lenses", None),
    ("tracking", "Tracking", None), ("connection", "PC connection", None), ("processor", "Standalone chip", None),
    ("eye_tracking", "Eye tracking", None), ("weight_g", "Weight", "g"), ("launch_price_usd", "Launch price", "USD"),
    ("notes", "Notes", None),
]

def h(year, type_, display, res, hz, fov, lenses, tracking, conn, chip=None, eye=None, g=None, usd=None, notes=None):
    return {"year": year, "type": type_, "display": display, "resolution_per_eye": res, "refresh_rate": hz, "fov": fov,
            "lenses": lenses, "tracking": tracking, "connection": conn, "processor": chip, "eye_tracking": eye,
            "weight_g": g, "launch_price_usd": usd, "notes": notes}

IO = "Inside-out (headset cameras)"
LH = "Outside-in (SteamVR base stations)"
SPECS = {
    "Oculus Rift DK1": h(2013, "PC VR (developer kit)", "LCD", "640 × 800", 60, 110, "Aspheric", "Rotation only (3DoF)", "DVI/HDMI + USB", g=380, usd=300),
    "Oculus Rift DK2": h(2014, "PC VR (developer kit)", "OLED", "960 × 1080", 75, 100, "Aspheric", "Outside-in (IR camera)", "HDMI + USB", g=440, usd=350),
    "Oculus Rift": h(2016, "PC VR", "OLED", "1080 × 1200", 90, 110, "Hybrid Fresnel", "Outside-in (Constellation cameras)", "HDMI + USB 3.0", g=470, usd=599),
    "Oculus Rift S": h(2019, "PC VR", "LCD", "1280 × 1440", 80, 115, "Fresnel", IO + ", 5 cameras", "DisplayPort + USB 3.0", g=500, usd=399),
    "Oculus Quest": h(2019, "Standalone + PC (Link)", "OLED", "1440 × 1600", 72, 100, "Fresnel", IO + ", 4 cameras", "USB-C (Link) or Wi-Fi (Air Link)", "Snapdragon 835", g=571, usd=399),
    "Oculus Quest 2": h(2020, "Standalone + PC (Link)", "LCD", "1832 × 1920", 120, 97, "Fresnel", IO + ", 4 cameras", "USB-C (Link) or Wi-Fi (Air Link)", "Snapdragon XR2", g=503, usd=299),
    "Meta Quest Pro": h(2022, "Standalone + PC (Link)", "LCD with mini-LED local dimming", "1800 × 1920", 90, 106, "Pancake", IO + ", color passthrough", "USB-C (Link) or Wi-Fi (Air Link)", "Snapdragon XR2+", "Yes (and face tracking)", 722, 1499),
    "Meta Quest 3": h(2023, "Standalone + PC (Link)", "LCD", "2064 × 2208", 120, 110, "Pancake", IO + ", color passthrough", "USB-C (Link) or Wi-Fi (Air Link)", "Snapdragon XR2 Gen 2", "No", 515, 499),
    "Meta Quest 3S": h(2024, "Standalone + PC (Link)", "LCD", "1832 × 1920", 120, 96, "Fresnel", IO + ", color passthrough", "USB-C (Link) or Wi-Fi (Air Link)", "Snapdragon XR2 Gen 2", "No", 514, 299),
    "HTC Vive": h(2016, "PC VR", "OLED", "1080 × 1200", 90, 110, "Fresnel", LH + " 1.0", "HDMI + USB", g=555, usd=799),
    "HTC Vive Pro": h(2018, "PC VR", "AMOLED", "1440 × 1600", 90, 110, "Fresnel", LH + " 1.0 / 2.0", "DisplayPort + USB 3.0", g=555, usd=799, notes="Price for the headset alone"),
    "HTC Vive Pro 2": h(2021, "PC VR", "LCD", "2448 × 2448", 120, 120, "Dual-stack", LH + " 1.0 / 2.0", "DisplayPort 1.2 + USB 3.0", g=850, usd=799, notes="Price for the headset alone"),
    "HTC Vive Cosmos": h(2019, "PC VR", "LCD", "1440 × 1700", 90, 110, "Fresnel", IO + ", 6 cameras", "DisplayPort + USB 3.0", g=702, usd=699),
    "HTC Vive Focus Vision": h(2024, "Standalone + PC (DisplayPort mode)", "LCD", "2448 × 2448", 120, 120, "Fresnel", IO + ", color passthrough", "DisplayPort mode or Wi-Fi streaming", "Snapdragon XR2", "Yes", 785, 999),
    "HTC VIVE XR Elite": h(2023, "Standalone + PC streaming", "LCD", "1920 × 1920", 90, 110, "Pancake", IO + ", color passthrough", "USB-C or Wi-Fi streaming", "Snapdragon XR2", "Add-on", 625, 1099),
    "Valve Index HMD": h(2019, "PC VR", "LCD", "1440 × 1600", 144, 130, "Dual-element, canted", LH + " 1.0 / 2.0", "DisplayPort 1.2 + USB 3.0", g=809, usd=999, notes="$999 full kit, $499 headset alone"),
    "Valve Steam Frame": h(2026, "Standalone + PC streaming", "LCD", "2160 × 2160", 144, 110, "Pancake", IO + ", monochrome passthrough", "Wireless streaming via the included USB dongle", "Snapdragon 8 Gen 3", "Yes (foveated streaming)", notes="Announced November 2025"),
    "Bigscreen Beyond": h(2023, "PC VR", "Micro-OLED", "2560 × 2560", 90, 102, "Pancake", LH + " 1.0 / 2.0", "DisplayPort + USB 3.0", g=127, usd=999, notes="Custom-fitted to each buyer's face scan"),
    "Pico 4": h(2022, "Standalone + PC streaming", "LCD", "2160 × 2160", 90, 105, "Pancake", IO + ", color passthrough", "Wi-Fi streaming or USB-C", "Snapdragon XR2", g=586, notes="Not sold in the US; €429 at launch"),
    "Pico Neo 3": h(2021, "Standalone + PC streaming", "LCD", "1832 × 1920", 90, 98, "Fresnel", IO + ", 4 cameras", "Wi-Fi streaming or DisplayPort (Link version)", "Snapdragon XR2", g=620),
    "Pico Neo 2": h(2019, "Standalone + PC streaming", "LCD", "1920 × 2160", 75, 101, "Fresnel", "Inside-out (headset) + electromagnetic controllers", "Wi-Fi streaming", "Snapdragon 845", g=690),
    "Pimax 5K Plus": h(2018, "PC VR (wide field of view)", "LCD", "2560 × 1440", 144, 200, "Fresnel", LH, "DisplayPort + USB", g=470),
    "Pimax 8K": h(2018, "PC VR (wide field of view)", "LCD", "3840 × 2160", 80, 200, "Fresnel", LH, "DisplayPort + USB", notes="Panels are 4K; the PC sends 2560 × 1440 per eye and the headset upscales"),
    "Pimax Artisan": h(2020, "PC VR (wide field of view)", "LCD", "1700 × 1440", 144, 140, "Fresnel", LH, "DisplayPort + USB"),
    "Pimax HMD": {"type": "PC VR", "notes": "Steam groups several Pimax headsets under this name"},
    "Sony PlayStation VR": h(2016, "Console VR (PS4); PC only through third-party drivers", "OLED", "960 × 1080", 120, 100, "Aspheric", "Outside-in (PlayStation Camera)", "HDMI via processor unit", g=610, usd=399),
    "Sony PS VR2": h(2023, "Console VR (PS5); PC through Sony's adapter since 2024", "OLED (HDR)", "2000 × 2040", 120, 110, "Fresnel", IO + ", 4 cameras", "USB-C on PS5, DisplayPort through the PC adapter", None, "Yes", 560, 549),
    "Varjo Aero": h(2021, "PC VR (professional)", "LCD with mini-LED backlight", "2880 × 2720", 90, 115, "Aspheric", LH + " 1.0 / 2.0", "DisplayPort + USB-C", None, "Yes", 717, 1990),
    "Windows Mixed Reality": {"type": "PC VR (platform)", "tracking": IO + ", 2 cameras", "connection": "HDMI or DisplayPort + USB 3.0",
                              "notes": "Headsets from Acer, Dell, HP, Lenovo and Samsung share this platform; most are 1440 × 1440 per eye at 90 Hz. Microsoft removed WMR from Windows 11 24H2."},
    "Huawei VR2": h(2017, "PC VR", "LCD", "1440 × 1600", 90, 110, "Fresnel", "Rotation only (3DoF)", "DisplayPort + USB"),
    "DPVR E4": {"year": 2022, "type": "PC VR", "notes": "Full specifications not confirmed yet"},
    "ALVR": {"type": "Streaming app (not a headset)", "notes": "Free app that streams SteamVR to a standalone headset over Wi-Fi"},
    "Riftcat Vridge": {"type": "Streaming app (not a headset)", "notes": "Turns a phone into a PC VR headset"},
    "iVRy": {"type": "Streaming app (not a headset)", "notes": "Phone VR driver for SteamVR"},
    "Iriun VR": {"type": "Streaming app (not a headset)", "notes": "Phone VR app for SteamVR"},
}
# Survey spellings that are the same headset.
ALIASES = {"HTC VIVE Focus Vision": "HTC Vive Focus Vision", "Pico Neo2": "Pico Neo 2", "Valve Index": "Valve Index HMD"}
# Survey rows that aren't headsets.
SKIP = {"Total", "Unknown", "Steam users with VR Headsets", "HTC Vive Elite"}
