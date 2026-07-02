export const accessUsersChangedEvent = "brq-access-users-changed";

export function notifyAccessUsersChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(accessUsersChangedEvent));
}
