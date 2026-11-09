/**
 * Props that make an element `inert` (out of the tab order and the accessibility tree).
 * React 18 doesn't know the attribute, so it must be spread as an empty string to be set.
 * @param {boolean} on
 */
export function inertProps(on) {
  return on ? { inert: '' } : {};
}
