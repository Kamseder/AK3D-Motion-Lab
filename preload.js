(() => {
  // Load visual overrides after the base stylesheet. No observers here: this file
  // deliberately uses event-driven refreshes only, to avoid runaway DOM mutation loops.
  const theme = document.createElement("link");
  theme.rel = "stylesheet";
  theme.href = "theme.css";
  document.head.appendChild(theme);

  const layout = document.createElement("link");
  layout.rel = "stylesheet";
  layout.href = "layout-fixes.css";
  document.head.appendChild(layout);

  const nativeAlert = window.alert.bind(window);
  window.alert = message => nativeAlert(message === "Name fehlt." ? "Name required." : message);

  // Extra motor not present in the original spreadsheet database.
  window.AK3D_MOTORS = window.AK3D_MOTORS || [];
  const extra = {
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
    note: "55 mm shaft, Class H 180 C."
  };
  if (!window.AK3D_MOTORS.some(x => x.key === extra.key)) window.AK3D_MOTORS.push(extra);

  const NS = "http://www.w3.org/2000/svg";
  const motorByKey = key => window.AK3D_MOTORS.find(m => m.key === key);
  const motorLabel = m => m ? `${m.brand || "Other"} · ${m.model || m.key}` : "";

  function svgEl(name, attrs = {}, text = "") {
    const el = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    if (text !== "") el.textContent = text;
    return el;
  }

  function enhanceChart() {
    const svg = document.getElementById("torqueChart");
    if (!svg) return;

    const p = { l: 70, r: 25, t: 24, b: 50 };
    const W = 1200, H = 560;
    const plotFloorY = H - p.b;

    // A motor cannot provide useful negative torque in this view. Visually clamp
    // every curve to the 0 Ncm baseline so it never runs through the speed labels.
    svg.querySelectorAll("polyline.curve").forEach(curve => {
      const points = String(curve.getAttribute("points") || "").trim();
      if (!points) return;
      const clamped = points.split(/\s+/).map(pair => {
        const [xRaw, yRaw] = pair.split(",");
        const x = Number(xRaw), y = Number(yRaw);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return pair;
        return `${x.toFixed(1)},${Math.min(y, plotFloorY).toFixed(1)}`;
      }).join(" ");
      curve.setAttribute("points", clamped);
    });

    // Axis titles: make both readable without changing the data/curves.
    [...svg.querySelectorAll("text")].forEach(text => {
      const value = text.textContent.trim();
      if (value === "Available torque [Ncm]") {
        text.classList.add("ak-axis-title");
        text.setAttribute("x", "29");
        text.setAttribute("y", "280");
        text.setAttribute("font-size", "21");
        text.setAttribute("font-weight", "760");
        text.setAttribute("transform", "rotate(-90 29 280)");
      } else if (value === "Speed [mm/s]") {
        text.classList.add("ak-axis-title");
        text.setAttribute("y", "550");
        text.setAttribute("font-size", "21");
        text.setAttribute("font-weight", "760");
      }
    });

    // Denser grid, added once per render. app.js replaces the SVG contents on a
    // recalculation, so the next user input simply calls this function again.
    if (svg.querySelector('[data-ak3d-minor-grid="1"]')) return;
    const iw = W - p.l - p.r;
    const ih = H - p.t - p.b;
    const maxSpeed = Math.max(100, Number(document.getElementById("maxSpeed")?.value) || 3000);
    const yLabels = [...svg.querySelectorAll("text")]
      .filter(t => Math.abs((Number(t.getAttribute("x")) || 0) - (p.l - 10)) < 0.1)
      .map(t => Number(String(t.textContent).replace(",", ".")))
      .filter(Number.isFinite);
    const yMax = Math.max(10, ...yLabels);
    const group = svgEl("g", { "data-ak3d-minor-grid": "1", "pointer-events": "none" });

    for (let i = 1; i < 12; i += 2) {
      const frac = i / 12;
      const X = p.l + frac * iw;
      group.appendChild(svgEl("line", {x1:X,x2:X,y1:p.t,y2:H-p.b,stroke:"#191919","stroke-width":1}));
      group.appendChild(svgEl("text", {x:X,y:H-33,"text-anchor":"middle","font-size":10,fill:"#6f6f6f"}, String(Math.round(maxSpeed*frac))));
    }
    for (let i = 1; i < 12; i += 2) {
      const frac = i / 12;
      const Y = p.t + (1-frac) * ih;
      group.appendChild(svgEl("line", {x1:p.l,x2:W-p.r,y1:Y,y2:Y,stroke:"#191919","stroke-width":1}));
      group.appendChild(svgEl("text", {x:p.l-10,y:Y+3.5,"text-anchor":"end","font-size":10,fill:"#6f6f6f"}, (yMax*frac).toFixed(yMax<=20?1:0)));
    }
    const firstAxis = svg.querySelector(".axis");
    if (firstAxis) svg.insertBefore(group, firstAxis); else svg.appendChild(group);
  }

  function selectedMotorKeys() {
    return [...document.querySelectorAll("#motorSlots select")].map(s => s.value).filter(Boolean);
  }

  function enhanceMotorLabels() {
    const root = document.getElementById("motorSlots");
    if (!root) return;

    root.querySelectorAll("option").forEach(option => {
      if (!option.value) {
        if (option.textContent.trim() === "— Motor wählen —") option.textContent = "— Select motor —";
        return;
      }
      const m = motorByKey(option.value);
      if (m) option.textContent = motorLabel(m);
    });

    const keys = selectedMotorKeys();
    const legendItems = [...document.querySelectorAll("#legend .legend-item")];
    keys.forEach((key, i) => {
      const item = legendItems[i], m = motorByKey(key);
      if (!item || !m) return;
      const swatch = item.querySelector(".swatch");
      item.replaceChildren();
      if (swatch) item.appendChild(swatch);
      item.appendChild(document.createTextNode(motorLabel(m)));
    });

    const rows = [...document.querySelectorAll("#motorResults tr")];
    keys.forEach((key, i) => {
      const badge = rows[i]?.querySelector("td:first-child .badge"), m = motorByKey(key);
      if (badge && m) badge.textContent = motorLabel(m);
    });
  }

  function enhanceMatrixMotorBrand() {
    const select = document.getElementById("matrixMotor");
    if (!select) return;

    select.querySelectorAll("option").forEach(option => {
      if (!option.value) return;
      const m = motorByKey(option.value);
      if (m) option.textContent = motorLabel(m);
    });

    const m = motorByKey(select.value);
    let brand = document.getElementById("matrixBrand");
    if (!brand) {
      brand = document.createElement("div");
      brand.id = "matrixBrand";
      brand.className = "matrix-brand";
      select.closest("label")?.insertAdjacentElement("afterend", brand);
    }
    if (brand) brand.innerHTML = m ? `Brand: <b>${m.brand || "Other"}</b>` : "";

    const summaryName = document.querySelector("#matrixSummary .summary-chip b");
    if (summaryName && m) summaryName.textContent = motorLabel(m);
  }

  function forceMotorDetailsOpen() {
    const details = document.querySelector(".motor-details");
    if (details) details.open = true;
  }

  function compactTravelLabels() {
    document.querySelectorAll("#travelProfiles .travel-profile").forEach(row => {
      const labels = row.querySelectorAll("label");
      if (labels[0]?.querySelector("span")) labels[0].querySelector("span").textContent = "Name";
      if (labels[1]?.querySelector("span")) labels[1].querySelector("span").textContent = "Vmax";
      if (labels[2]?.querySelector("span")) labels[2].querySelector("span").textContent = "Accel";
    });
  }

  function tweakStaticUI() {
    const drive = document.getElementById("drivePercent")?.closest("label");
    if (drive?.querySelector("span")) drive.querySelector("span").textContent = "Max drive (% rated)";
    const pulley = document.getElementById("pulley")?.closest("label");
    if (pulley?.querySelector("span")) pulley.querySelector("span").textContent = "Pulley teeth";
    if (pulley?.querySelector(".input-unit b")) pulley.querySelector(".input-unit b").textContent = "teeth";

    const customName = document.getElementById("cName");
    if (customName) customName.placeholder = "e.g. AK Test 2504";

    const motorHint = document.querySelector("#motorSlots + .hint");
    if (motorHint) motorHint.textContent = "Up to 8 motors at once. Your selection is stored locally in the browser.";

    const matrixHint = document.querySelector("#tab-matrix .matrix-controls .hint");
    if (matrixHint) matrixHint.textContent = "Margin = available torque / required torque − 1. This is a simulation, not a guaranteed skip predictor.";

    const footer = document.querySelector("footer");
    if (footer) footer.innerHTML = "<b>AK3D Stepper Torque Simulator</b> · Real-world results may vary with driver/chopper settings, supply voltage, motor temperature, belts, mechanics and resonances.";
  }

  function refreshEnhancements() {
    requestAnimationFrame(() => {
      forceMotorDetailsOpen();
      compactTravelLabels();
      enhanceMotorLabels();
      enhanceMatrixMotorBrand();
      enhanceChart();
    });
  }

  function init() {
    tweakStaticUI();
    refreshEnhancements();

    // User-event driven updates only. No MutationObserver = no self-triggering loop.
    document.addEventListener("input", refreshEnhancements, {passive:true});
    document.addEventListener("change", refreshEnhancements, {passive:true});
    document.addEventListener("click", refreshEnhancements, {passive:true});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();