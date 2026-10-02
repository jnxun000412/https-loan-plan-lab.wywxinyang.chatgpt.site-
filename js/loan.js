/* 贷款计算层：与页面无关，逐期复现课堂 Excel 的期初余额 → 利息 → 本金 → 期末余额。 */
(function (root) {
  'use strict';

  const moneyFormatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function numericValue(value) {
    if (typeof value === 'number') return value;
    const cleaned = String(value ?? '').replace(/[,，\s]/g, '');
    return cleaned === '' ? NaN : Number(cleaned);
  }

  function invalid(field, message) {
    const error = new Error(message);
    error.field = field;
    throw error;
  }

  function normalizeInput(raw) {
    const principal = numericValue(raw.principal);
    const term = numericValue(raw.term);
    const annualRatePercent = numericValue(raw.annualRate);
    const unit = raw.termUnit;

    if (!Number.isFinite(principal) || principal < 1000 || principal > 100000000) {
      invalid('principal', '贷款金额须在 1,000 元至 1 亿元之间');
    }
    if (unit !== 'year' && unit !== 'month') {
      invalid('term', '请选择按年或按月输入贷款期限');
    }
    const exactMonths = unit === 'year' ? term * 12 : term;
    const months = Math.round(exactMonths);
    if (!Number.isFinite(term) || months < 1 || months > 600 || Math.abs(exactMonths - months) > 1e-6) {
      invalid('term', '贷款期限须为 1 至 600 个整月（按年输入可使用 1.5 年等）');
    }
    if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0 || annualRatePercent > 30) {
      invalid('annualRate', '年利率须在 0% 至 30% 之间');
    }

    const annualRate = annualRatePercent / 100;
    return {
      principal,
      months,
      annualRate,
      annualRatePercent,
      monthlyRate: annualRate / 12,
    };
  }

  function summarize(method, rows) {
    return {
      method,
      rows,
      totalPayment: rows.reduce((sum, row) => sum + row.payment, 0),
      totalInterest: rows.reduce((sum, row) => sum + row.interest, 0),
    };
  }

  function createEqualPaymentPlan(input) {
    const { principal, months, monthlyRate: rate } = input;
    const fixedPayment = rate === 0
      ? principal / months
      : principal * rate / (1 - Math.pow(1 + rate, -months));
    const rows = [];
    let balance = principal;

    for (let period = 1; period <= months; period += 1) {
      const opening = balance;
      const interest = opening * rate;
      // 末期取实际余额，只消除 IEEE 754 浮点尾差。
      const principalPart = period === months ? opening : fixedPayment - interest;
      const payment = principalPart + interest;
      balance = period === months ? 0 : opening - principalPart;
      rows.push({ period, opening, payment, principal: principalPart, interest, remaining: balance });
    }
    return summarize('equalPayment', rows);
  }

  function createEqualPrincipalPlan(input) {
    const { principal, months, monthlyRate: rate } = input;
    const fixedPrincipal = principal / months;
    const rows = [];
    let balance = principal;

    for (let period = 1; period <= months; period += 1) {
      const opening = balance;
      const principalPart = period === months ? opening : fixedPrincipal;
      const interest = opening * rate;
      const payment = principalPart + interest;
      balance = period === months ? 0 : opening - principalPart;
      rows.push({ period, opening, payment, principal: principalPart, interest, remaining: balance });
    }
    return summarize('equalPrincipal', rows);
  }

  function analyzeLoan(raw) {
    const input = normalizeInput(raw);
    const equalPayment = createEqualPaymentPlan(input);
    const equalPrincipal = createEqualPrincipalPlan(input);
    return {
      input,
      equalPayment,
      equalPrincipal,
      interestSaving: equalPayment.totalInterest - equalPrincipal.totalInterest,
      firstPaymentGap: equalPrincipal.rows[0].payment - equalPayment.rows[0].payment,
    };
  }

  const api = {
    normalizeInput,
    createEqualPaymentPlan,
    createEqualPrincipalPlan,
    analyzeLoan,
    formatCurrency(value) { return moneyFormatter.format(value); },
  };

  root.LoanMath = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
