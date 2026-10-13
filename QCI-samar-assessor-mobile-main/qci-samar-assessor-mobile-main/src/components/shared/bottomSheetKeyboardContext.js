import { createContext, useContext } from 'react';

/**
 * Android has no keyboardWillShow event, so an AppBottomSheet cannot react
 * before the keyboard finishes animating. Inputs rendered inside the sheet
 * call this context's callback on focus (which fires at tap time), letting
 * the sheet apply its keyboard height cap early and avoid a full-height
 * flash while the keyboard is still animating in.
 */
export const BottomSheetKeyboardContext = createContext(null);

export const useBottomSheetKeyboard = () => useContext(BottomSheetKeyboardContext);
