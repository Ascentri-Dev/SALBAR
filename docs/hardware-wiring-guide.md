# T-Beam Hardware Wiring Guide (OLED + 4 Buttons)

Step-by-step guide for wiring the SALBAR field terminal (TTGO T-Beam, `SAR-01`) to an SSD1306 OLED and the 4 triage buttons on a full-size breadboard, then running the Increment 1 tests.

The breadboard is a full-size 830-point board: columns 1 to 63, rows a to e (top half) and f to j (bottom half), with +/- power rails along the top and bottom edges.

## 0. Parts

- T-Beam with the 915 MHz LoRa antenna, GPS patch antenna, and 3.7 V cell
- Full-size (long) breadboard
- SSD1306 I2C OLED module (4 pins)
- 4 tactile push buttons (6 mm, 4 legs)
- About 6 female-to-male jumper wires (T-Beam header to breadboard)
- About 6 short male-to-male jumper wires
- USB cable

Before you start:

- The T-Beam stays **off the breadboard**. It is too wide; it sits beside the board and connects with jumpers.
- Check that the T-Beam has header pins soldered on. Some v1.2 boards ship with loose pins. If yours has bare holes, solder the pins first.
- Do all wiring with the T-Beam **switched off and USB unplugged**.

## 1. Layout

```
 TOP RAIL    (+) red  = 3V3   ─────────────────────────────────────
             (-) blue = GND   ─────────────────────────────────────
 row a       . . . . . . . . . . . . . . . . . . . . . . . . . . .
 row b-d     OLED jumpers       (cols 3-6)
 row e       [OLED pins 3-6]    B1 20|22   B2 28|30   B3 36|38   B4 44|46
             ═══════════════════ center gap ═══════════════════════
 row f       buttons straddle the gap (legs in rows e and f)
 row g-j     GPIO jumpers land here (cols 22, 30, 38, 46)
 BOTTOM RAIL (unused)
```

## 2. Power rails

1. Jumper from T-Beam **GND** to the top **blue (-)** rail.
2. Jumper from T-Beam **3V3** to the top **red (+)** rail.
3. Many long breadboards split each rail in the middle (around column 30, where the colored line has a gap). If yours does, add a short jumper across the gap on both the red and blue lines so each rail is continuous.

Never connect **5V** or **VBAT** to the rails.

## 3. OLED (columns 3 to 6)

1. Read the pin labels printed on your OLED. The common order is `GND VCC SCL SDA`, but some modules swap GND and VCC. Swapping them can destroy the module.
2. Insert the OLED's 4 pins into **e3, e4, e5, e6**, screen facing you, module over rows a to d. Holes a to e in each column are connected to that pin.
3. Add the jumpers (shown for `GND VCC SCL SDA`; adjust to your labels):

| OLED pin | Column | Jumper from | To |
| :--- | :--- | :--- | :--- |
| GND | 3 | c3 | top blue (-) rail |
| VCC | 4 | c4 | top red (+) rail (3V3) |
| SCL | 5 | c5 | T-Beam **GPIO 22** |
| SDA | 6 | c6 | T-Beam **GPIO 21** |

If the OLED body covers rows a to d, insert the jumpers before seating the OLED.

Notes:

- The firmware drives an SSD1306 at I2C address `0x3C` (Adafruit SSD1306 library).
- Many 1.3-inch OLEDs use an **SH1106** chip instead. If the screen shows garbage or is shifted by 2 pixels, the firmware needs the SH1106 driver.
- GPIO 21/22 is shared with the power management chip (PMU). This is normal for I2C.

## 4. Buttons (straddle the center gap)

Place each button with 2 legs in row **e** and 2 legs in row **f**, straddling the center gap.

| Button | Function | Legs in columns | GND jumper | GPIO jumper |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Up / open menu | 20 and 22 | a20 to blue (-) rail | i22 to T-Beam **GPIO 13** |
| 2 | Down | 28 and 30 | a28 to blue (-) rail | i30 to T-Beam **GPIO 14** |
| 3 | Select / Send | 36 and 38 | a36 to blue (-) rail | i38 to T-Beam **GPIO 15** |
| 4 | Back | 44 and 46 | a44 to blue (-) rail | i46 to T-Beam **GPIO 25** |

Each button is wired **diagonally**: GND on the top-left column, GPIO on the bottom-right column. Diagonal legs are always on opposite sides of the switch, so the button works no matter how it is rotated.

No resistors are needed. The firmware uses internal pull-ups (`INPUT_PULLUP`, active LOW).

Do not use GPIO 34, 12, 21, 22, 5, 18, 19, 23, 26, 27, or 33 for buttons. They are used by the GPS, LoRa radio, PMU, and OLED.

## 5. Check before power

- Count the jumpers to the T-Beam: **8 wires** (GND, 3V3, 21, 22, 13, 14, 15, 25).
- No button connects to the red (+) rail.
- OLED VCC goes to 3V3, not 5V.
- The 915 MHz LoRa antenna is screwed on. Transmitting without it can damage the radio.
- The GPS patch antenna is flat and faces up.
- Battery polarity matches the + mark on the holder.

## 6. First power-up

1. Plug the T-Beam into the laptop by USB.
2. Open the serial monitor:

   ```powershell
   cd C:\SALBAR\firmware\field-terminal
   & "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" device monitor -p COM10 -b 115200 --filter direct
   ```

3. Switch the T-Beam on and press `H`.

Expected results:

- The OLED shows the standby screen.
- Each button prints `BUTTON 1 (UP) PRESSED`, `BUTTON 2 (DOWN) PRESSED`, `BUTTON 3 (SELECT) PRESSED`, `BUTTON 4 (BACK) PRESSED`.
- Button 1 opens the triage menu on both the OLED and the serial screen.

Troubleshooting:

| Symptom | Fix |
| :--- | :--- |
| OLED blank | Check VCC/GND order and SDA/SCL wires. Send the boot log to check whether `0x3C` was found. |
| OLED shows garbage or shifted image | Module is probably SH1106; firmware driver must be changed. |
| Button prints nothing | Rotate the button 90 degrees, or check its GND jumper. |
| Button prints constantly | Legs shorted to GND or wrong leg pair. Use diagonal legs. |
| Wrong action fires | Two GPIO wires are swapped. |

## 7. Start the full system

1. Plug the gateway (T3-S3) into the laptop (COM9). Terminal 1:

   ```powershell
   cd C:\SALBAR\services\serial-bridge
   python bridge.py --port COM9
   ```

2. Terminal 2:

   ```powershell
   cd C:\SALBAR\apps\web-dashboard
   npm run dev
   ```

   Open `http://localhost:5173`.

3. Unplug the T-Beam from USB (it runs from the cell). Take it outside with the GPS antenna facing up. Wait for `GPS: FIX` on the OLED and `GPS=FIX` in the bridge log.

Time to first fix: under 1 minute if the T-Beam was off for less than about 2 to 4 hours; several minutes (up to about 20) after a longer power-off. Never press `R` in the serial monitor; it erases the stored satellite data.

## 8. The 10 tests

Run 10 trials using the physical buttons. No laptop is needed at the T-Beam.

For each trial:

1. Confirm the OLED shows a GPS fix.
2. Press **Button 1**, choose a category with **Button 3**, choose urgency with **Button 3**, then press **Button 3** to send. Vary category and urgency between trials.
3. Note the time of the final Send press.
4. Copy the incident line from the bridge log and check the pin on the dashboard (take a screenshot).
5. Record the true coordinates of the spot (long-press the spot in Google Maps).

Vary the conditions: next to the gateway, another floor, outside, farther away.

### Test table

| # | Date/Time | T-Beam location | Category / Urgency | Sent at | Received at | Delay (s) | RSSI (dBm) | Reported Lat, Lng | True Lat, Lng | GPS error (m) | Shown on dashboard? | Result (Pass/Fail) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | | | | | | | | | | | | |
| 2 | | | | | | | | | | | | |
| 3 | | | | | | | | | | | | |
| 4 | | | | | | | | | | | | |
| 5 | | | | | | | | | | | | |
| 6 | | | | | | | | | | | | |
| 7 | | | | | | | | | | | | |
| 8 | | | | | | | | | | | | |
| 9 | | | | | | | | | | | | |
| 10 | | | | | | | | | | | | |

Summary: success rate (x/10), average delay, average RSSI, average GPS error.
