/** Test accounts are recognisable by email, so the global teardown can remove them. */
export const E2E_EMAIL_PREFIX = 'e2e-';
export const E2E_EMAIL_DOMAIN = '@openmusic.test';

export function newTestAccount() {
  const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    runId,
    email: `${E2E_EMAIL_PREFIX}${runId}${E2E_EMAIL_DOMAIN}`,
    username: `e2e_${runId}`.slice(0, 20),
    password: 'e2e-password-long-enough',
  };
}
