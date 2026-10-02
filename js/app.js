/* 页面层：读取输入、调用逐月计算、把同一份结果渲染到卡片/图/表。 */
(function () {
  'use strict';
  const { analyzeLoan, formatCurrency } = window.LoanMath;
  const { renderLineChart, renderInterestChart } = window.LoanCharts;
  const form = document.getElementById('loan-form');
  const results = document.getElementById('results');
  const termInput = document.getElementById('term');
  const status = document.getElementById('form-status');
  const scheduleBody = document.getElementById('schedule-body');
  const toggleButton = document.getElementById('toggle-schedule');
  const tabs = [...document.querySelectorAll('.tab')];
  let analysis = null;
  let activeMethod = 'equalPayment';
  let showAll = false;
  let currentUnit = 'year';
  let inputTimer = null;

  function text(id, value) { document.getElementById(id).textContent = value; }
  function readInput() {
    return {
      principal: form.elements.principal.value,
      term: form.elements.term.value,
      termUnit: form.elements.termUnit.value,
      annualRate: form.elements.annualRate.value,
    };
  }
  function resetErrors() {
    status.textContent = '';
    for (const [field, inputId] of [['principal', 'principal'], ['term', 'term'], ['annualRate', 'annual-rate']]) {
      text(`${field}-error`, '');
      const input = document.getElementById(inputId);
      input.removeAttribute('aria-invalid');
      input.closest('.input-shell').classList.remove('is-invalid');
    }
  }
  function showError(error) {
    const field = error.field || 'principal';
    const inputId = field === 'annualRate' ? 'annual-rate' : field;
    const input = document.getElementById(inputId);
    text(`${field}-error`, error.message);
    input.setAttribute('aria-invalid', 'true');
    input.closest('.input-shell').classList.add('is-invalid');
    status.textContent = '请先修正标红的输入条件。';
    results.hidden = true;
    analysis = null;
  }
  function termLabel(months) {
    const years = Math.floor(months / 12);
    const leftover = months % 12;
    const readable = years === 0 ? `${months} 个月` : leftover === 0 ? `${years} 年` : `${years} 年 ${leftover} 个月`;
    return `${readable} · 共 ${months} 期`;
  }

  function renderSummary() {
    const { input, equalPayment: a, equalPrincipal: p, interestSaving, firstPaymentGap } = analysis;
    const firstA = a.rows[0];
    const firstP = p.rows[0];
    const lastA = a.rows.at(-1);
    const lastP = p.rows.at(-1);
    text('result-context', `${formatCurrency(input.principal)} · ${termLabel(input.months)} · 年利率 ${input.annualRatePercent}%`);
    text('interest-saving', formatCurrency(Math.max(0, interestSaving)));
    text('first-gap', formatCurrency(Math.max(0, firstPaymentGap)));
    text('total-months', `${input.months} 期`);

    text('annuity-monthly', formatCurrency(firstA.payment));
    text('annuity-interest', formatCurrency(a.totalInterest));
    text('annuity-total', formatCurrency(a.totalPayment));
    text('annuity-split', `${formatCurrency(firstA.principal)} / ${formatCurrency(firstA.interest)}`);
    text('principal-first', formatCurrency(firstP.payment));
    text('principal-last', formatCurrency(lastP.payment));
    text('principal-decline', input.months > 1 ? `每月约减少 ${formatCurrency(firstP.payment - p.rows[1].payment)}` : '只有 1 期，月供不发生递减');
    text('principal-interest', formatCurrency(p.totalInterest));
    text('principal-total', formatCurrency(p.totalPayment));
    text('principal-fixed', formatCurrency(firstP.principal));

    for (const [id, value] of [
      ['compare-first-annuity', firstA.payment], ['compare-first-principal', firstP.payment],
      ['compare-last-annuity', lastA.payment], ['compare-last-principal', lastP.payment],
      ['compare-interest-annuity', a.totalInterest], ['compare-interest-principal', p.totalInterest],
      ['compare-total-annuity', a.totalPayment], ['compare-total-principal', p.totalPayment],
    ]) text(id, formatCurrency(value));
  }

  function renderCharts() {
    const { equalPayment, equalPrincipal, interestSaving } = analysis;
    const plans = { equalPayment, equalPrincipal };
    renderLineChart(document.getElementById('payment-chart'), plans, 'payment', '每月还款额变化：等额本息保持基本不变，等额本金随月份下降');
    renderLineChart(document.getElementById('balance-chart'), plans, 'remaining', '剩余本金变化：两种还款方式的余额均逐月降至零', { zeroBase: true });
    renderInterestChart(document.getElementById('interest-chart'), equalPayment, equalPrincipal, formatCurrency);
    text('interest-note', interestSaving > .005
      ? `按当前条件，等额本金的总利息比等额本息少 ${formatCurrency(interestSaving)}。`
      : '按当前条件，两种方式的总利息相同。');
  }

  function renderSchedule() {
    const plan = analysis[activeMethod];
    const shownRows = showAll ? plan.rows : plan.rows.slice(0, 12);
    const fragment = document.createDocumentFragment();
    for (const row of shownRows) {
      const tr = document.createElement('tr');
      const cells = [row.period, row.payment, row.principal, row.interest, row.remaining];
      cells.forEach((value, index) => {
        const cell = document.createElement('td');
        cell.textContent = index === 0 ? `第 ${value} 期` : formatCurrency(value);
        tr.append(cell);
      });
      fragment.append(tr);
    }
    scheduleBody.replaceChildren(fragment);
    text('schedule-count', showAll ? `显示全部 ${plan.rows.length} 期` : `显示前 ${shownRows.length} 期 / 共 ${plan.rows.length} 期`);
    toggleButton.hidden = plan.rows.length <= 12;
    toggleButton.setAttribute('aria-expanded', String(showAll));
    toggleButton.innerHTML = showAll ? '收起还款计划 <span aria-hidden="true">↑</span>' : '查看完整还款计划 <span aria-hidden="true">↓</span>';
    for (const tab of tabs) {
      const selected = tab.dataset.method === activeMethod;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    document.getElementById('schedule-panel').setAttribute('aria-labelledby', activeMethod === 'equalPayment' ? 'tab-annuity' : 'tab-principal');
  }

  function renderInsights() {
    const { input, equalPayment: a, equalPrincipal: p, interestSaving, firstPaymentGap } = analysis;
    text('insight-annuity', `等额本息每期约还 ${formatCurrency(a.rows[0].payment)}，适合希望月供稳定、方便安排固定预算的借款人。`);
    text('insight-principal', interestSaving > .005
      ? `等额本金在当前条件下可少付 ${formatCurrency(interestSaving)} 利息，适合能承受较高前期月供、看重长期利息成本的人。`
      : '在当前条件下，两种方式的利息成本相同，可更多考虑每月资金安排。');
    const crossing = p.rows.find((row, index) => index > 0 && row.payment < a.rows[index].payment - .005);
    text('insight-decision', firstPaymentGap > .005
      ? `等额本金首月多还 ${formatCurrency(firstPaymentGap)}${crossing ? `，到第 ${crossing.period} 期月供低于等额本息` : ''}。请先确认前期现金流能否承受。`
      : `这笔 ${input.months} 期贷款中两种方式的首月月供相同，可结合自身资金安排判断。`);
  }

  function calculateAndRender() {
    resetErrors();
    try {
      analysis = analyzeLoan(readInput());
      renderSummary();
      renderCharts();
      renderSchedule();
      renderInsights();
      results.hidden = false;
    } catch (error) {
      showError(error);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(inputTimer);
    calculateAndRender();
  });
  for (const input of [form.elements.principal, termInput, form.elements.annualRate]) {
    input.addEventListener('input', () => {
      results.hidden = true;
      clearTimeout(inputTimer);
      inputTimer = setTimeout(calculateAndRender, 280);
    });
  }
  for (const radio of form.querySelectorAll('input[name="termUnit"]')) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const value = Number(termInput.value);
      if (Number.isFinite(value) && value > 0) {
        const converted = currentUnit === 'year' ? value * 12 : value / 12;
        termInput.value = Number(converted.toFixed(8));
      }
      currentUnit = radio.value;
      text('term-unit-label', radio.value === 'year' ? '年' : '月');
      calculateAndRender();
    });
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      activeMethod = tab.dataset.method;
      if (analysis) renderSchedule();
    });
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const target = tabs.find((item) => item !== tab);
      target.focus();
      target.click();
    });
  }
  toggleButton.addEventListener('click', () => {
    showAll = !showAll;
    if (analysis) renderSchedule();
  });
  document.getElementById('download-csv').addEventListener('click', () => {
    if (!analysis) return;
    const label = activeMethod === 'equalPayment' ? '等额本息' : '等额本金';
    const rows = analysis[activeMethod].rows;
    const lines = ['期数,每月还款额（元）,偿还本金（元）,偿还利息（元）,剩余本金（元）'];
    for (const row of rows) lines.push([row.period, row.payment, row.principal, row.interest, row.remaining].map((value, index) => index === 0 ? value : value.toFixed(2)).join(','));
    const blob = new Blob(['\ufeff', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${label}_${analysis.input.months}期还款计划.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  calculateAndRender();
})();
