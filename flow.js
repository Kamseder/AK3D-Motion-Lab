(() => {
  const $ = id => document.getElementById(id);

  // Firefox can render individual SVG number glyphs with slightly different optical
  // vertical bounds even when their text baselines are identical. Measure the actual
  // rendered boxes and compensate each x-axis tick so their visible tops line up.
  function alignTorqueXAxisTicks() {
    const svg = $('torqueChart');
    if (!svg) return;
    requestAnimationFrame(() => {
      const ticks = [...svg.querySelectorAll('text')].filter(t => t.getAttribute('y') === '541');
      if (ticks.length < 2) return;
      ticks.forEach(t => t.removeAttribute('transform'));
      const boxes = ticks.map(t => t.getBBox());
      const targetTop = Math.max(...boxes.map(b => b.y));
      ticks.forEach((t, i) => {
        const dy = targetTop - boxes[i].y;
        t.setAttribute('transform', `translate(0 ${dy.toFixed(2)})`);
      });
    });
  }

  const torqueSvg = $('torqueChart');
  if (torqueSvg) {
    new MutationObserver(alignTorqueXAxisTicks).observe(torqueSvg, { childList: true });
    alignTorqueXAxisTicks();
    window.addEventListener('resize', alignTorqueXAxisTicks);
  }

  // Global readability pass for the whole Motion Lab UI.
  if (!document.querySelector('link[data-ak3d-ui-polish]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'ui-polish.css';
    link.dataset.ak3dUiPolish = '1';
    document.head.appendChild(link);
  }

  const root = $('tab-flow');
  if (!root) return;

  // Extra direct converter: enter a target volumetric flow and get the matching mm/s.
  const controlsGrid = root.querySelector('.flow-controls .field-grid');
  if (controlsGrid && !$('flowTarget')) {
    controlsGrid.insertAdjacentHTML('beforeend', '<label><span>Target flow</span><div class="input-unit"><input id="flowTarget" type="number" value="42.5" step="0.5" min="0.1"><b>mm³/s</b></div></label>');
  }

  const metricGrid = root.querySelector('.flow-metrics');
  if (metricGrid && !$('flowTargetSpeed')) {
    metricGrid.insertAdjacentHTML('beforeend', '<div class="metric"><span>Speed @ target flow</span><strong id="flowTargetSpeed">–</strong></div>');
  }

  const defaults = {
    nozzle: 0.4,
    lineWidth: 0.4,
    layerHeight: 0.20,
    speed: 300,
    maxFlow: 42.5,
    filament: 1.75,
    targetFlow: 42.5
  };

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('ak3d-flow-settings') || '{}') || {}; } catch (_) {}

  // Migrate the old initial 0.45 mm default so existing browsers also get the new 0.40 mm default.
  if (Number(saved.lineWidth) === 0.45) saved.lineWidth = 0.4;

  const ids = {
    nozzle: 'flowNozzle',
    lineWidth: 'flowLineWidth',
    layerHeight: 'flowLayerHeight',
    speed: 'flowSpeed',
    maxFlow: 'flowMax',
    filament: 'flowFilament',
    targetFlow: 'flowTarget'
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
      filament: pos(ids.filament, defaults.filament),
      targetFlow: pos(ids.targetFlow, defaults.targetFlow)
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
    const targetSpeed = v.targetFlow / area;
    const load = flow / v.maxFlow * 100;
    const headroom = v.maxFlow - flow;
    const filamentArea = Math.PI * Math.pow(v.filament / 2, 2);
    const filamentSpeed = flow / filamentArea;

    $('flowRequired').textContent = `${fmt(flow, 2)} mm³/s`;
    $('flowMaxSpeed').textContent = `${fmt(maxSpeed, 0)} mm/s`;
    $('flowLoad').textContent = `${fmt(load, 1)} %`;
    $('flowFilamentSpeed').textContent = `${fmt(filamentSpeed, 2)} mm/s`;
    $('flowTargetSpeed').textContent = `${fmt(targetSpeed, 0)} mm/s`;

    const status = $('flowStatus');
    status.className = `flow-status ${loadClass(load)}`;
    if (load <= 100) {
      status.innerHTML = `<b>${fmt(headroom, 2)} mm³/s headroom</b><span>Current settings use ${fmt(load, 1)}% of the entered hotend flow limit.</span>`;
    } else {
      status.innerHTML = `<b>${fmt(Math.abs(headroom), 2)} mm³/s over limit</b><span>Required flow is ${fmt(load - 100, 1)}% above the entered hotend flow limit.</span>`;
    }

    $('flowDetail').innerHTML = `Extrusion cross-section: <b>${fmt(area, 3)} mm²</b> · Current flow: <b>${fmt(flow, 2)} mm³/s</b> · Target ${fmt(v.targetFlow, 2)} mm³/s = <b>${fmt(targetSpeed, 0)} mm/s</b> · Hotend limit ${fmt(v.maxFlow, 2)} mm³/s = <b>${fmt(maxSpeed, 0)} mm/s</b>.`;

    const warnings = [];
    if (v.layerHeight > v.nozzle * 0.8) warnings.push(`Layer height is above 80% of the ${fmt(v.nozzle, 2)} mm nozzle diameter.`);
    if (v.lineWidth < v.nozzle * 0.8) warnings.push('Line width is below 80% of nozzle diameter.');
    if (v.lineWidth > v.nozzle * 1.8) warnings.push('Line width is above 180% of nozzle diameter.');
    if (v.targetFlow > v.maxFlow) warnings.push(`Target flow is ${fmt(v.targetFlow - v.maxFlow, 2)} mm³/s above the entered hotend limit.`);
    $('flowWarnings').textContent = warnings.join(' ');

    const baseHeights = [0.10, 0.12, 0.16, 0.20, 0.24, 0.28, 0.32, 0.36, 0.40];
    if (!baseHeights.some(h => Math.abs(h - v.layerHeight) < 0.0001)) baseHeights.push(v.layerHeight);
    baseHeights.sort((a, b) => a - b);

    $('flowTableBody').innerHTML = baseHeights.map(h => {
      const q = v.lineWidth * h * v.speed;
      const vmax = v.maxFlow / (v.lineWidth * h);
      const vtarget = v.targetFlow / (v.lineWidth * h);
      const pct = q / v.maxFlow * 100;
      const current = Math.abs(h - v.layerHeight) < 0.0001 ? ' current-row' : '';
      return `<tr class="${loadClass(pct)}${current}"><td><b>${h.toFixed(2)} mm</b></td><td>${q.toFixed(2)} mm³/s</td><td><b>${Math.round(vtarget)} mm/s</b></td><td><b>${Math.round(vmax)} mm/s</b></td><td>${pct.toFixed(1)}%</td></tr>`;
    }).join('');

    const tableHead = root.querySelector('.flow-table-card thead tr');
    if (tableHead) tableHead.innerHTML = '<th>Layer height</th><th>Flow @ current speed</th><th>Speed @ target flow</th><th>Max speed @ flow limit</th><th>Flow load</th>';

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
    $('flowLineWidth').value = nozzle.toFixed(2);
    render();
  }));

  document.querySelectorAll('[data-flow-max]').forEach(btn => btn.addEventListener('click', () => {
    $('flowMax').value = btn.dataset.flowMax;
    render();
  }));

  $('flowAutoWidth').addEventListener('click', () => {
    const nozzle = pos('flowNozzle', defaults.nozzle);
    $('flowLineWidth').value = nozzle.toFixed(2);
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
