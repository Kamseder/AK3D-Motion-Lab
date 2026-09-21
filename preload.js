(() => {
  // Load the monochrome AK3D theme after the base stylesheet.
  const theme = document.createElement("link");
  theme.rel = "stylesheet";
  theme.href = "theme.css";
  document.head.appendChild(theme);

  // Small layout refinements are deliberately kept separate and loaded last.
  const layout = document.createElement("link");
  layout.rel = "stylesheet";
  layout.href = "layout-fixes.css";
  document.head.appendChild(layout);

  // Translate the one dynamic alert emitted by app.js.
  const nativeAlert = window.alert.bind(window);
  window.alert = message => nativeAlert(message === "Name fehlt." ? "Name required." : message);

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
  const motorByKey = key => window.AK3D_MOTORS.find(m => m.key === key);
  const motorLabel = m => m ? `${m.brand || "Other"} · ${m.model || m.key}` : "";

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

    for (let i = 1; i < 12; i += 2) {
      const frac = i / 12;
      const xVal = maxSpeed * frac;
      const X = p.l + frac * iw;
      group.appendChild(svgEl("line", {
        x1: X, x2: X, y1: p.t, y2: H - p.b,
        stroke: "#191919", "stroke-width": 1, opacity: 1
      }));
      group.appendChild(svgEl("text", {
        x: X, y: H - 33, "text-anchor": "middle", "font-size": 10, fill: "#6f6f6f"
      }, String(Math.round(xVal))));
    }

    for (let i = 1; i < 12; i += 2) {
      const frac = i / 12;
      const yVal = yMax * frac;
      const Y = p.t + (1 - frac) * ih;
      group.appendChild(svgEl("line", {
        x1: p.l, x2: W - p.r, y1: Y, y2: Y,
        stroke: "#191919", "stroke-width": 1, opacity: 1
      }));
      group.appendChild(svgEl("text", {
        x: p.l - 10, y: Y + 3.5, "text-anchor": "end", "font-size": 10, fill: "#6f6f6f"
      }, yVal.toFixed(yMax <= 20 ? 1 : 0)));
    }

    const firstAxis = svg.querySelector(".axis");
    if (firstAxis) svg.insertBefore(group, firstAxis);
    else svg.appendChild(group);
  }

  function styleAxisTitles(svg) {
    if (!svg) return;
    [...svg.querySelectorAll("text")].forEach(text => {
      const value = text.textContent.trim();
      if (value === "Available torque [Ncm]") {
        text.classList.add("ak-axis-title");
        text.setAttribute("x", "25");
        text.setAttribute("y", "280");
        text.setAttribute("font-size", "18");
        text.setAttribute("font-weight", "750");
        text.setAttribute("transform", "rotate(-90 25 280)");
      }
      if (value === "Speed [mm/s]") {
        text.classList.add("ak-axis-title");
        text.setAttribute("y", "550");
        text.setAttribute("font-size", "18");
        text.setAttribute("font-weight", "750");
      }
    });
  }

  function enhanceChart() {
    const svg = document.getElementById("torqueChart");
    if (!svg) return;
    const apply = () => {
      addMinorGrid(svg);
      styleAxisTitles(svg);
    };
    apply();
    const observer = new MutationObserver(() => requestAnimationFrame(apply));
    observer.observe(svg, { childList: true });
  }

  function selectedMotorKeys() {
    return [...document.querySelectorAll("#motorSlots select")]
      .map(select => select.value)
      .filter(Boolean);
  }

  function enhanceMotorSlots() {
    const root = document.getElementById("motorSlots");
    if (!root) return;

    const apply = () => {
      root.querySelectorAll("option").forEach(option => {
        if (!option.value) {
          if (option.textContent.trim() === "— Motor wählen —") option.textContent = "— Select motor —";
          return;
        }
        const m = motorByKey(option.value);
        const label = motorLabel(m);
        if (m && option.textContent !== label) option.textContent = label;
      });
      enrichMotorReadouts();
    };

    apply();
    new MutationObserver(apply).observe(root, { childList: true, subtree: true });
  }

  function enrichMotorReadouts() {
    const keys = selectedMotorKeys();

    const legendItems = [...document.querySelectorAll("#legend .legend-item")];
    keys.forEach((key, i) => {
      const item = legendItems[i];
      const m = motorByKey(key);
      if (!item || !m) return;
      const wanted = motorLabel(m);
      const swatch = item.querySelector(".swatch");
      const current = item.textContent.trim();
      if (current === wanted) return;
      item.textContent = "";
      if (swatch) item.appendChild(swatch);
      item.appendChild(document.createTextNode(wanted));
    });

    const rows = [...document.querySelectorAll("#motorResults tr")];
    keys.forEach((key, i) => {
      const badge = rows[i]?.querySelector("td:first-child .badge");
      const m = motorByKey(key);
      if (!badge || !m) return;
      const wanted = motorLabel(m);
      if (badge.textContent.trim() !== wanted) badge.textContent = wanted;
    });
  }

  function observeMotorReadouts() {
    [document.getElementById("legend"), document.getElementById("motorResults")].forEach(root => {
      if (!root) return;
      new MutationObserver(() => requestAnimationFrame(enrichMotorReadouts)).observe(root, { childList: true, subtree: true });
    });
    enrichMotorReadouts();
  }

  function forceMotorDetailsOpen() {
    const details = document.querySelector(".motor-details");
    if (!details) return;
    details.open = true;
    details.addEventListener("toggle", () => {
      if (!details.open) details.open = true;
    });
  }

  function compactTravelProfileLabels() {
    const root = document.getElementById("travelProfiles");
    if (!root) return;

    const apply = () => {
      root.querySelectorAll(".travel-profile").forEach(row => {
        const labels = row.querySelectorAll("label");
        if (labels[0]?.querySelector("span")) labels[0].querySelector("span").textContent = "Name";
        if (labels[1]?.querySelector("span")) {
          labels[1].querySelector("span").textContent = "Vmax";
          labels[1].title = "Maximum commanded speed [mm/s]";
        }
        if (labels[2]?.querySelector("span")) {
          labels[2].querySelector("span").textContent = "Accel";
          labels[2].title = "Acceleration [mm/s²]";
        }
      });
    };

    apply();
    new MutationObserver(apply).observe(root, { childList: true, subtree: true });
  }

  function setText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  }

  function tweakEnglishUI() {
    const heroMain = document.querySelector(".hero > div:first-child");
    const heroTitle = document.querySelector(".hero h1");
    if (heroMain && !document.querySelector(".ak-logo")) {
      const logo = document.createElement("img");
      logo.className = "ak-logo";
      logo.src = "logo.svg";
      logo.alt = "AK3D Printing";
      heroMain.insertBefore(logo, heroTitle || heroMain.firstChild);
    }
    if (heroTitle) heroTitle.textContent = "Stepper Torque Simulator";
    setText(".hero p", "Torque curves · Travel time · Acceleration / speed matrix");

    const badges = document.querySelectorAll(".hero-badges span");
    const badgeText = ["Torque curves", "Travel time", "Accel / speed matrix"];
    badges.forEach((badge, i) => { if (badgeText[i]) badge.textContent = badgeText[i]; });

    const drive = document.getElementById("drivePercent");
    const driveLabel = drive?.closest("label");
    const driveTitle = driveLabel?.querySelector("span");
    if (driveTitle) {
      driveTitle.textContent = "Max drive (% rated)";
      driveLabel.title = "Current cap as a percentage of each motor's rated current. 100% means no extra percentage cap; Drive current and Max motor power can still limit it further.";
    }

    const pulley = document.getElementById("pulley");
    const pulleyLabel = pulley?.closest("label");
    const pulleyTitle = pulleyLabel?.querySelector("span");
    if (pulleyTitle) pulleyTitle.textContent = "Pulley teeth";
    const pulleyUnit = pulleyLabel?.querySelector(".input-unit b");
    if (pulleyUnit) pulleyUnit.textContent = "teeth";

    setText("#tab-torque .chart-card .card-title-row p", "Motor torque after drive limits and rotor-inertia demand. The denser grid gives quick speed/torque estimates; hover remains available for exact values.");

    const motorHint = document.querySelector("#motorSlots + .hint");
    if (motorHint) motorHint.textContent = "Up to 8 motors at once. Your selection is stored locally in the browser.";

    const customName = document.getElementById("cName");
    if (customName) customName.placeholder = "e.g. AK Test 2504";

    setText("#tab-travel .card-title-row p", "Rest-to-rest move: accelerate → cruise if possible → decelerate.");

    const matrixHint = document.querySelector("#tab-matrix .matrix-controls .hint");
    if (matrixHint) matrixHint.textContent = "Margin = available torque / required torque − 1. This is a simulation, not a guaranteed skip predictor.";

    const footer = document.querySelector("footer");
    if (footer) footer.innerHTML = "<b>AK3D Stepper Torque Simulator</b> · Real-world results may vary with driver/chopper settings, supply voltage, motor temperature, belts, mechanics and resonances.";
  }

  function init() {
    tweakEnglishUI();
    enhanceMotorSlots();
    observeMotorReadouts();
    forceMotorDetailsOpen();
    compactTravelProfileLabels();
    enhanceChart();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
