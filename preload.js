(() => {
  // Load visual overrides after the base stylesheet. Chart redraw handling is scoped
  // only to the torque SVG so unrelated UI mutations cannot create observer loops.
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

  // Repair the accidental giant Vmax value saved in the browser from an earlier
  // layout test. Only known default profiles are touched, and only when invalid.
  try {
    const raw = localStorage.getItem("ak3d-travel-profiles");
    if (raw) {
      const profiles = JSON.parse(raw);
      const defaults = {
        "800 / 100k": {speed:800, accel:100000},
        "1000 / 80k": {speed:1000, accel:80000},
        "1100 / 70k": {speed:1100, accel:70000},
        "1200 / 65k": {speed:1200, accel:65000}
      };
      let changed = false;
      if (Array.isArray(profiles)) {
        profiles.forEach(p => {
          const d = defaults[String(p?.name || "").trim()];
          if (!d) return;
          if (!Number.isFinite(Number(p.speed)) || Number(p.speed) <= 0 || Number(p.speed) > 5000) {
            p.speed = d.speed;
            changed = true;
          }
          if (!Number.isFinite(Number(p.accel)) || Number(p.accel) <= 0 || Number(p.accel) > 500000) {
            p.accel = d.accel;
            changed = true;
          }
        });
      }
      if (changed) localStorage.setItem("ak3d-travel-profiles", JSON.stringify(profiles));
    }
  } catch (_) {}

  const NS = "http://www.w3.org/2000/svg";
  const stepperByKey = key => (window.AK3D_MOTORS || []).find(stepper => stepper.key === key);

  function svgEl(name, attrs = {}, text = "") {
    const el = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    if (text !== "") el.textContent = text;
    return el;
  }

  function clampTorqueCurves() {
    const svg = document.getElementById("torqueChart");
    if (!svg) return;
    const plotFloorY = 510; // 560 px viewBox height - 50 px bottom plot margin

    // A stepper cannot provide useful negative torque in this view. Clamp every
    // rendered curve to the 0 N·cm baseline on every initial render and redraw.
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
  }

  function enhanceChart() {
    const svg = document.getElementById("torqueChart");
    if (!svg) return;

    const p = { l: 70, r: 25, t: 24, b: 50 };
    const W = 1200, H = 560;

    clampTorqueCurves();

    [...svg.querySelectorAll("text")].forEach(text => {
      if (text.textContent.includes("Ncm")) text.textContent = text.textContent.replaceAll("Ncm", "N·cm");
      const value = text.textContent.trim();
      if (value === "Available torque [N·cm]") {
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
      group.appendChild(svgEl("text", {x:X,y:H-19,"text-anchor":"middle","font-size":12,fill:"#6f6f6f"}, String(Math.round(maxSpeed*frac))));
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

  function enhanceMatrixBrand() {
    const select = document.getElementById("matrixMotor");
    if (!select) return;

    // app.js is the single source of truth for option labels and sorting. This
    // enhancement only shows the selected manufacturer's name below the selector.
    const stepper = stepperByKey(select.value);
    let brand = document.getElementById("matrixBrand");
    if (!brand) {
      brand = document.createElement("div");
      brand.id = "matrixBrand";
      brand.className = "matrix-brand";
      select.closest("label")?.insertAdjacentElement("afterend", brand);
    }
    if (brand) brand.innerHTML = stepper ? `Brand: <b>${stepper.brand || "Other"}</b>` : "";
  }

  function forceStepperDetailsOpen() {
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

  function ensureTravelGuide() {
    const panel = document.getElementById("tab-travel");
    const layout = panel?.querySelector(".travel-layout");
    if (!panel || !layout || document.getElementById("travelGuide")) return;

    const guide = document.createElement("section");
    guide.id = "travelGuide";
    guide.className = "travel-guide";
    guide.innerHTML = `
      <div class="travel-guide-card">
        <span class="guide-kicker">TRIANGLE MOVE</span>
        <b>Acceleration limited</b>
        <p>Short travels never reach Vmax. More acceleration usually matters more than a higher commanded speed.</p>
      </div>
      <div class="travel-guide-card">
        <span class="guide-kicker">TRAPEZOID MOVE</span>
        <b>Vmax reached</b>
        <p>Longer travels include a cruise phase. Both acceleration and top speed influence the total time.</p>
      </div>
      <div class="travel-guide-card">
        <span class="guide-kicker">DISTANCE TO VMAX</span>
        <b>d = V² / a</b>
        <p>The shown Vmax distance is the minimum rest-to-rest travel needed to accelerate to Vmax and brake again.</p>
      </div>`;
    layout.insertAdjacentElement("afterend", guide);
  }

  function tweakStaticUI() {
    const drive = document.getElementById("drivePercent")?.closest("label");
    if (drive?.querySelector("span")) drive.querySelector("span").textContent = "Max drive (% rated)";
    const pulley = document.getElementById("pulley")?.closest("label");
    if (pulley?.querySelector("span")) pulley.querySelector("span").textContent = "Pulley teeth";
    if (pulley?.querySelector(".input-unit b")) pulley.querySelector(".input-unit b").textContent = "teeth";

    const customName = document.getElementById("cName");
    if (customName) customName.placeholder = "e.g. AK Test 2504";

    const stepperHint = document.querySelector("#motorSlots + .hint");
    if (stepperHint) stepperHint.textContent = "Up to 8 steppers at once. Your selection is stored locally in the browser.";

    const matrixHint = document.querySelector("#tab-matrix .matrix-controls .hint");
    if (matrixHint) matrixHint.textContent = "Margin = available torque / required torque − 1. This is a simulation, not a guaranteed skip predictor.";

    const footer = document.querySelector("footer");
    if (footer) footer.innerHTML = "<b>AK3D Motion Lab</b> · 3D Printing Calculator Suite · Calculated values are estimates; real-world results depend on hardware, settings, tuning, material, temperature and mechanics.";
  }

  function refreshEnhancements() {
    requestAnimationFrame(() => {
      forceStepperDetailsOpen();
      compactTravelLabels();
      enhanceMatrixBrand();
      enhanceChart();
      ensureTravelGuide();
    });
  }

  function init() {
    tweakStaticUI();
    refreshEnhancements();

    // app.js completely redraws the SVG by replacing its children. Watch only that
    // exact operation, then immediately re-apply the 0 N·cm clamp and chart extras.
    const torqueSvg = document.getElementById("torqueChart");
    if (torqueSvg) {
      let redrawFrame = 0;
      new MutationObserver(() => {
        cancelAnimationFrame(redrawFrame);
        redrawFrame = requestAnimationFrame(enhanceChart);
      }).observe(torqueSvg, {childList:true});
    }

    document.addEventListener("input", refreshEnhancements, {passive:true});
    document.addEventListener("change", refreshEnhancements, {passive:true});
    document.addEventListener("click", refreshEnhancements, {passive:true});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
