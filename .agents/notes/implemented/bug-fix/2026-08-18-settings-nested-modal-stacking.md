# Agent Note: Settings nested modal stacking

Status: implemented

English | [中文](2026-08-18-settings-nested-modal-stacking.zh.md)

## Problem

Settings lives in the sidebar slot and paints a viewport-wide mask. AppFrame raises `.sidebarCol:has([role='dialog'])` to `z-index: 1001` so that column stays above PromptNav, the composer, and other center-column docks.

`Modal` portals to `document.body` at a lower `z-index`. A confirmation opened from Settings — provider delete on the Models page, agent-preset delete — therefore paints behind the Settings stacking context. The row button updates React state, but the user sees no dialog, so delete appears to do nothing.

Document-level Escape is registered by both layers. Because Settings mounted first, Escape would close the whole Settings panel even after the confirmation became visible.

## Decision

`Modal` uses `z-index: 1050`, above the Settings column and below Menu, Toast, and OnboardingSurface at `1100`, so a portaled menu still paints on top of a confirmation.

Settings ignores Escape while more than one `[role="dialog"][aria-modal="true"]` is in the document. The confirmation keeps its own Escape and mask-click close. Settings mask clicks never reach the panel while the confirmation mask covers the viewport.

## Testing

`packages/client/ui-primitives/tests/styles.client.spec.ts` pins Modal `1050` under Menu `1100`. `packages/client/ui-settings-general/tests/settings-root.client.spec.tsx` leaves Settings open when a second `aria-modal` dialog is present, then closes it once that dialog is gone. Models and agent-preset suites already drive the delete confirmation through `Modal`.

## Alternatives considered

**Portal Settings to `document.body` at `z-index: 1000`.** Rejected because the sidebar glass `backdrop-filter` is a containing block for `position: fixed` descendants. AppFrame already drops that filter and raises the grid item so the mask can cover the viewport without trapping it in the column; moving Settings out of the slot would re-open PromptNav and composer stacking.

**Lower the Settings column below `1000`.** Rejected because PromptNav and other center-column overlays would paint on top of the Settings mask again, which is the defect the `1001` context exists to prevent.

**Raise only the Models delete dialog.** Rejected because every Settings-owned `Modal` (model-catalog fetch, agent-preset delete, directory create) shares the same stacking miss.

**Give `Modal` capture-phase `stopImmediatePropagation` on Escape.** Rejected because nested directory-picker Modals register the parent first; capture would close or swallow Escape on the parent before the child.

## Consequences

Any body-portaled overlay that must appear while Settings is open has to exceed `1001`. Menu remains at `1100` so an in-dialog menu still wins. Image lightbox and drop overlay stay at `1000` and remain behind Settings; those flows do not open from the Settings panel.
