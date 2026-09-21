(() => {
  const REPO_NEW_ISSUE = 'https://github.com/Kamseder/AK3D-Motion-Lab/issues/new';
  const $ = id => document.getElementById(id);

  function allMotors() {
    let custom = [];
    try { custom = JSON.parse(localStorage.getItem('ak3d-custom-motors') || '[]'); } catch (_) {}
    return [...(window.AK3D_MOTORS || []), ...(Array.isArray(custom) ? custom : [])];
  }

  function nemaRank(nema) {
    const n = Number(nema);
    if (n === 17) return 0;
    if (n === 14) return 1;
    if (n === 23) return 2;
    return 10 + (Number.isFinite(n) ? n : 99);
  }

  function groupKey(m) {
    const nema = Number.isFinite(Number(m.nema)) ? Number(m.nema) : 'Other';
    const brand = String(m.brand || 'Other').trim() || 'Other';
    return { nema, brand, label: `NEMA ${nema} · ${brand}` };
  }

  function bodyLength(m) {
    const n = Number(m?.bodyLength);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function bodyLengthLabel(m) {
    const n = bodyLength(m);
    return n === null ? '? mm' : `${Number(n.toFixed(1))} mm`;
  }

  function compareMotorLengthThenModel(a, b) {
    const aLen = bodyLength(a);
    const bLen = bodyLength(b);
    if (aLen === null && bLen !== null) return 1;
    if (aLen !== null && bLen === null) return -1;
    if (aLen !== null && bLen !== null && aLen !== bLen) return aLen - bLen;
    return String(a.model || a.key).localeCompare(String(b.model || b.key), undefined, {numeric:true, sensitivity:'base'});
  }

  function sortedGroups() {
    const groups = new Map();
    allMotors().forEach(m => {
      const g = groupKey(m);
      const key = `${g.nema}|||${g.brand}`;
      if (!groups.has(key)) groups.set(key, { ...g, motors: [] });
      groups.get(key).motors.push(m);
    });
    return [...groups.values()].sort((a,b) => {
      const size = nemaRank(a.nema) - nemaRank(b.nema);
      return size || a.brand.localeCompare(b.brand, undefined, {sensitivity:'base'});
    }).map(g => ({
      ...g,
      motors: g.motors.sort(compareMotorLengthThenModel)
    }));
  }

  function rebuildSelect(select, blankLabel = null) {
    if (!select) return;
    const selected = select.value;
    const frag = document.createDocumentFragment();
    if (blankLabel !== null) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = blankLabel;
      frag.appendChild(empty);
    }
    sortedGroups().forEach(group => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;
      group.motors.forEach(m => {
        const option = document.createElement('option');
        option.value = m.key;
        option.textContent = `${bodyLengthLabel(m)} · ${m.model || m.key}`;
        optgroup.appendChild(option);
      });
      frag.appendChild(optgroup);
    });
    select.replaceChildren(frag);
    if ([...select.options].some(o => o.value === selected)) select.value = selected;
  }

  function sortMotorSelectors() {
    document.querySelectorAll('#motorSlots select').forEach(s => rebuildSelect(s, '— Select motor —'));
    rebuildSelect($('matrixMotor'), null);
  }

  function addSubmissionFields() {
    const box = $('customMotor');
    const grid = box?.querySelector('.field-grid');
    if (!box || !grid || $('cSource')) return;

    const brandLabel = document.createElement('label');
    brandLabel.innerHTML = '<span>Brand</span><input id="cBrand" placeholder="e.g. LDO, SIBOOR, OMC">';

    const nemaLabel = document.createElement('label');
    nemaLabel.innerHTML = '<span>NEMA size</span><select id="cNema"><option value="17" selected>NEMA 17</option><option value="14">NEMA 14</option><option value="23">NEMA 23</option><option value="other">Other</option></select>';

    const bodyLabel = document.createElement('label');
    bodyLabel.innerHTML = '<span>Body length</span><div class="input-unit"><input id="cBodyLength" type="number" step="0.1" min="0" placeholder="48"><b>mm</b></div>';

    const sourceLabel = document.createElement('label');
    sourceLabel.className = 'wide';
    sourceLabel.innerHTML = '<span>Datasheet / source URL</span><input id="cSource" type="url" placeholder="https://... or leave empty and attach a PDF in GitHub">';

    grid.appendChild(brandLabel);
    grid.appendChild(nemaLabel);
    grid.appendChild(bodyLabel);
    grid.appendChild(sourceLabel);

    const submit = document.createElement('button');
    submit.id = 'submitMotorDb';
    submit.type = 'button';
    submit.className = 'ghost full';
    submit.textContent = 'SUBMIT MOTOR TO DATABASE';
    submit.style.marginTop = '8px';

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Opens a pre-filled GitHub review request. Nothing is added to the public database until it has been checked and approved.';

    box.appendChild(submit);
    box.appendChild(hint);
    submit.addEventListener('click', submitMotorRequest);
  }

  function value(id) { return $(id)?.value?.trim?.() ?? ''; }
  function numberValue(id) {
    const raw = $(id)?.value;
    if (raw === '' || raw == null) return '';
    const v = Number(raw);
    return Number.isFinite(v) ? v : '';
  }

  function enrichNewestCustomMotor() {
    let custom = [];
    try { custom = JSON.parse(localStorage.getItem('ak3d-custom-motors') || '[]'); } catch (_) { return; }
    if (!Array.isArray(custom) || !custom.length) return;
    const newest = custom[custom.length - 1];
    const brand = value('cBrand');
    const nemaRaw = value('cNema');
    const length = numberValue('cBodyLength');
    if (brand) newest.brand = brand;
    if (nemaRaw && nemaRaw !== 'other' && Number.isFinite(Number(nemaRaw))) newest.nema = Number(nemaRaw);
    if (length !== '') newest.bodyLength = length;
    localStorage.setItem('ak3d-custom-motors', JSON.stringify(custom));
  }

  function submitMotorRequest() {
    const model = value('cName');
    const brand = value('cBrand');
    const source = value('cSource');
    const nemaRaw = value('cNema');
    if (!model) return alert('Please enter the motor model/name first.');

    const nema = nemaRaw === 'other' ? 'Other / please specify' : nemaRaw;
    const title = `[Motor submission] ${brand ? brand + ' ' : ''}${model}`;
    const body = [
      '## Motor submission',
      '',
      `**Brand:** ${brand || 'Unknown / not entered'}`,
      `**Model:** ${model}`,
      `**NEMA size:** ${nema}`,
      `**Body length:** ${numberValue('cBodyLength') || 'Not entered'}${numberValue('cBodyLength') ? ' mm' : ''}`,
      `**Rated current:** ${numberValue('cCurrent')} A`,
      `**Holding torque:** ${numberValue('cTorque')} N·cm`,
      `**Inductance:** ${numberValue('cInduct')} mH`,
      `**Resistance:** ${numberValue('cRes')} Ω`,
      `**Rotor inertia:** ${numberValue('cInertia')} g·cm²`,
      `**Step angle:** ${numberValue('cStep')}°`,
      '',
      '## Verification source',
      source || '_No URL entered — please attach the datasheet/PDF/image to this issue._',
      '',
      '> A source is required before the motor should be accepted into the public database.',
      '',
      '## Review checklist',
      '- [ ] Model / manufacturer verified',
      '- [ ] Electrical values checked against source',
      '- [ ] Units checked',
      '- [ ] Duplicate checked',
      '- [ ] Ready to add to `motors.js`',
      '',
      '_Submitted from AK3D Motion Lab. Submission does not automatically modify the motor database._'
    ].join('\n');

    const url = `${REPO_NEW_ISSUE}?template=motor-submission.md&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function refreshAfterUiChange(event) {
    const target = event.target;
    if (!target) return;
    if (target.id === 'addCustom') {
      setTimeout(() => {
        enrichNewestCustomMotor();
        sortMotorSelectors();
      }, 0);
      return;
    }
    if (target.closest?.('#motorSlots') || target.id === 'addMotorSlot' || target.id === 'matrixMotor') {
      setTimeout(sortMotorSelectors, 0);
    }
  }

  function init() {
    addSubmissionFields();
    setTimeout(sortMotorSelectors, 0);
    document.addEventListener('click', refreshAfterUiChange);
    document.addEventListener('change', refreshAfterUiChange);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
