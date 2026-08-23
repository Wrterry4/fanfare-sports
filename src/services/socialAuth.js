/**
 * socialAuth.js — NATIVE. Google and Facebook sign-in.
 *
 * Not available here, and the reason is a dependency rather than a decision.
 * On the web, Firebase runs the whole OAuth handshake itself in a popup or a
 * redirect. On native there is no browser to hand off to: Google needs
 * @react-native-google-signin/google-signin and Facebook needs the Facebook
 * SDK, both of which are native modules with their own configuration in the
 * iOS and Android projects. Neither is installed.
 *
 * So this reports an empty provider list and the buttons don't render. Email
 * and password work everywhere, which is what keeps a native build usable
 * while this is outstanding — a button that fails on tap would be worse than
 * no button.
 */

export const SOCIAL_PROVIDERS = [];

export const socialSignInSupported = () => false;

export async function signInWithProvider() {
  throw new Error('Sign in with email on this device for now.');
}

/** Web resolves a redirect here on load; native has none to resolve. */
export async function completeRedirectSignIn() { return null; }
