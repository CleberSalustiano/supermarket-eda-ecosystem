import { DomainValidationError } from '@supermarket/shared-domain';

import { ApprovalThrottle } from '#/domain/entities/approval-throttle.entity';
import { ApprovalThrottlePolicy } from '#/domain/value-objects/approval-throttle-policy';

const TENANT = '72ac8252-18c8-4d9c-84ff-866f297a1d77';
const MINUTE = 60_000;
const START = new Date('2026-11-23T10:00:00.000Z');

const at = (offsetMs: number) => new Date(START.getTime() + offsetMs);

const codePolicy = ApprovalThrottlePolicy.create({
  maxFailures: 3,
  windowMs: 15 * MINUTE,
  lockoutMs: 10 * MINUTE,
  resetOnSuccess: true
});
const registerPolicy = ApprovalThrottlePolicy.create({
  maxFailures: 3,
  windowMs: 15 * MINUTE,
  lockoutMs: 10 * MINUTE,
  resetOnSuccess: false
});

const openThrottle = () =>
  ApprovalThrottle.open({ tenantId: TENANT, scope: 'APPROVER_CODE', subject: 'MG-01' });

describe('ApprovalThrottle', () => {
  it('starts unlocked with no failures', () => {
    const throttle = openThrottle();

    expect(throttle.isLocked(START)).toBe(false);
    expect(throttle.toPrimitives()).toEqual({
      tenantId: TENANT,
      scope: 'APPROVER_CODE',
      subject: 'MG-01',
      failureCount: 0,
      windowStartedAt: null,
      lockedUntil: null
    });
  });

  it('counts failures within the window and locks at the maximum', () => {
    const throttle = openThrottle();

    throttle.registerFailure(at(0), codePolicy);
    throttle.registerFailure(at(MINUTE), codePolicy);

    expect(throttle.toPrimitives()).toMatchObject({
      failureCount: 2,
      windowStartedAt: START.toISOString(),
      lockedUntil: null
    });
    expect(throttle.isLocked(at(MINUTE))).toBe(false);

    throttle.registerFailure(at(2 * MINUTE), codePolicy);

    expect(throttle.toPrimitives()).toMatchObject({
      failureCount: 0,
      windowStartedAt: null,
      lockedUntil: at(12 * MINUTE).toISOString()
    });
    expect(throttle.isLocked(at(2 * MINUTE))).toBe(true);
  });

  it('stays locked until lockedUntil and unlocks exactly at it', () => {
    const throttle = openThrottle();

    for (let failure = 0; failure < 3; failure += 1) {
      throttle.registerFailure(at(0), codePolicy);
    }

    expect(throttle.isLocked(at(10 * MINUTE - 1))).toBe(true);
    expect(throttle.isLocked(at(10 * MINUTE))).toBe(false);
  });

  it('does not extend an active lockout with further failures', () => {
    const throttle = openThrottle();

    for (let failure = 0; failure < 3; failure += 1) {
      throttle.registerFailure(at(0), codePolicy);
    }

    throttle.registerFailure(at(5 * MINUTE), codePolicy);

    expect(throttle.toPrimitives()).toMatchObject({
      failureCount: 0,
      lockedUntil: at(10 * MINUTE).toISOString()
    });
  });

  it('starts a new window once windowMs has elapsed', () => {
    const throttle = openThrottle();

    throttle.registerFailure(at(0), codePolicy);
    throttle.registerFailure(at(MINUTE), codePolicy);
    throttle.registerFailure(at(15 * MINUTE), codePolicy);

    expect(throttle.toPrimitives()).toMatchObject({
      failureCount: 1,
      windowStartedAt: at(15 * MINUTE).toISOString(),
      lockedUntil: null
    });
  });

  it('counts a new lockout cycle after an expired lockout', () => {
    const throttle = openThrottle();

    for (let failure = 0; failure < 3; failure += 1) {
      throttle.registerFailure(at(0), codePolicy);
    }

    throttle.registerFailure(at(11 * MINUTE), codePolicy);

    expect(throttle.isLocked(at(11 * MINUTE))).toBe(false);
    expect(throttle.toPrimitives()).toMatchObject({
      failureCount: 1,
      windowStartedAt: at(11 * MINUTE).toISOString()
    });
  });

  it('resets the counter on success only when the policy says so', () => {
    const codeThrottle = openThrottle();
    const registerThrottle = ApprovalThrottle.open({
      tenantId: TENANT,
      scope: 'REGISTER',
      subject: 'register-01'
    });

    for (const throttle of [codeThrottle, registerThrottle]) {
      throttle.registerFailure(at(0), codePolicy);
      throttle.registerFailure(at(MINUTE), codePolicy);
    }

    codeThrottle.registerSuccess(codePolicy);
    registerThrottle.registerSuccess(registerPolicy);

    expect(codeThrottle.toPrimitives()).toMatchObject({ failureCount: 0, windowStartedAt: null });
    expect(registerThrottle.toPrimitives()).toMatchObject({
      failureCount: 2,
      windowStartedAt: START.toISOString()
    });
  });

  it('clears counters and lifts the lockout', () => {
    const throttle = openThrottle();

    for (let failure = 0; failure < 3; failure += 1) {
      throttle.registerFailure(at(0), codePolicy);
    }

    throttle.registerFailure(at(11 * MINUTE), codePolicy);
    throttle.clear();

    expect(throttle.isLocked(at(MINUTE))).toBe(false);
    expect(throttle.toPrimitives()).toMatchObject({
      failureCount: 0,
      windowStartedAt: null,
      lockedUntil: null
    });
  });

  it('rejects an empty or oversized subject and a negative counter', () => {
    expect(() =>
      ApprovalThrottle.open({ tenantId: TENANT, scope: 'REGISTER', subject: '' })
    ).toThrow(DomainValidationError);
    expect(() =>
      ApprovalThrottle.open({ tenantId: TENANT, scope: 'REGISTER', subject: 'r'.repeat(65) })
    ).toThrow(DomainValidationError);
    expect(() =>
      ApprovalThrottle.rehydrate({
        tenantId: TENANT,
        scope: 'REGISTER',
        subject: 'register-01',
        failureCount: -1,
        windowStartedAt: null,
        lockedUntil: null
      })
    ).toThrow(DomainValidationError);
  });
});

describe('ApprovalThrottlePolicy', () => {
  it('rejects non-positive or non-integer values', () => {
    for (const invalid of [0, -1, 1.5, Number.NaN]) {
      expect(() =>
        ApprovalThrottlePolicy.create({
          maxFailures: invalid,
          windowMs: MINUTE,
          lockoutMs: MINUTE,
          resetOnSuccess: true
        })
      ).toThrow(DomainValidationError);
    }
  });
});
