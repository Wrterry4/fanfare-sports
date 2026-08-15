/**
 * callable.js — Cloud Function errors people can act on.
 *
 * A callable that isn't deployed fails with `functions/not-found` or
 * `internal`, which surfaces as "an internal error occurred" — indistinguishable
 * from a bug in the function itself. Since a failed `firebase deploy --only
 * functions` is the single most likely reason anything here breaks, it's worth
 * naming.
 */

import { httpsCallable, functions } from './firebase';

export const CALLABLE_NOT_DEPLOYED = 'not_deployed';

export async function call(name, data) {
  try {
    const res = await httpsCallable(functions, name)(data);
    return res.data;
  } catch (e) {
    const code = e?.code || '';
    if (code.includes('not-found') || code.includes('unimplemented')) {
      const err = new Error(
        `The "${name}" server function isn't deployed yet. Run:\n\n` +
        `  npm install --prefix functions\n  firebase deploy --only functions`
      );
      err.reason = CALLABLE_NOT_DEPLOYED;
      throw err;
    }
    if (code.includes('unauthenticated')) throw new Error('Sign in again and retry.');
    if (code.includes('permission-denied')) throw new Error(e.message || 'Not allowed.');
    throw new Error(e?.message || 'Something went wrong.');
  }
}
