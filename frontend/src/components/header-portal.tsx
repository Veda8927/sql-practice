"use client";

import * as React from "react";
import { createPortal } from "react-dom";

export const HEADER_ACTIONS_SLOT_ID = "header-actions-slot";

// Renders its children into the global header's top-right action slot (see
// page.tsx). Lets activity views (Clean) place their toolbar in the header
// without lifting their state up.
export function HeaderPortal({ children }: { children: React.ReactNode }) {
  const [el, setEl] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    setEl(document.getElementById(HEADER_ACTIONS_SLOT_ID));
  }, []);
  return el ? createPortal(children, el) : null;
}
