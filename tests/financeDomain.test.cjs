const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FINANCE_STATUSES,
  appendHistory,
  assertCurrency,
  calculateBudgetPerformance,
  canEditFinanceRecord,
  commitmentOutstandingAmount,
  isWithinQuarter,
  nextReviewStatus,
  positiveAmount,
  summarizePerformanceByCurrency,
} = require('../lib/financeDomain');

test('budget performance preserves original budget and derives transfers and spend', () => {
  const lines = [
    { $id: 'a', status: 'approved', originalAmount: 1000, currency: 'UGX' },
    { $id: 'b', status: 'approved', originalAmount: 500, currency: 'UGX' },
  ];
  const expenses = [
    { budgetLineId: 'a', amount: 200, status: 'approved' },
    { budgetLineId: 'a', amount: 99, status: 'submitted' },
  ];
  const reallocations = [
    { fromBudgetLineId: 'a', toBudgetLineId: 'b', amount: 100, status: 'approved' },
  ];
  const adjustments = [
    { budgetLineId: 'a', amount: 20, adjustmentType: 'decrease', status: 'approved' },
  ];

  const [a, b] = calculateBudgetPerformance(lines, expenses, reallocations, adjustments);
  assert.equal(a.originalBudget, 1000);
  assert.equal(a.transfersOut, 100);
  assert.equal(a.revisedBudget, 900);
  assert.equal(a.approvedSpend, 180);
  assert.equal(a.availableBalance, 720);
  assert.equal(a.utilisation, 20);
  assert.equal(b.revisedBudget, 600);
});

test('mixed currencies remain separate', () => {
  const groups = summarizePerformanceByCurrency([
    { currency: 'UGX', originalBudget: 1000, revisedBudget: 900, approvedSpend: 100, availableBalance: 800 },
    { currency: 'USD', originalBudget: 50, revisedBudget: 50, approvedSpend: 10, availableBalance: 40 },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.currency).sort(), ['UGX', 'USD']);
});

test('approved records cannot be edited and returned records can only be edited by their creator', () => {
  assert.equal(canEditFinanceRecord({ status: FINANCE_STATUSES.APPROVED, createdBy: 'u1' }, 'u1'), false);
  assert.equal(canEditFinanceRecord({ status: FINANCE_STATUSES.RETURNED, createdBy: 'u1' }, 'u1'), true);
  assert.equal(canEditFinanceRecord({ status: FINANCE_STATUSES.RETURNED, createdBy: 'u1' }, 'u2'), false);
});

test('review transitions and history are explicit', () => {
  assert.equal(nextReviewStatus('approve'), 'approved');
  assert.equal(nextReviewStatus('return'), 'returned');
  assert.equal(nextReviewStatus('reject'), 'rejected');
  assert.throws(() => nextReviewStatus('skip'));
  const history = JSON.parse(appendHistory('', { action: 'submitted', actorId: 'u1' }));
  assert.equal(history[0].action, 'submitted');
});

test('quarter boundaries are UTC-safe and end-exclusive', () => {
  assert.equal(isWithinQuarter('2026-03-31T23:59:59.999Z', 2026, 1), true);
  assert.equal(isWithinQuarter('2026-04-01T00:00:00.000Z', 2026, 1), false);
  assert.equal(isWithinQuarter('2026-04-01T00:00:00.000Z', 2026, 2), true);
});

test('zero revised budgets never divide by zero and still expose overspend', () => {
  const [line] = calculateBudgetPerformance(
    [{ $id: 'zero', status: 'approved', originalAmount: 100, currency: 'USD' }],
    [{ budgetLineId: 'zero', amount: 10, status: 'approved' }],
    [{ fromBudgetLineId: 'zero', toBudgetLineId: 'elsewhere', amount: 100, status: 'approved' }],
  );
  assert.equal(line.revisedBudget, 0);
  assert.equal(line.utilisation, 0);
  assert.equal(line.availableBalance, -10);
  assert.equal(line.isOverBudget, true);
});

test('only approved adjustments change approved spend', () => {
  const [line] = calculateBudgetPerformance(
    [{ $id: 'a', status: 'approved', originalAmount: 1000, currency: 'EUR' }],
    [{ $id: 'expense', budgetLineId: 'a', amount: 300, status: 'approved' }],
    [],
    [
      { budgetLineId: 'a', amount: 50, adjustmentType: 'increase', status: 'approved' },
      { budgetLineId: 'a', amount: 25, adjustmentType: 'decrease', status: 'approved' },
      { budgetLineId: 'a', amount: 100, adjustmentType: 'reversal', status: 'submitted' },
    ],
  );
  assert.equal(line.approvedSpend, 325);
  assert.equal(line.availableBalance, 675);
});

test('an outstanding commitment reduces available balance without double-counting once partially converted to an approved expense', () => {
  const lines = [{ $id: 'a', status: 'approved', originalAmount: 4000, currency: 'USD' }];
  const commitment = { $id: 'c1', budgetLineId: 'a', currency: 'USD', amount: 800, status: 'approved' };
  const linkedExpense = { $id: 'e1', budgetLineId: 'a', currency: 'USD', amount: 500, status: 'approved', commitmentId: 'c1' };

  // Before conversion: full 800 is outstanding, nothing spent yet.
  assert.equal(commitmentOutstandingAmount(commitment, [], []), 800);

  // After a 500 approved expense links against it: 300 remains outstanding —
  // never 800 + 500 (that would double-count the same obligation).
  assert.equal(commitmentOutstandingAmount(commitment, [linkedExpense], []), 300);

  const [line] = calculateBudgetPerformance(lines, [linkedExpense], [], [], [commitment]);
  assert.equal(line.actualSpend, 500);
  assert.equal(line.committedAmount, 300);
  assert.equal(line.consumption, 800);
  assert.equal(line.availableBalance, 3200);
  // The hard "actual overspend" ceiling ignores commitments by design —
  // outstanding obligations are a planning signal, not cash already spent.
  assert.equal(line.actualAvailableBalance, 3500);
});

test('committed amounts summarize per currency alongside spend, never mixed across currencies', () => {
  const groups = summarizePerformanceByCurrency([
    { currency: 'UGX', originalBudget: 1000, revisedBudget: 900, approvedSpend: 100, actualSpend: 100, committedAmount: 50, availableBalance: 750 },
    { currency: 'USD', originalBudget: 50, revisedBudget: 50, approvedSpend: 10, actualSpend: 10, committedAmount: 5, availableBalance: 35 },
  ]);
  const ugx = groups.find((group) => group.currency === 'UGX');
  const usd = groups.find((group) => group.currency === 'USD');
  assert.equal(ugx.committedAmount, 50);
  assert.equal(usd.committedAmount, 5);
  assert.notEqual(ugx.committedAmount + usd.committedAmount, groups[0].committedAmount); // never merged into one group
});

test('quarter-selected spend can be isolated from cumulative spend (mirrors buildProjectAnalytics period logic)', () => {
  const expenses = [
    { budgetLineId: 'a', amount: 1200, status: 'approved', expenseDate: '2026-02-01T00:00:00Z' }, // Q1
    { budgetLineId: 'a', amount: 3700, status: 'approved', expenseDate: '2026-08-01T00:00:00Z' }, // Q3
    { budgetLineId: 'a', amount: 500, status: 'approved', expenseDate: '2026-08-15T00:00:00Z' }, // Q3
  ];
  const cumulative = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const q3Only = expenses
    .filter((expense) => isWithinQuarter(expense.expenseDate, 2026, 3))
    .reduce((sum, expense) => sum + expense.amount, 0);
  assert.equal(cumulative, 5400);
  assert.equal(q3Only, 4200);
  assert.notEqual(q3Only, cumulative); // period spend must never be reported as if it were total Actual Spend
});

test('domain validation rejects unsupported currencies and non-positive amounts', () => {
  assert.equal(assertCurrency('UGX'), 'UGX');
  assert.throws(() => assertCurrency('JPY'));
  assert.throws(() => positiveAmount(0));
  assert.throws(() => positiveAmount(-1));
  assert.throws(() => isWithinQuarter('2026-01-01T00:00:00Z', 2026, 5));
});
