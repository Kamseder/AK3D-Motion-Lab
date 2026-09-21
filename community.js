(() => {
  const REPO_NEW_ISSUE = 'https://github.com/Kamseder/AK3D-Motion-Lab/issues/new';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
      motors: g.motors.sort((a,b) => String(a.model || a.key).localeCompare(String(b.model || b.key), undefined, {numeric:true, sensitivity:'base'}))
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
        option.textContent = m.model || m.key;
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

    const sourceLabel = document.createElement('label');
    sourceLabel.className = 'wide';
    sourceLabel.innerHTML = '<span>Datasheet / source URL</span><input id="cSource" type="url" placeholder="https://... datasheet, product page or PDF">';

    grid.appendChild(brandLabel);
    grid.appendChild(nemaLabel);
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
    const v = Number($(id)?.value);
    return Number.isFinite(v) ? v : '';
  }

  function submitMotorRequest() {
    const model = value('cName');
    const brand = value('cBrand');
    const source = value('cSource');
    const nemaRaw = value('cNema');
    if (!model) return alert('Please enter the motor model/name first.');
    if (!source) return alert('Please add a datasheet, product page or PDF source URL so the motor can be verified.');

    const nema = nemaRaw === 'other' ? 'Other / please specify' : nemaRaw;
    const title = `[Motor submission] ${brand ? brand + ' ' : ''}${model}`;
    const body = [
      '## Motor submission',
      '',
      `**Brand:** ${brand || 'Unknown / not entered'}`,
      `**Model:** ${model}`,
      `**NEMA size:** ${nema}`,
      `**Rated current:** ${numberValue('cCurrent')} A`,
      `**Holding torque:** ${numberValue('cTorque')} N·cm`,
      `**Inductance:** ${numberValue('cInduct')} mH`,
      `**Resistance:** ${numberValue('cRes')} Ω`,
      `**Rotor inertia:** ${numberValue('cInertia')} g·cm²`,
      `**Step angle:** ${numberValue('cStep')}°`,
      '',
      '## Verification source',
      source,
      '',
      '> If the source is a local PDF or image, please attach it to this issue after GitHub opens.',
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

    const url = `${REPO_NEW_ISSUE}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function refreshAfterUiChange(event) {
    const target = event.target;
    if (!target) return;
    if (target.closest?.('#motorSlots') || target.id === 'addMotorSlot' || target.id === 'addCustom' || target.id === 'matrixMotor') {
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
