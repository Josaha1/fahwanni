const menuTipKey = "fah-tip-menu-v2";

export function shouldShowMenuTip() {
  try {
    return localStorage.getItem(menuTipKey) === null;
  } catch {
    return false;
  }
}

export function completeMenuTip() {
  try {
    localStorage.setItem(menuTipKey, "1");
  } catch {
    // The tip can still close for this visit when storage is unavailable.
  }
}
