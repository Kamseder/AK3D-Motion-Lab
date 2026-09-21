# AK3D Stepper Torque Simulator

Browser-based motion calculator for comparing stepper motors and travel profiles.

## Features

- Torque-vs-speed chart using the calculation model from the original spreadsheet
- Motor selection via dropdowns (up to 8 motors at once)
- 74 motor entries imported from the current workbook
- Custom motors stored locally in the browser
- Inputs for voltage, drive current, max power, pulley, ratio, acceleration and moving mass
- Travel-time calculator for rest-to-rest moves
- Acceleration/speed matrix with torque margin per cell
- No Excel, VBA, backend or build tool required

## GitHub Pages

This repo is a static site. To publish it:

1. Open **Settings → Pages**
2. Under **Build and deployment**, choose **Deploy from a branch**
3. Select `main` and `/ (root)`
4. Save

> GitHub Pages availability for private repositories depends on the GitHub plan. If needed, make the repository public before enabling Pages.

## Calculation model

The motor model mirrors the current spreadsheet logic: drive-current and power limits, back-EMF / inductive impedance, holding-torque scaling and rotor-inertia torque demand. It is a comparative simulation, not a dyno model.

Real-world limits can differ because of driver/chopper tuning, bus-voltage sag, temperature, belt dynamics, resonance, frame stiffness, bearings and mechanical losses.

## Data note

Motor parameters are copied from the supplied/current workbook database. They are not independently re-verified against manufacturers in this repository.
