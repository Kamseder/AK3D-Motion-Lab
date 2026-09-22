# AK3D Motion Lab

A browser-based 3D printing calculator suite for motion-system and extrusion tuning.

## Tools

- **Stepper Torque Simulator** – torque-vs-speed comparison with up to 8 steppers, custom stepper entries and the calculation model from the original spreadsheet
- **Travel Time Calculator** – compare rest-to-rest moves across speed/acceleration profiles
- **Accel / Speed Matrix** – theoretical torque margin across a configurable motion grid
- **Volumetric Flow Calculator** – convert print speed to flow rate, calculate maximum speed from a hotend flow limit, show flow headroom and compare layer heights
- 73 curated stepper entries in the public database
- Browser-local storage for custom steppers, selections, travel profiles and flow settings
- No Excel, VBA, backend or build tool required

## GitHub Pages

This repository is a static site. Publish the `main` branch from `/ (root)` in **Settings → Pages**.

## Stepper database

The public stepper database currently lives in `motors.js` (legacy/internal filename). The file is ordered the same way as the UI: **NEMA size → brand → body length → model**, with one readable block per stepper.

Each database entry uses the same fields:

```js
{
  key: "LDO-42STH48-2504AH",
  brand: "LDO",
  model: "42STH48-2504AH",
  nema: 17,
  bodyLength: 48,
  stepAngle: 1.8,
  ratedCurrent: 2.5,
  holdingTorque: 55,
  inductance: 1.5,
  resistance: 1.2,
  rotorInertia: 84.5,
  source: "https://..."
}
```

`key` must be unique and should stay stable because browser-local selections reference it. `brand`, `model`, `nema` and `bodyLength` control how steppers are grouped, sorted and displayed. The electrical values drive the torque calculation. Unknown optional values can be `null`; a source URL is recommended whenever specs are added or corrected.

For a consistent database, use manufacturer names consistently, keep model names exactly as published, use body length in mm, rated phase current in A, holding torque in N·cm, inductance in mH, resistance in Ω and rotor inertia in g·cm².

### Editing the database on GitHub

Open `motors.js` and click the pencil / **Edit this file** button. Find the matching `NEMA · Brand` heading and then:

- **Correct a stepper:** edit the values inside its existing block. Keep its `key` unchanged unless you intentionally want saved browser selections for that entry to stop matching.
- **Add a stepper:** copy a nearby block, give it a new unique `key`, enter the verified values and place it in the correct brand group by body length.
- **Remove a stepper:** delete its complete `{ ... },` block.
- **Add a source:** use `source: "https://..."` so the values can be checked again later.

Commit the edit when finished. The site reads this file directly; there is no build step or separate backend database to update.

## Calculation notes

### Stepper model

The stepper model mirrors the current spreadsheet logic: drive-current and power limits, back-EMF / inductive impedance, holding-torque scaling and rotor-inertia torque demand. It is a comparative simulation, not a dyno model.

Real-world motion limits can differ because of driver/chopper tuning, bus-voltage sag, temperature, belt dynamics, resonance, frame stiffness, bearings and mechanical losses.

### Flow model

Volumetric flow uses a rounded laid-down extrusion bead rather than treating the line as a full rectangle.

For the normal case where line width `w` is at least the layer height `h`, cross-sectional area is:

`area [mm²] = h × (w − h) + π × (h / 2)²`

and volumetric flow is:

`flow [mm³/s] = area [mm²] × print speed [mm/s]`

Example: `0.40 mm` line width × `0.20 mm` layer height produces an area of about `0.0714 mm²`, so at `300 mm/s` the calculated flow is about `21.42 mm³/s`.

Maximum print speed at a known hotend flow limit and target-flow-to-speed conversion use the same cross-section model. Real extrusion limits still depend on material, temperature, nozzle geometry, heater power and the quality threshold you consider acceptable.

## Data note

Stepper parameters are copied from the supplied/current workbook database unless a source is stored with the entry. They are not all independently re-verified against manufacturers in this repository.
