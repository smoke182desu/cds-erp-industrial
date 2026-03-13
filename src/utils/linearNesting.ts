import { Component, Bar, LinearCut } from '../types/index';

const BAR_LENGTH = 6000; // 6 meters
const SAW_KERF = 3; // 3mm loss per cut

export function calculateLinearCutPlan(components: Component[]): Bar[] {
  // Filter only linear components (tubes, profiles)
  const linearComponents = components.filter(c => 
    ['RoundTube', 'SquareTube', 'RectangularTube', 'Profile'].includes(c.type || '')
  );

  if (linearComponents.length === 0) return [];

  // Group by material type/dimensions to optimize separately
  // We normalize dimensions to ensure "30x30x750" and "750x30x30" are treated as the same material
  const materialGroups: { [key: string]: { components: Component[], profile: string } } = {};

  linearComponents.forEach(c => {
    // Extract all dimensions
    let dims = [c.width, c.height, c.details?.depth || 0].map(Number).filter(d => d > 0);
    
    // Robustness: For SquareTube, if we only have 2 dimensions (Length & Side), 
    // infer the 3rd dimension (Depth) is equal to the Side.
    if (c.type === 'SquareTube' && dims.length === 2) {
      const side = Math.min(...dims);
      dims.push(side);
    }

    // Sort dimensions ascending: [Small, Medium, Large]
    // We assume the Largest dimension is the Length to be cut.
    // The Smaller dimensions define the Profile.
    dims.sort((a, b) => a - b);
    
    // If we have 3 dims (e.g. 30, 30, 750), profile is 30x30, length is 750.
    // If we have 2 dims (e.g. 30, 750), profile is 30, length is 750.
    const length = dims.pop() || 0; // Removes and returns the largest
    const profileDims = dims.join('x'); // e.g. "30x30"
    
    const key = `${c.type} ${profileDims}`; // e.g. "SquareTube 30x30"

    if (!materialGroups[key]) {
      materialGroups[key] = {
        components: [],
        profile: profileDims
      };
    }
    materialGroups[key].components.push(c);
  });

  const bars: Bar[] = [];
  let barIdCounter = 1;

  Object.entries(materialGroups).forEach(([materialKey, group]) => {
    // Flatten components by quantity
    const partsToCut: { id: string, name: string, length: number, originalComponent: Component }[] = [];
    
    group.components.forEach(c => {
      // Re-calculate length for this specific component instance
      // (Logic must match the grouping logic above)
      let dims = [c.width, c.height, c.details?.depth || 0].map(Number).filter(d => d > 0);
      
      if (c.type === 'SquareTube' && dims.length === 2) {
        const side = Math.min(...dims);
        dims.push(side);
      }

      dims.sort((a, b) => a - b);
      const length = dims.pop() || 0;
      
      for (let i = 0; i < c.quantity; i++) {
        partsToCut.push({
          id: `${c.id}-${i+1}`,
          name: c.name,
          length: length,
          originalComponent: c
        });
      }
    });

    // Sort by length descending (First Fit Decreasing algorithm)
    // This is a standard heuristic for 1D Bin Packing
    partsToCut.sort((a, b) => b.length - a.length);

    // Nesting
    partsToCut.forEach(part => {
      let placed = false;

      // Try to fit in existing bars of this material
      for (const bar of bars) {
        if (bar.material === materialKey) {
          // Check if part fits in leftover space
          // We assume every cut needs SAW_KERF, even the last one (trimming/squaring off)
          if (bar.leftover >= part.length + SAW_KERF) {
            // Add to this bar
            bar.parts.push({
              id: part.id,
              name: part.name,
              length: part.length,
              quantity: 1,
              originalComponent: part.originalComponent
            });
            
            // Add cut position
            // Position is cumulative length of parts + kerfs
            // We can calculate it from the previous cut or total used
            const usedLength = BAR_LENGTH - bar.leftover;
            const cutPos = usedLength + part.length;

            bar.cuts.push({
              id: bar.cuts.length + 1,
              pos: cutPos,
              description: `Corte ${part.name} (${part.length}mm)`
            });

            bar.leftover -= (part.length + SAW_KERF);
            placed = true;
            break;
          }
        }
      }

      // If not placed, create new bar
      if (!placed) {
        const newBar: Bar = {
          id: `BAR-${barIdCounter++}`,
          length: BAR_LENGTH,
          material: materialKey,
          parts: [{
            id: part.id,
            name: part.name,
            length: part.length,
            quantity: 1,
            originalComponent: part.originalComponent
          }],
          cuts: [{
            id: 1,
            pos: part.length,
            description: `Corte ${part.name} (${part.length}mm)`
          }],
          leftover: BAR_LENGTH - part.length - SAW_KERF
        };
        bars.push(newBar);
      }
    });
  });

  return bars;
}
