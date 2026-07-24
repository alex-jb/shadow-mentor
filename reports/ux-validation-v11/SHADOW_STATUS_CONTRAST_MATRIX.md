# Semantic status contrast matrix

Formula: WCAG 2.x relative luminance over linearised sRGB — `(max(L)+0.05)/(min(L)+0.05)`.
Surfaces are the profile's own tokens. Where the capture rig clears to a different colour, the
value is tested against **both**. No pixel sampling; no PNG comparison.

**266 combinations · 0 failures · lowest ratio anywhere 4.65.**

## Floors

| profile | surface | capture surface | text floor | non-text floor |
|---|---|---|---|---|
| `AccessibilityHighContrast` | `#000000` | `#000000` | 7 | 3 |
| `BrowserDark` | `#090D12` | `—` | 4.5 | 3 |
| `DesktopDark` | `#090D12` | `#0B0F16` | 4.5 | 3 |
| `ProjectorPresentation` | `#05080B` | `—` | 4.5 | 3 |
| `XrealOstBright` | `#F4F6F8` | `#C7CCD4` | 4.5 | 3 |

## Family renditions and their worst-case ratio per profile

| family | `AccessibilityHighContrast` | `BrowserDark` | `DesktopDark` | `ProjectorPresentation` | `XrealOstBright` |
|---|---|---|---|---|---|
| `failure_red` | `#ff6180` **7.27** (≥7) | `#ef4444` **5.18** (≥4.5) | `#ef4444` **5.1** (≥4.5) | `#FF6B78` **7.29** (≥4.5) | `#a12126` **4.71** (≥4.5) |
| `info_blue` | `#40C4FF` **10.56** (≥7) | `#3b82f6` **5.3** (≥4.5) | `#3b82f6` **5.22** (≥4.5) | `#6FB4FF` **9.22** (≥4.5) | `#1254a0` **4.65** (≥4.5) |
| `neutral_unknown` | `#BDBDBD` **11.18** (≥7) | `#8a92a0` **6.22** (≥4.5) | `#8a92a0` **6.12** (≥4.5) | `#AEB8C2` **9.98** (≥4.5) | `#4b545d` **4.78** (≥4.5) |
| `review_grey` | `#8e9bad` **7.44** (≥7) | `#b6bec9` **10.39** (≥4.5) | `#b6bec9` **10.23** (≥4.5) | `#eaeff4` **17.35** (≥4.5) | `#2a2f38` **8.33** (≥4.5) |
| `verification_green` | `#00E676` **12.58** (≥7) | `#4ade80` **11.18** (≥4.5) | `#4ade80` **11.01** (≥4.5) | `#34E0A6` **11.82** (≥4.5) | `#085e3f` **4.85** (≥4.5) |
| `warning_amber` | `#FFD600` **14.87** (≥7) | `#fbbf24` **11.67** (≥4.5) | `#fbbf24` **11.5** (≥4.5) | `#FFD166` **13.92** (≥4.5) | `#754c00` **4.67** (≥4.5) |

## Disclaimer — `SIMULATED — NOT DEVICE VALIDATED`

| profile | colour | surface | ratio | required |
|---|---|---|---|---|
| `AccessibilityHighContrast` | `#ff9d9d` | `#000000` (token_surface) | **10.56** | 4.5 |
| `BrowserDark` | `#ff8a8a` | `#090D12` (token_surface) | **8.59** | 4.5 |
| `DesktopDark` | `#ff8a8a` | `#090D12` (token_surface) | **8.59** | 4.5 |
| `DesktopDark` | `#ff8a8a` | `#0B0F16` (capture_surface) | **8.46** | 4.5 |
| `ProjectorPresentation` | `#ff9d9d` | `#05080B` (token_surface) | **10.1** | 4.5 |
| `XrealOstBright` | `#8f1020` | `#F4F6F8` (token_surface) | **8.57** | 4.5 |
| `XrealOstBright` | `#8f1020` | `#C7CCD4` (capture_surface) | **5.75** | 4.5 |

## The four originally-reported P0 failures

| token | before (on `#C7CCD4`) | after | surface |
|---|---|---|---|
| `status.VERIFIED` | 1.08 | **4.85** (`#085e3f`) | `#C7CCD4` |
| `status.NOT_CHECKED` | 1.03 | **4.67** (`#754c00`) | `#C7CCD4` |
| `status.NOT_PRESENT` | 1.94 | **4.78** (`#4b545d`) | `#C7CCD4` |
| `status.FIRST_FAILURE` | 2.33 | **4.71** (`#a12126`) | `#C7CCD4` |

Machine-readable: `shadow-status-contrast-matrix.json` (every row carries foreground, background,
both luminances, the ratio, the threshold and the verdict).
