import { Dimensions } from '../types';

export function calculatePartDimensions(dims: Dimensions) {
  const { width: pr_w, height: pr_h, depth: fu_h } = dims;

  // These formulas need to be verified with the user, but for now
  // I will make them consistent across the app.
  
  const lt_h = pr_h; // Side height
  const lt_t = fu_h; // Side top length
  const lt_b = fu_h; // Side bottom length
  
  // ... other calculations ...

  return {
    lt_h,
    lt_t,
    lt_b,
    // ...
  };
}
