(() => {
  const REPO_NEW_ISSUE = 'https://github.com/Kamseder/AK3D-Motion-Lab/issues/new';
  const $ = id => document.getElementById(id);

  function addSubmissionFields() {
    const box = $('customMotor');
    const grid = box?.querySelector('.field-grid');
    if (!box || !grid || $('cSource')) return;

    const localButton = $('addCustom');
    if (localButton) localButton.textContent = 'ADD STEPPER LOCALLY';

    const toggle = $('customToggle');
    if (toggle) toggle.textContent = '+ CUSTOM STEPPER';

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
    submit.className = 'ghost full motor-db-action';
    submit.textContent = 'SUBMIT STEPPER TO DATABASE';

    const hint = document.createElement('p');
    hint.className = 'hint custom-motor-action-hint';
    hint.textContent = 'ADD STEPPER LOCALLY saves the stepper only in this browser. SUBMIT STEPPER TO DATABASE opens a GitHub review request; nothing enters the public database until it has been checked and approved.';

    box.appendChild(submit);
    box.appendChild(hint);
    submit.addEventListener('click', submitStepperRequest);
  }

  function value(id) { return $(id)?.value?.trim?.() ?? ''; }
  function numberValue(id) {
    const raw = $(id)?.value;
    if (raw === '' || raw == null) return '';
    const v = Number(raw);
    return Number.isFinite(v) ? v : '';
  }

  function submitStepperRequest() {
    const model = value('cName');
    const brand = value('cBrand');
    const source = value('cSource');
    const nemaRaw = value('cNema');
    if (!model) return alert('Please enter the stepper model/name first.');

    const nema = nemaRaw === 'other' ? 'Other / please specify' : nemaRaw;
    const title = `[Stepper submission] ${brand ? brand + ' ' : ''}${model}`;
    const body = [
      '## Stepper submission',
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
      '> A source is required before the stepper should be accepted into the public database.',
      '',
      '## Review checklist',
      '- [ ] Model / manufacturer verified',
      '- [ ] Electrical values checked against source',
      '- [ ] Units checked',
      '- [ ] Duplicate checked',
      '- [ ] Ready to add to `motors.js`',
      '',
      '_Submitted from AK3D Motion Lab. Submission does not automatically modify the stepper database._'
    ].join('\n');

    const url = `${REPO_NEW_ISSUE}?template=motor-submission.md&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function init() {
    addSubmissionFields();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
