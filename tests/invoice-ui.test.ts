import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildPaymentSchedule,
  formatMoney,
  methodLabel,
  parseMoneyToCents,
  splitAmount,
} from '../components/invoices/invoiceUtils';

describe('invoice UI utilities', () => {
  it('parses display money into cents', () => {
    assert.equal(parseMoneyToCents('$1,250.50'), 125050);
    assert.equal(parseMoneyToCents('900'), 90000);
    assert.equal(parseMoneyToCents(''), 0);
  });

  it('formats cents with currency codes', () => {
    assert.equal(formatMoney(125000, 'USD'), '$1,250');
    assert.equal(formatMoney(125050, 'USD'), '$1,250.50');
  });

  it('splits uneven amounts into stable milestones', () => {
    assert.deepEqual(splitAmount(10000, 3), [3333, 3333, 3334]);
  });

  it('builds the three commission payment schedules', () => {
    assert.equal(buildPaymentSchedule(90000, 'single').length, 1);
    assert.deepEqual(buildPaymentSchedule(90000, 'two_part').map(item => item.amountCents), [45000, 45000]);
    assert.deepEqual(buildPaymentSchedule(90000, 'three_part').map(item => item.amountCents), [30000, 30000, 30000]);
  });

  it('labels crypto payment methods clearly', () => {
    assert.equal(methodLabel('crypto'), 'Crypto');
  });
});
