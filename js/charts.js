/* 图表只读取计算结果，不参与贷款计算。SVG 可缩放，手机与桌面共用。 */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  function svgNode(tag, attributes, label) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes || {})) node.setAttribute(key, String(value));
    if (label !== undefined) node.textContent = label;
    return node;
  }

  function shortMoney(value) {
    const abs = Math.abs(value);
    if (abs >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}万`;
    if (abs >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}千`;
    return Math.round(value).toLocaleString('zh-CN');
  }

  function sampleRows(rows, maxPoints = 72) {
    if (rows.length <= maxPoints) return rows;
    const stride = Math.ceil((rows.length - 1) / (maxPoints - 1));
    const sample = rows.filter((_, index) => index % stride === 0);
    if (sample.at(-1) !== rows.at(-1)) sample.push(rows.at(-1));
    return sample;
  }

  function renderLineChart(container, plans, property, ariaLabel, options = {}) {
    container.replaceChildren();
    const width = 640;
    const height = 280;
    const plot = { left: 57, top: 15, right: 13, bottom: 37 };
    const plotWidth = width - plot.left - plot.right;
    const plotHeight = height - plot.top - plot.bottom;
    const rowsA = sampleRows(plans.equalPayment.rows);
    const rowsB = sampleRows(plans.equalPrincipal.rows);
    const values = [...rowsA, ...rowsB].map((row) => row[property]);
    const minValue = options.zeroBase ? 0 : Math.min(...values);
    const maxValue = Math.max(...values);
    const spread = Math.max(maxValue - minValue, Math.abs(maxValue) * .08, 1);
    const yMin = options.zeroBase ? 0 : Math.max(0, minValue - spread * .14);
    const yMax = maxValue + spread * .12;
    const months = plans.equalPayment.rows.length;
    const x = (period) => plot.left + (months === 1 ? plotWidth / 2 : (period - 1) / (months - 1) * plotWidth);
    const y = (value) => plot.top + (yMax - value) / (yMax - yMin) * plotHeight;

    const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': ariaLabel, preserveAspectRatio: 'xMidYMid meet' });
    const title = svgNode('title', {}, ariaLabel);
    svg.append(title);
    for (let tick = 0; tick <= 4; tick += 1) {
      const value = yMin + (yMax - yMin) * (4 - tick) / 4;
      const yy = plot.top + plotHeight * tick / 4;
      svg.append(svgNode('line', { x1: plot.left, y1: yy, x2: width - plot.right, y2: yy, class: 'grid-line' }));
      svg.append(svgNode('text', { x: plot.left - 9, y: yy + 4, 'text-anchor': 'end' }, shortMoney(value)));
    }
    svg.append(svgNode('line', { x1: plot.left, y1: plot.top, x2: plot.left, y2: plot.top + plotHeight, class: 'axis-line' }));
    const xTicks = months === 1 ? [1] : [1, Math.round((months + 1) / 2), months];
    for (const period of [...new Set(xTicks)]) {
      svg.append(svgNode('text', { x: x(period), y: height - 8, 'text-anchor': period === 1 && months !== 1 ? 'start' : period === months && months !== 1 ? 'end' : 'middle' }, `${period}期`));
    }

    for (const [key, sampled] of [['equalPayment', rowsA], ['equalPrincipal', rowsB]]) {
      const points = sampled.map((row) => `${x(row.period).toFixed(2)},${y(row[property]).toFixed(2)}`);
      const path = svgNode('polyline', {
        points: points.join(' '), fill: 'none', class: key === 'equalPayment' ? 'line-annuity' : 'line-principal',
        'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        ...(key === 'equalPrincipal' ? { 'stroke-dasharray': '7 5' } : {}),
      });
      svg.append(path);
      const finalRow = sampled.at(-1);
      svg.append(svgNode('circle', { cx: x(finalRow.period), cy: y(finalRow[property]), r: 4.5, fill: key === 'equalPayment' ? '#5a6ee5' : '#138f84', stroke: '#fff', 'stroke-width': 2 }));
    }
    container.append(svg);
  }

  function renderInterestChart(container, equalPayment, equalPrincipal, formatCurrency) {
    container.replaceChildren();
    const maximum = Math.max(equalPayment.totalInterest, equalPrincipal.totalInterest, 1);
    for (const [label, value, className] of [
      ['等额本息', equalPayment.totalInterest, 'annuity'],
      ['等额本金', equalPrincipal.totalInterest, 'principal'],
    ]) {
      const row = document.createElement('div');
      row.className = 'interest-row';
      const name = document.createElement('span');
      name.textContent = label;
      const track = document.createElement('div');
      track.className = 'interest-track';
      track.setAttribute('role', 'img');
      track.setAttribute('aria-label', `${label}总利息${formatCurrency(value)}`);
      const fill = document.createElement('div');
      fill.className = `interest-fill ${className}`;
      fill.style.width = `${value / maximum * 100}%`;
      track.append(fill);
      const amount = document.createElement('strong');
      amount.textContent = formatCurrency(value);
      row.append(name, track, amount);
      container.append(row);
    }
  }

  root.LoanCharts = { renderLineChart, renderInterestChart };
})(window);
