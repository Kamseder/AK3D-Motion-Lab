(() => {
  // Additional motors that are not part of the original spreadsheet database.
  window.AK3D_MOTORS = window.AK3D_MOTORS || [];
  const extras = [
    {
      key: "Excit3D-MaxMotor",
      brand: "Excit3D",
      model: "MaxMotor",
      nema: 17,
      bodyLength: 48,
      stepAngle: 1.8,
      ratedCurrent: 4.0,
      holdingTorque: 56,
      inductance: 0.6,
      resistance: 0.45,
      rotorInertia: 82,
      source: "https://excit3d.shop/shop/excit3d-max-motor",
      note: "55 mm shaft, Class H 180 C. Simulation constants from TheDevMinerTV/stepper-simulator database."
    }
  ];
  extras.forEach(m => {
    if (!window.AK3D_MOTORS.some(x => x.key === m.key)) window.AK3D_MOTORS.push(m);
  });

  const NS = "http://www.w3.org/2000/svg";

  function svgEl(name, attrs = {}, text = "") {
    const el = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    if (text !== "") el.textContent = text;
    return el;
  }

  function addMinorGrid(svg) {
    if (!svg || svg.querySelector('[data-ak3d-minor-grid="1"]')) return;

    const p = { l: 70, r: 25, t: 24, b: 50 };
    const W = 1200, H = 560;
    const iw = W - p.l - p.r;
    const ih = H - p.t - p.b;
    const maxSpeed = Math.max(100, Number(document.getElementById("maxSpeed")?.value) || 3000);

    const yLabels = [...svg.querySelectorAll("text")]
      .filter(t => Math.abs((Number(t.getAttribute("x")) || 0) - (p.l - 10)) < 0.1)
      .map(t => Number(String(t.textContent).replace(",", ".")))
      .filter(Number.isFinite);
    const yMax = Math.max(10, ...yLabels);

    const group = svgEl("g", { "data-ak3d-minor-grid": "1", "pointer-events": "none" });

    // Existing chart uses 6 major divisions. Add half-step lines so the plot reads
    // like a proper coordinate matrix without making the hover tooltip redundant.
    for (let i = 1; i < 12; i += 2) {
      const frac = i / 12;
      const xVal = maxSpeed * frac;
      const X = p.l + frac * iw;
      group.appendChild(svgEl("line", {
        x1: X, x2: X, y1: p.t, y2: H - p.b,
        stroke: "#1d2a39", "stroke-width": 1, opacity: 0.95
      }));
      group.appendChild(svgEl("text", {
        x: X, y: H - 33, "text-anchor": "middle", "font-size": 10, fill: "#68798d"
      }, String(Math.round(xVal))));
    }

    for (let i = 1; i < 12; i += 2) {
      const frac = i / 12;
      const yVal = yMax * frac;
      const Y = p.t + (1 - frac) * ih;
      group.appendChild(svgEl("line", {
        x1: p.l, x2: W - p.r, y1: Y, y2: Y,
        stroke: "#1d2a39", "stroke-width": 1, opacity: 0.95
      }));
      group.appendChild(svgEl("text", {
        x: p.l - 10, y: Y + 3.5, "text-anchor": "end", "font-size": 10, fill: "#68798d"
      }, yVal.toFixed(yMax <= 20 ? 1 : 0)));
    }

    const firstAxis = svg.querySelector(".axis");
    if (firstAxis) svg.insertBefore(group, firstAxis);
    else svg.appendChild(group);
  }

  function enhanceChart() {
    const svg = document.getElementById("torqueChart");
    if (!svg) return;
    addMinorGrid(svg);
    const observer = new MutationObserver(() => requestAnimationFrame(() => addMinorGrid(svg)));
    observer.observe(svg, { childList: true });
  }

  function tweakLabels() {
    const drive = document.getElementById("drivePercent");
    const driveLabel = drive?.closest("label");
    const driveTitle = driveLabel?.querySelector("span");
    if (driveTitle) {
      driveTitle.textContent = "Max drive (% rated)";
      driveLabel.title = "Current cap as a percentage of each motor's rated current. 100% = no extra percentage cap; the Drive current and Max motor power limits can still cap it lower.";
    }

    const pulley = document.getElementById("pulley");
    const pulleyLabel = pulley?.closest("label");
    const pulleyTitle = pulleyLabel?.querySelector("span");
    if (pulleyTitle) pulleyTitle.textContent = "Pulley teeth";
    const pulleyUnit = pulleyLabel?.querySelector(".input-unit b");
    if (pulleyUnit) pulleyUnit.textContent = "teeth";

    const chartText = document.querySelector("#tab-torque .chart-card .card-title-row p");
    if (chartText) chartText.textContent = "Motor torque after drive limits and rotor-inertia demand. The denser grid gives quick speed/torque estimates; hover stays available for exact values.";
  }

  function init() {
    tweakLabels();
    enhanceChart();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
