import { useState, useEffect } from "react";

const DATA = [
  {
    page: "Electronics \u7535\u5b50\u96f6\u4ef6",
    sections: [
      {
        title: "CONTROLLERS \u63a7\u5236\u5668",
        items: [
          { en: "ESP32-S3", zh: "ESP32-S3 \u5f00\u53d1\u677f", qty: "x5", tip: "Look for ESP32-S3-WROOM-1 or DevKitC. Must say S3. USB-C preferred. N16R8 variant best (16MB flash + 8MB PSRAM)." },
          { en: "Teensy 4.1", zh: "Teensy 4.1 \u5f00\u53d1\u677f", qty: "x3", tip: "Must say 4.1, not 4.0. Has built-in micro SD slot. Made by PJRC. Around $30-35 each." },
          { en: "Raspberry Pi 5 8GB", zh: "\u6811\u83932\u6d3e5 8GB", qty: "x1", tip: "Must be 8GB version. Check box says 8GB. Need USB-C 27W power supply if not included." },
          { en: "Raspberry Pi Pico W", zh: "\u6811\u83932\u6d3e Pico W", qty: "x3", tip: "Must say Pico W (with wifi). Not regular Pico. Very small green board. Around $6 each." },
          { en: "Pre-flashed WLED ESP32", zh: "\u9884\u88c5WLED\u7684ESP32 LED\u63a7\u5236\u5668", qty: "x3", tip: "BTF-LIGHTING or similar. Should say WLED. Has screw terminals. Plug and play, no coding." },
          { en: "SP108E WiFi LED controller", zh: "SP108E WiFi LED\u63a7\u5236\u5668", qty: "x3", tip: "Small white box, app controlled. Supports WS2812B, SK6812, WS2811. Around $5-8 each." },
        ],
      },
      {
        title: "SENSORS / TRIGGERS \u4f20\u611f\u5668/\u89e6\u53d1\u5668",
        items: [
          { en: "INMP441 I2S microphone", zh: "INMP441 \u6570\u5b57\u9ea6\u514b\u98ce\u6a21\u5757", qty: "x4", tip: "Tiny purple/blue board. Must say INMP441 or I2S. NOT analog mic. Pins: WS, SCK, SD, L/R, VDD, GND." },
          { en: "VL53L0X distance sensor", zh: "VL53L0X \u6fc0\u5149\u6d4b\u8ddd\u4f20\u611f\u5668", qty: "x3", tip: "Small purple board with tiny silver square. Laser time-of-flight. Measures up to 2m. I2C pins." },
          { en: "TTP223 capacitive touch", zh: "TTP223 \u7535\u5bb9\u89e6\u6478\u6a21\u5757", qty: "x5", tip: "Tiny blue board, fingernail size. 3 pins: VCC, I/O, GND. Around $1 each. May be sold in packs." },
          { en: "Rotary encoder with button", zh: "\u65cb\u8f6c\u7f16\u7801\u5668 \u5e26\u6309\u94ae (KY-040)", qty: "x3", tip: "KY-040 module. Knob that turns and pushes. 5 pins: CLK, DT, SW, +, GND." },
        ],
      },
      {
        title: "SIGNAL \u4fe1\u53f7\u8f6c\u6362",
        items: [
          { en: "SN74HCT245 level shifter", zh: "SN74HCT245 \u7535\u5e73\u8f6c\u6362\u82af\u7247", qty: "x10", tip: "Bare DIP chip or breakout board. Breakout easier. Converts 3.3V to 5V. Also called logic level converter 8ch." },
          { en: "SD card breakout module", zh: "SD\u5361\u6a21\u5757 (SPI\u63a5\u53e3)", qty: "x3", tip: "Small board with micro SD slot. SPI pins: MISO, MOSI, SCK, CS, VCC, GND. Around $2 each." },
          { en: "Micro SD cards 32GB", zh: "32GB Micro SD\u5361", qty: "x3", tip: "Any brand. Class 10 or faster. SanDisk or Samsung reliable." },
        ],
      },
      {
        title: "CONNECTORS \u8fde\u63a5\u5668",
        items: [
          { en: "JST-SM 3-pin pairs", zh: "JST-SM 3\u9488 \u516c\u6bcd\u8fde\u63a5\u7ebf", qty: "x20 pairs", tip: "Pre-wired male + female, 10-15cm wire. 3 pin for RGB strips (WS2812B). Standard LED strip plug." },
          { en: "JST-SM 4-pin pairs", zh: "JST-SM 4\u9488 \u516c\u6bcd\u8fde\u63a5\u7ebf", qty: "x10 pairs", tip: "Same but 4 pin for RGBW strips (SK6812). Fourth wire is white channel." },
          { en: "Wago 221 lever nuts", zh: "Wago 221 \u5feb\u901f\u63a5\u7ebf\u7aef\u5b50", qty: "x20 mixed", tip: "Orange lever, clear body. Get 3-way (221-413) and 5-way (221-415). Look for genuine Wago." },
          { en: "470 ohm resistors", zh: "470\u6b27\u59c6\u7535\u963b", qty: "x20", tip: "Standard through-hole. Color bands: yellow, violet, brown, gold. Very cheap, sold in packs." },
          { en: "1000uF capacitors", zh: "1000\u5fae\u6cd5\u7535\u89e3\u7535\u5bb9", qty: "x10", tip: "Electrolytic, small cylinder. Voltage 6.3V or higher (16V/25V fine). Longer leg is positive." },
        ],
      },
    ],
  },
  {
    page: "Supplements \u4fdd\u5065\u54c1",
    sections: [
      {
        title: "SUPPLEMENTS \u4fdd\u5065\u54c1 (GNC/Costco/\u836f\u5c40)",
        items: [
          { en: "Magnesium L-Threonate", zh: "L-\u82cf\u7cd6\u9178\u9541", qty: "1 bottle (90 caps)", tip: "Look for 'Magtein' on label. NOT glycinate, citrate, or oxide. Dose: 2000mg daily (3 caps). Take at night." },
          { en: "NAC 600mg", zh: "N-\u4e59\u9170\u534a\u80f1\u6c28\u9178 600mg", qty: "1 bottle (90-120 caps)", tip: "Must be CAPSULES not tablets. NOW Foods or Jarrow good. Full name: N-Acetyl Cysteine. Take evening." },
          { en: "Astaxanthin 12mg", zh: "\u867e\u9752\u7d20 12mg (\u5929\u7136\u85fb\u7c7b\u6765\u6e90)", qty: "1 bottle (60 softgels)", tip: "Must say 'Haematococcus pluvialis' or 'natural'. NOT synthetic. Red/dark softgels. Take with fat in morning." },
          { en: "P5P 50mg (active B6)", zh: "\u6d3b\u6027\u7ef4\u751f\u7d20B6 P5P 50mg", qty: "1 bottle (100 caps)", tip: "Label must say P-5-P or Pyridoxal-5-Phosphate. Do NOT get Pyridoxine HCl (cheap inactive form)." },
          { en: "Glycine powder", zh: "\u7518\u6c28\u9178\u7c89 (\u7eaf\u7c89\u672b)", qty: "250-500g", tip: "Pure powder, no fillers/flavoring. Slightly sweet taste. Dose 3-5g at night. Ingredients should only say 'glycine'." },
        ],
      },
      {
        title: "TCM \u4e2d\u836f (\u4e2d\u836f\u884c)",
        items: [
          { en: "Tian Wang Bu Xin Dan", zh: "\u5929\u738b\u8865\u5fc3\u4e39", qty: "1 box", tip: "Pills (\u4e38) or concentrated pills (\u6d53\u7f29\u4e38). Brands: \u987a\u5929\u5802 Sun Ten or \u4ed9\u4e30 are high quality. Follow box dosage." },
          { en: "Jin Qian Cao tea packets", zh: "\u91d1\u94b1\u8349\u8336\u5305", qty: "2-3 boxes", tip: "Prepared tea bags most convenient. For kidney stone prevention. Brew 1-2 bags daily. Light and flat." },
          { en: "Suan Zao Ren", zh: "\u9178\u67a3\u4ec1", qty: "1 bag", tip: "Powder (\u7c89) or packets. 3-5g before bed in warm water. Roasted version (\u7092\u9178\u67a3\u4ec1) better for sleep than raw." },
        ],
      },
    ],
  },
];

interface CheckedState {
  [key: string]: boolean;
}

interface ExpandedState {
  [key: string]: boolean;
}

const STORAGE_KEY = "checklist-state";

export default function Shopping() {
  const [checked, setChecked] = useState<CheckedState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setChecked(JSON.parse(saved));
    } catch (e) {}
  }, []);

  const save = (newState: CheckedState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {}
  };

  const toggle = (key: string) => {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    save(next);
  };

  const toggleTip = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetAll = () => {
    setChecked({});
    save({});
  };

  let totalItems = 0;
  let checkedItems = 0;
  DATA.forEach((p) =>
    p.sections.forEach((s) =>
      s.items.forEach((item) => {
        totalItems++;
        if (checked[item.en]) checkedItems++;
      })
    )
  );

  return (
    <div style={{ background: "#111", color: "#e8e8e8", minHeight: "100vh", padding: "12px", paddingBottom: "80px", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ fontSize: "20px", fontWeight: "700", color: "#fff" }}>Shopping List</div>
      <div style={{ fontSize: "13px", color: "#888", marginBottom: "16px" }}>采购清单 / Guanghua + Dongmen + GNC</div>

      {DATA.map((page) => (
        <div key={page.page}>
          <div style={{ marginTop: "20px", fontSize: "18px", fontWeight: "700", color: "#fff", borderBottom: "2px solid #f0a050", paddingBottom: "6px", marginBottom: "8px" }}>
            {page.page}
          </div>
          {page.sections.map((section) => (
            <div key={section.title} style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#f0a050", borderBottom: "1px solid #333", paddingBottom: "4px", marginBottom: "6px" }}>
                {section.title}
              </div>
              {section.items.map((item) => {
                const key = item.en;
                const isChecked = !!checked[key];
                const isExpanded = !!expanded[key];
                return (
                  <div key={key} style={{ paddingBottom: "8px", marginBottom: "8px", borderBottom: "1px solid #222", opacity: isChecked ? 0.35 : 1 }}>
                    <div
                      onClick={() => toggle(key)}
                      style={{ display: "flex", alignItems: "flex-start", cursor: "pointer", WebkitUserSelect: "none", userSelect: "none" }}
                    >
                      <div
                        style={{
                          width: "28px", height: "28px", minWidth: "28px",
                          border: isChecked ? "2px solid #f0a050" : "2px solid #555",
                          borderRadius: "4px", marginRight: "12px", marginTop: "1px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: isChecked ? "#f0a050" : "transparent",
                          fontSize: "16px", fontWeight: "700", color: "#111",
                        }}
                      >
                        {isChecked ? "\u2713" : ""}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "15px", fontWeight: "600", lineHeight: "1.3" }}>{item.en}</div>
                        <div style={{ fontSize: "24px", color: "#fff", lineHeight: "1.3", marginTop: "4px", fontWeight: "500" }}>{item.zh}</div>
                        <div style={{ fontSize: "13px", color: "#f0a050", marginTop: "3px", fontWeight: "600" }}>{item.qty}</div>
                      </div>
                    </div>
                    <div
                      onClick={() => toggleTip(key)}
                      style={{ marginLeft: "40px", marginTop: "6px", fontSize: "12px", color: "#f0a050", cursor: "pointer", WebkitUserSelect: "none", userSelect: "none" }}
                    >
                      {isExpanded ? "hide tip \u25b2" : "buying tip \u25bc"}
                    </div>
                    {isExpanded && (
                      <div style={{ marginLeft: "40px", marginTop: "4px", fontSize: "13px", color: "#ccc", lineHeight: "1.5", padding: "8px", background: "#1a1a1a", borderRadius: "6px", borderLeft: "2px solid #f0a050" }}>
                        {item.tip}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#1a1a1a", borderTop: "1px solid #333", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
        <div style={{ fontSize: "14px", color: "#888" }}>
          <span style={{ color: "#f0a050", fontWeight: "700" }}>{checkedItems}</span> / {totalItems}
        </div>
        <button onClick={resetAll} style={{ fontSize: "12px", color: "#666", background: "none", border: "1px solid #444", padding: "4px 10px", borderRadius: "4px", cursor: "pointer" }}>
          Reset
        </button>
      </div>
    </div>
  );
}
