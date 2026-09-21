# AK3D Motion Lab

A browser-based 3D printing calculator suite for motion-system and extrusion tuning.

## Tools

- **Stepper Torque Simulator** – torque-vs-speed comparison with up to 8 motors, custom motor entries and the calculation model from the original spreadsheet
- **Travel Time Calculator** – compare rest-to-rest moves across speed/acceleration profiles
- **Accel / Speed Matrix** – theoretical torque margin across a configurable motion grid
- **Volumetric Flow Calculator** – convert print speed to flow rate, calculate maximum speed from a hotend flow limit, show flow headroom and compare layer heights
- 74 motor entries imported from the current workbook
- Browser-local storage for custom motors, selections, travel profiles and flow settings
- No Excel, VBA, backend or build tool required

## GitHub Pages

This repository is a static site. Publish the `main` branch from `/ (root)` in **Settings → Pages**.

## Calculation notes

### Stepper model

The motor model mirrors the current spreadsheet logic: drive-current and power limits, back-EMF / inductive impedance, holding-torque scaling and rotor-inertia torque demand. It is a comparative simulation, not a dyno model.

Real-world motion limits can differ because of driver/chopper tuning, bus-voltage sag, temperature, belt dynamics, resonance, frame stiffness, bearings and mechanical losses.

### Flow model

Volumetric flow is calculated geometrically:

`flow [mm³/s] = line width [mm] × layer height [mm] × print speed [mm/s]`

Maximum print speed at a known hotend flow limit is the inverse calculation. Real extrusion limits depend on material, temperature, nozzle geometry, heater power and the quality threshold you consider acceptable.

## Data note

Motor parameters are copied from the supplied/current workbook database. They are not independently re-verified against manufacturers in this repository.
