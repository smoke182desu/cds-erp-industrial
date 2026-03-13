import { ProjectState, Component } from '../types';

export interface Estimations {
  cutting: {
    timeHours: number;
    discs: number; // if saw
    gas: number; // if applicable
  };
  assembly: {
    timeHours: number;
  };
  welding: {
    timeHours: number;
    wireKg: number;
    gasLiters: number;
    totalPoints: number;
    totalSeamsMeters: number;
  };
  painting: {
    timeHours: number;
    primerLiters: number;
    paintLiters: number;
    thinnerLiters: number;
  };
  totals: {
    timeHours: number;
  };
}

export function calculateEstimations(project: ProjectState, weldConfig?: any): Estimations {
  const components = project.components || [];
  
  // 1. Calculate total area and perimeter
  let totalAreaM2 = 0;
  let totalPerimeterM = 0;
  let totalParts = 0;
  
  components.forEach(c => {
    const w = c.width / 1000;
    const h = c.height / 1000;
    const area = w * h * c.quantity;
    const perimeter = 2 * (w + h) * c.quantity;
    
    totalAreaM2 += area;
    totalPerimeterM += perimeter;
    totalParts += c.quantity;
  });

  // 2. Cutting Estimations
  let cuttingTime = 0;
  let cuttingDiscs = 0;
  let cuttingGas = 0;
  
  if (project.processParameters.cuttingMethod === 'guillotine') {
    // Guillotine: ~2 meters per minute (fast straight cuts)
    cuttingTime = (totalPerimeterM / 2) / 60; 
    cuttingGas = 0;
  } else if (project.processParameters.cuttingMethod === 'chop-saw') {
    // Chop-saw (Policorte): ~0.5 meters per minute
    cuttingTime = (totalPerimeterM / 0.5) / 60;
    cuttingDiscs = Math.ceil(totalPerimeterM / 10); // 1 disc per 10 meters
  } else {
    // Fallback
    cuttingTime = (totalPerimeterM / 1) / 60;
  }
  
  // Add setup time per part (2 mins)
  cuttingTime += (totalParts * 2) / 60;

  // 3. Assembly Estimations
  // ~10 minutes per part for positioning and tacking
  const assemblyTime = (totalParts * 10) / 60;

  // 4. Welding Estimations
  let weldingTime = 0;
  let wireKg = 0;
  let weldGasLiters = 0;
  let calculatedTotalPoints = 0;
  let calculatedTotalSeamsMeters = 0;
  
  if (weldConfig && Object.keys(weldConfig).length > 0) {
    // Use actual weld config if provided
    let totalSeams = 0;
    let totalIntermittent = 0;
    let totalPoints = 0;

    components.forEach(c => {
      for (let i = 0; i < c.quantity; i++) {
        const partId = c.quantity > 1 ? `${c.id}-${i+1}` : c.id;
        const config = weldConfig[partId];
        if (!config) continue;

        const w = c.width / 1000;
        const h = c.height / 1000;

        // Old format support
        const add = (type: string, length: number) => {
          if (type === 'continuous') totalSeams += length;
          if (type === 'intermittent') totalIntermittent += length;
          if (type === 'point') totalPoints += 1;
          if (type === 'lid_pattern') {
            totalSeams += length * 0.5;
            totalPoints += 2;
          }
        };

        if (config.top) add(config.top, w);
        if (config.bottom) add(config.bottom, w);
        if (config.left) add(config.left, h);
        if (config.right) add(config.right, h);
        if (config.face && config.face !== 'none') add(config.face, 1.5);

        if (config.corners) {
          if (config.corners.tl) totalPoints++;
          if (config.corners.tr) totalPoints++;
          if (config.corners.bl) totalPoints++;
          if (config.corners.br) totalPoints++;
        }

        // New format support (points and links)
        if (config.points) {
          Object.values(config.points).forEach(val => {
            if (val === true || val === 'point' || val === 'tack') totalPoints++;
            if (val === 'bead') totalSeams += Math.min(w, h); // Estimate bead length
          });
        }

        if (config.links && Array.isArray(config.links)) {
          config.links.forEach((link: any) => {
            if (link.type === 'point' || link.type === 'tack') {
              totalPoints++;
            } else if (link.type === 'bead') {
              // Estimate bead length as the smallest dimension of the component
              totalSeams += Math.min(w, h);
            }
          });
        }
      }
    });

    const pointLength = totalPoints * 0.01;
    const totalWeldLength = totalSeams + totalIntermittent + pointLength;
    
    wireKg = totalWeldLength * 0.15;
    weldGasLiters = totalWeldLength * 40;
    weldingTime = (totalWeldLength / 0.3) / 60; // 0.3m per min
    
    calculatedTotalPoints = totalPoints;
    calculatedTotalSeamsMeters = totalSeams + totalIntermittent;
  } else {
    // Estimate based on perimeter if no config
    // Assume 30% of perimeter is welded
    const estimatedWeldLength = totalPerimeterM * 0.3;
    wireKg = estimatedWeldLength * 0.15;
    weldGasLiters = estimatedWeldLength * 40;
    weldingTime = (estimatedWeldLength / 0.3) / 60;
    
    // Estimate points and seams
    calculatedTotalSeamsMeters = estimatedWeldLength;
    calculatedTotalPoints = totalParts * 4; // Assume 4 points per part
  }

  // Add setup time for welding (5 mins per part)
  weldingTime += (totalParts * 5) / 60;

  // 5. Painting Estimations
  // Surface area * 2 (both sides)
  const paintArea = totalAreaM2 * 2;
  
  // Primer: ~8 m2 per liter
  const primerLiters = paintArea / 8;
  // Paint: ~10 m2 per liter (2 coats = 5 m2 per liter)
  const paintLiters = paintArea / 5;
  // Thinner: ~30% of total paint volume
  const thinnerLiters = (primerLiters + paintLiters) * 0.3;
  
  // Painting time: ~10 mins per m2 per coat (3 coats total: 1 primer, 2 paint)
  const paintingTime = (paintArea * 10 * 3) / 60;

  return {
    cutting: {
      timeHours: cuttingTime,
      discs: cuttingDiscs,
      gas: cuttingGas
    },
    assembly: {
      timeHours: assemblyTime
    },
    welding: {
      timeHours: weldingTime,
      wireKg: wireKg,
      gasLiters: weldGasLiters,
      totalPoints: calculatedTotalPoints,
      totalSeamsMeters: calculatedTotalSeamsMeters
    },
    painting: {
      timeHours: paintingTime,
      primerLiters: primerLiters,
      paintLiters: paintLiters,
      thinnerLiters: thinnerLiters
    },
    totals: {
      timeHours: cuttingTime + assemblyTime + weldingTime + paintingTime
    }
  };
}
