/**
 * foregroundPush.js — NATIVE.
 *
 * Native foreground handling goes through the platform notification APIs
 * rather than FCM's web onMessage, and the app doesn't currently present
 * in-app toasts on native. A no-op keeps the shared import working; see
 * foregroundPush.web.js for the web behaviour and the reasoning.
 */

export const subscribeForegroundPush = () => () => {};
