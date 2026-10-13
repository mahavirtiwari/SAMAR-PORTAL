import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { pinCodeAction } from '../redux/action/master/MasterAction';
import { resetPinCode } from '../redux/slices/master/MasterSlice';

const PIN_LENGTH = 6;

/**
 * Drives PIN-code → District/State autofill for one address block.
 *
 * - Refetches whenever `pinCode` changes and overwrites District/State with the
 *   new record, so editing the PIN updates the fields instead of keeping stale
 *   values.
 * - When a complete PIN resolves to no record, reports `notFound` and calls
 *   `onMiss` so the form can clear the fields and show a message.
 * - The first settle for a PIN that already has District/State (edit forms,
 *   "same as" prefills) is adopted without overwriting — only user-driven PIN
 *   changes after that trigger overwrite/clear. Programmatic resets mid-session
 *   should call `markApplied(pin)`.
 *
 * `lookupKey` must be unique per block on a screen so concurrent lookups
 * (e.g. registered office vs unit) don't collide.
 */
export const usePincodeAutofill = ({ pinCode, lookupKey, district, state, onResolve, onMiss }) => {
  const dispatch = useDispatch();
  const lookup = useSelector(s => s.Master.pinCodeLookups?.[lookupKey]);
  const queriedPin = useSelector(s => s.Master.pinCodeQueriedByKey?.[lookupKey]);
  const loading = useSelector(s => s.Master.pinCodeLoadingByKey?.[lookupKey]);

  const [notFound, setNotFound] = useState(false);
  const appliedPinRef = useRef(null);
  const latest = useRef({ district, state, onResolve, onMiss });
  latest.current = { district, state, onResolve, onMiss };

  useEffect(() => {
    if (pinCode?.length === PIN_LENGTH) {
      setNotFound(false);
      dispatch(pinCodeAction({ pincode: pinCode, key: lookupKey }));
    } else {
      setNotFound(false);
      dispatch(resetPinCode({ key: lookupKey }));
    }
  }, [dispatch, pinCode, lookupKey]);

  useEffect(() => {
    if (pinCode?.length !== PIN_LENGTH) {
      return;
    }
    if (loading) {
      return;
    }
    if (queriedPin !== pinCode) {
      return;
    }
    if (appliedPinRef.current === pinCode) {
      return;
    }

    const match = Array.isArray(lookup) ? lookup.find(item => item?.pincode === pinCode) : null;

    if (appliedPinRef.current === null && latest.current.district && latest.current.state) {
      appliedPinRef.current = pinCode;
      return;
    }

    appliedPinRef.current = pinCode;
    if (match?.district && match?.state) {
      setNotFound(false);
      latest.current.onResolve?.(match);
    } else {
      setNotFound(true);
      latest.current.onMiss?.();
    }
    // onResolve/onMiss read from latest ref; deps intentionally exclude them.
  }, [pinCode, lookup, queriedPin, loading]);

  // Clear the not-found message once the user supplies District and State manually.
  useEffect(() => {
    if (notFound && district && state) {
      setNotFound(false);
    }
  }, [notFound, district, state]);

  const markApplied = pin => {
    appliedPinRef.current = pin ?? null;
    setNotFound(false);
  };

  return { notFound, loading: !!loading, markApplied };
};

export default usePincodeAutofill;
