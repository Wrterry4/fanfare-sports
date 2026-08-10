/**
 * navigationRef.js — Navigating from outside a screen.
 *
 * The pending-invite handler previously called useNavigation() from a component
 * rendered as a SIBLING of the navigator. useNavigation reads NavigationContext,
 * which only screens provide — so that component would have thrown
 * "Couldn't find a navigation object" the first time a parent redeemed an
 * invite. Exactly the path that has to work flawlessly.
 *
 * A container ref is the supported way to navigate from outside the tree.
 */

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) navigationRef.navigate(name, params);
}

export function replace(name, params) {
  if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name, params }] });
}
