import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LoanAssistantFields,
  LoanAssistantFlow,
} from "../loan-structuring-assistant/build-deal-analyze-request";
import {
  clearDealFormSession,
  DEAL_FORM_SESSION_CHANGED_EVENT,
  DEFAULT_DEAL_FORM_FIELDS,
  loadDealFormSession,
  writeDealFormSession,
} from "./deal-form-session";

const DEBOUNCE_MS = 300;

/**
 * Hydrates flow/fields from `sessionStorage` once, keeps them in sync across Term Sheet /
 * Cash to Close / other tools in the same tab, and persists edits with debounce.
 */
export function useDealFormSession(
  initialFlow: LoanAssistantFlow = "purchase",
): {
  flow: LoanAssistantFlow;
  setFlow: Dispatch<SetStateAction<LoanAssistantFlow>>;
  fields: LoanAssistantFields;
  setFields: Dispatch<SetStateAction<LoanAssistantFields>>;
  /** Clears tab session storage and resets flow/fields in this tab (and any other listeners). */
  clearSession: () => void;
} {
  const [snapshot] = useState(() => loadDealFormSession());
  const [flow, setFlow] = useState<LoanAssistantFlow>(
    () => snapshot?.flow ?? initialFlow,
  );
  const [fields, setFields] = useState<LoanAssistantFields>(
    () => snapshot?.fields ?? DEFAULT_DEAL_FORM_FIELDS,
  );

  const skipNextPersist = useRef(true);

  useEffect(() => {
    const onExternal = () => {
      const next = loadDealFormSession();
      skipNextPersist.current = true;
      if (next) {
        setFlow(next.flow);
        setFields(next.fields);
      } else {
        setFlow(initialFlow);
        setFields({ ...DEFAULT_DEAL_FORM_FIELDS });
      }
    };
    window.addEventListener(DEAL_FORM_SESSION_CHANGED_EVENT, onExternal);
    return () =>
      window.removeEventListener(DEAL_FORM_SESSION_CHANGED_EVENT, onExternal);
  }, [initialFlow]);

  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      writeDealFormSession({ flow, fields });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [flow, fields]);

  const clearSession = useCallback(() => {
    clearDealFormSession();
  }, []);

  return { flow, setFlow, fields, setFields, clearSession };
}
