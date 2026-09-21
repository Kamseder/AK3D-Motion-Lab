(() => {
  const $ = id => document.getElementById(id);
  const root = $('tab-flow');
  if (!root) return;

  const defaults = {
    nozzle: 0.4,
    lineWidth: 0.45,
    layerHeight: 0.20,
    speed: 300,
    maxFlow: 42.5,
    filament: 1.75
  };

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('ak3d-flow-settings') || '{}') || {}; } catch (_) {}

  const ids = {
    nozzle: 'flowNozzle',
    lineWidth: 'flowLineWidth',
    layerHeight: 'flowLayerHeight',
    speed: 'flowSpeed',
    maxFlow: 'flowMax',
    filament: 'flowFilament'
  };

  const fmt = (v, d = 1) => Number.isFinite(v) ? v.toFixed(d) : '–';
  const pos = (id, fallback) => {
    const v = Number($(id).value);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };

  Object.entries(ids).forEach(([key, id]) => {
    $(id).value = saved[key] ?? defaults[key];
  });

  function values() {
    return {
      nozzle: pos(ids.nozzle, defaults.nozzle),
      lineWidth: pos(ids.lineWidth, defaults.lineWidth),
      layerHeight: pos(ids.layerHeight, defaults.layerHeight),
      speed: pos(ids.speed, defaults.speed),
      maxFlow: pos(ids.maxFlow, defaults.maxFlow),
      filament: pos(ids.filament, defaults.filament)
    };
  }

  function save(v) {
    localStorage.setItem('ak3d-flow-settings', JSON.stringify(v));
  }

  function loadClass(load) {
    if (load > 100) return 'flow-fail';
    if (load > 90) return 'flow-tight';
    if (load > 70) return 'flow-good';
    return 'flow-strong';
  }

  function render() {
    const v = values();
    const area = v.lineWidth * v.layerHeight;
    const flow = area * v.speed;
    const maxSpeed = v.maxFlow / area;
    const load = flow / v.maxFlow * 100;
    const headroom = v.maxFlow - flow;
    const filamentArea = Math.PI * Math.pow(v.filament / 2, 2);
    const filamentSpeed = flow / filamentArea;

    $('flowRequired').textContent = `${fmt(flow, 2)} mm³/s`;
    $('flowMaxSpeed').textContent = `${fmt(maxSpeed, 0)} mm/s`;
    $('flowLoad').textContent = `${fmt(load, 1)} %`;
    $('flowFilamentSpeed').textContent = `${fmt(filamentSpeed, 2)} mm/s`;

    const status = $('flowStatus');
    status.className = `flow-status ${loadClass(load)}`;
    if (load <= 100) {
      status.innerHTML = `<b>${fmt(headroom, 2)} mm³/s headroom</b><span>Current settings use ${fmt(load, 1)}% of the entered hotend flow limit.</span>`;
    } else {
      status.innerHTML = `<b>${fmt(Math.abs(headroom), 2)} mm³/s over limit</b><span>Required flow is ${fmt(load - 100, 1)}% above the entered hotend flow limit.</span>`;
    }

    $('flowDetail').innerHTML = `Extrusion cross-section: <b>${fmt(area, 3)} mm²</b> · Formula: <b>line width × layer height × speed</b> · Max speed at ${fmt(v.maxFlow, 2)} mm³/s: <b>${fmt(maxSpeed, 0)} mm/s</b>.`;

    const warnings = [];
    if (v.layerHeight > v.nozzle * 0.8) warnings.push(`Layer height is above 80% of the ${fmt(v.nozzle, 2)} mm nozzle diameter.`);
    if (v.lineWidth < v.nozzle * 0.8) warnings.push(`Line width is below 80% of nozzle diameter.`);
    if (v.lineWidth > v.nozzle * 1.8) warnings.push(`Line width is above 180% of nozzle diameter.`);
    $('flowWarnings').textContent = warnings.join(' ');

    const baseHeights = [0.10, 0.12, 0.16, 0.20, 0.24, 0.28, 0.32, 0.36, 0.40];
    if (!baseHeights.some(h => Math.abs(h - v.layerHeight) < 0.0001)) baseHeights.push(v.layerHeight);
    baseHeights.sort((a, b) => a - b);

    $('flowTableBody').innerHTML = baseHeights.map(h => {
      const q = v.lineWidth * h * v.speed;
      const vmax = v.maxFlow / (v.lineWidth * h);
      const pct = q / v.maxFlow * 100;
      const current = Math.abs(h - v.layerHeight) < 0.0001 ? ' current-row' : '';
      return `<tr class="${loadClass(pct)}${current}"><td><b>${h.toFixed(2)} mm</b></td><td>${q.toFixed(2)} mm³/s</td><td><b>${Math.round(vmax)} mm/s</b></td><td>${pct.toFixed(1)}%</td></tr>`;
    }).join('');

    document.querySelectorAll('[data-flow-nozzle]').forEach(btn => {
      btn.classList.toggle('active', Math.abs(Number(btn.dataset.flowNozzle) - v.nozzle) < 0.0001);
    });
    document.querySelectorAll('[data-flow-max]').forEach(btn => {
      btn.classList.toggle('active', Math.abs(Number(btn.dataset.flowMax) - v.maxFlow) < 0.0001);
    });

    save(v);
  }

  Object.values(ids).forEach(id => $(id).addEventListener('input', render));

  document.querySelectorAll('[data-flow-nozzle]').forEach(btn => btn.addEventListener('click', () => {
    const nozzle = Number(btn.dataset.flowNozzle);
    $('flowNozzle').value = nozzle;
    $('flowLineWidth').value = (nozzle * 1.125).toFixed(2);
    render();
  }));

  document.querySelectorAll('[data-flow-max]').forEach(btn => btn.addEventListener('click', () => {
    $('flowMax').value = btn.dataset.flowMax;
    render();
  }));

  $('flowAutoWidth').addEventListener('click', () => {
    const nozzle = pos('flowNozzle', defaults.nozzle);
    $('flowLineWidth').value = (nozzle * 1.125).toFixed(2);
    render();
  });

  $('flowUseMax').addEventListener('click', () => {
    const v = values();
    $('flowSpeed').value = Math.round(v.maxFlow / (v.lineWidth * v.layerHeight));
    render();
  });

  $('flowReset').addEventListener('click', () => {
    Object.entries(ids).forEach(([key, id]) => { $(id).value = defaults[key]; });
    render();
  });

  render();
})();
