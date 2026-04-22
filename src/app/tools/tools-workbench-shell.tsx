"use client";

import type { ReactNode } from "react";
import { CreditCopilotPanel } from "./credit-copilot/credit-copilot-panel";
import { ToolRail } from "./tool-rail";

type Props = {
  children: ReactNode;
};

export function ToolsWorkbenchShell({ children }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--surface-page)]">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <ToolRail />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          <CreditCopilotPanel className="order-2 max-h-[min(42vh,360px)] shrink-0 border-t border-[var(--border-subtle)] lg:order-1 lg:h-auto lg:max-h-none lg:shrink-0 lg:border-t-0" />
          <main className="order-1 min-h-0 min-w-0 flex-1 overflow-y-auto bg-[var(--surface-page)] lg:order-2">
            <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 sm:py-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
