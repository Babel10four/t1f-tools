import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
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

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

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
  resumedDraft: { flow: LoanAssistantFlow; address: string } | null;
  setFields: Dispatch<SetStateAction<LoanAssistantFields>>;
  /** Clears tab session storage and resets flow/fields in this tab (and any other listeners). */
  clearSession: () => void;
} {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [snapshot] = useState(loadDealFormSession);
  const [flow, setFlow] = useState(snapshot?.flow ?? initialFlow);
  const [fields, setFields] = useState(snapshot?.fields ?? DEFAULT_DEAL_FORM_FIELDS);
  const [resumedDraft, setResumedDraft] = useState<{
    flow: LoanAssistantFlow;
    address: string;
  } | null>(() => snapshot ? { flow: snapshot.flow, address: snapshot.fields.collateralPropertyAddress } : null);

  const skipNextPersist = useRef(true);

  useEffect(() => {
    const onExternal = () => {
      const next = loadDealFormSession();
      skipNextPersist.current = true;
      if (next) {
        setFlow(next.flow);
        setFields(next.fields);
      } else {
        setResumedDraft(null);
        setFlow(initialFlow);
        setFields({ ...DEFAULT_DEAL_FORM_FIELDS });
      }
    };
    window.addEventListener(DEAL_FORM_SESSION_CHANGED_EVENT, onExternal);
    return () =>
      window.removeEventListener(DEAL_FORM_SESSION_CHANGED_EVENT, onExternal);
  }, [initialFlow]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      writeDealFormSession({ flow, fields });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [flow, fields, hydrated]);

  const clearSession = useCallback(() => {
    clearDealFormSession();
  }, []);

  return {
    flow: hydrated ? flow : initialFlow,
    fields: hydrated ? fields : DEFAULT_DEAL_FORM_FIELDS,
    resumedDraft: hydrated ? resumedDraft : null,
    setFlow,
    setFields,
    clearSession,
  };
}
