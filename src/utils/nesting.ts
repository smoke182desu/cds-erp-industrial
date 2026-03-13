import { Component, Sheet, PlacedComponent } from '../types';

const SHEET_WIDTH = 3000;
const SHEET_HEIGHT = 1200;
const PADDING = 0; // No padding between components
const MARGIN = 0; // No margin from sheet edges

export interface CutLine {
  id: number;
  axis: 'x' | 'y';
  pos: number; // absolute position on sheet
  start: number; // start coordinate on the other axis
  end: number; // end coordinate on the other axis
  description: string;
}

export interface Leftover {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GuillotineSheet extends Sheet {
  cuts: CutLine[];
  leftovers: Leftover[];
  material: string;
}

class GuillotineNode {
  x: number;
  y: number;
  w: number;
  h: number;
  used: boolean;
  right: GuillotineNode | null;
  down: GuillotineNode | null;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.used = false;
    this.right = null;
    this.down = null;
  }

  findBestFit(w: number, h: number): { node: GuillotineNode, score: number } | null {
    if (this.used) {
      const rightFit = this.right?.findBestFit(w, h);
      const downFit = this.down?.findBestFit(w, h);
      if (rightFit && downFit) {
        return rightFit.score < downFit.score ? rightFit : downFit;
      }
      return rightFit || downFit || null;
    }

    if (w <= this.w && h <= this.h) {
      // Best Short Side Fit (BSSF): minimize the smaller remaining dimension
      const dw = this.w - w;
      const dh = this.h - h;
      const score = Math.min(dw, dh);
      return { node: this, score };
    }
    
    return null;
  }

  split(w: number, h: number) {
    this.used = true;
    const dw = this.w - w;
    const dh = this.h - h;
    
    if (dw > dh) {
      this.right = new GuillotineNode(this.x + w, this.y, dw, this.h);
      this.down = new GuillotineNode(this.x, this.y + h, w, dh);
    } else {
      this.right = new GuillotineNode(this.x + w, this.y, dw, h);
      this.down = new GuillotineNode(this.x, this.y + h, this.w, dh);
    }
  }
}

export function calculateCutPlan(components: Component[]): GuillotineSheet[] {
  // Filter out tubes/profiles which are handled by linear nesting
  const sheetComponents = components.filter(c => 
    !['RoundTube', 'SquareTube', 'RectangularTube', 'Profile'].includes(c.type || '')
  );

  // Group components by material
  const componentsByMaterial: { [key: string]: Component[] } = {};
  
  sheetComponents.forEach(c => {
    // Normalize material name to handle potential inconsistencies
    const material = c.material || 'Material Padrão';
    if (!componentsByMaterial[material]) {
      componentsByMaterial[material] = [];
    }
    componentsByMaterial[material].push(c);
  });

  const allSheets: GuillotineSheet[] = [];

  // Process each material group independently
  Object.keys(componentsByMaterial).forEach(material => {
    const materialComponents = componentsByMaterial[material];
    
    // 1. Flatten components by quantity
    const flatComponents: Component[] = [];
    materialComponents.forEach(c => {
      for (let i = 0; i < c.quantity; i++) {
        flatComponents.push({ ...c, quantity: 1, id: `${c.id}-${i}` });
      }
    });

    // 2. Sort components by area (descending) - often better for packing
    flatComponents.sort((a, b) => {
      // Sort by max dimension first, then area
      const maxA = Math.max(a.width, a.height);
      const maxB = Math.max(b.width, b.height);
      if (maxA !== maxB) return maxB - maxA;
      return (b.width * b.height) - (a.width * a.height);
    });

    const sheets: GuillotineSheet[] = [];

    flatComponents.forEach(comp => {
      let placed = false;
      let bestNode: GuillotineNode | null = null;
      let bestSheetIndex = -1;
      let rotated = false;
      let bestScore = Infinity;
      
      let w = comp.width;
      let h = comp.height;

      // Try to fit in existing sheets
      for (let i = 0; i < sheets.length; i++) {
        const root = (sheets[i] as any)._root as GuillotineNode;
        
        const fitNormal = root.findBestFit(w, h);
        const fitRotated = root.findBestFit(h, w);
        
        let currentBestFit = null;
        let currentRotated = false;
        
        if (fitNormal && fitRotated) {
          if (fitNormal.score <= fitRotated.score) {
            currentBestFit = fitNormal;
          } else {
            currentBestFit = fitRotated;
            currentRotated = true;
          }
        } else if (fitNormal) {
          currentBestFit = fitNormal;
        } else if (fitRotated) {
          currentBestFit = fitRotated;
          currentRotated = true;
        }
        
        if (currentBestFit && currentBestFit.score < bestScore) {
          bestNode = currentBestFit.node;
          bestSheetIndex = i;
          rotated = currentRotated;
          bestScore = currentBestFit.score;
          placed = true;
        }
      }

      // If not placed, create a new sheet
      if (!placed) {
        const newRoot = new GuillotineNode(MARGIN, MARGIN, SHEET_WIDTH - MARGIN * 2, SHEET_HEIGHT - MARGIN * 2);
        
        // Check if it's too big even for a new sheet
        if (w > newRoot.w || h > newRoot.h) {
          if (h <= newRoot.w && w <= newRoot.h) {
            // Fits rotated
            rotated = true;
          } else {
            console.warn(`Component ${comp.name} is too large for the sheet: ${w}x${h}`);
            // Force fit by scaling to fit within margins
            const scale = Math.min(newRoot.w / w, newRoot.h / h);
            w = Math.floor(w * scale);
            h = Math.floor(h * scale);
          }
        }
        
        const fitW = rotated ? h : w;
        const fitH = rotated ? w : h;
        
        const fit = newRoot.findBestFit(fitW, fitH);
        if (fit) {
          bestNode = fit.node;
          const newSheet: GuillotineSheet = {
            width: SHEET_WIDTH,
            height: SHEET_HEIGHT,
            components: [],
            usedArea: 0,
            cuts: [],
            leftovers: [],
            material: material // Set the material for this sheet
          };
          (newSheet as any)._root = newRoot;
          sheets.push(newSheet);
          bestSheetIndex = sheets.length - 1;
          placed = true;
        }
      }

      if (placed && bestNode) {
        const finalW = rotated ? h : w;
        const finalH = rotated ? w : h;
        bestNode.split(finalW, finalH);
        
        const placedComp: PlacedComponent = {
          ...comp,
          x: bestNode.x,
          y: bestNode.y,
          sheetIndex: bestSheetIndex,
          rotated,
          width: finalW,
          height: finalH
        };
        
        sheets[bestSheetIndex].components.push(placedComp);
        sheets[bestSheetIndex].usedArea += placedComp.width * placedComp.height;
      }
    });

    // Generate cut lines from the tree for each sheet
    sheets.forEach(sheet => {
      const root = (sheet as any)._root as GuillotineNode;
      let cutId = 1;
      
      function traverse(node: GuillotineNode | null, regionX: number, regionY: number, regionW: number, regionH: number) {
        if (!node || !node.used) return;
        
        // Find the component placed here
        const comp = sheet.components.find(c => c.x === node.x && c.y === node.y);
        const compName = comp ? comp.name : 'Sobra';
        
        // Determine split direction based on how the node was split
        // We can infer this from the dimensions of right and down nodes
        const dw = node.w - (comp ? comp.width : 0);
        const dh = node.h - (comp ? comp.height : 0);
        
        let verticalSplitFirst = false;
        if (node.right && node.down) {
          if (node.right.h === node.h) {
            verticalSplitFirst = true;
          }
        } else if (node.right) {
          // If only right exists, it's effectively a vertical split
          verticalSplitFirst = true;
        } else if (node.down) {
          verticalSplitFirst = false;
        }

        const compW = comp ? comp.width : node.w;
        const compH = comp ? comp.height : node.h;

        if (verticalSplitFirst) {
          if (dw > 0) {
            sheet.cuts.push({
              id: cutId++,
              axis: 'x',
              pos: node.x + compW,
              start: regionY,
              end: regionY + regionH,
              description: `Corte Vertical (Encosto ${compW}mm). Separa ${compName}.`
            });
            if (node.right) {
              traverse(node.right, node.x + compW, regionY, regionW - compW, regionH);
            }
          }
          if (dh > 0) {
            sheet.cuts.push({
              id: cutId++,
              axis: 'y',
              pos: node.y + compH,
              start: regionX,
              end: regionX + compW,
              description: `Corte Horizontal (Encosto ${compH}mm). Separa ${compName}.`
            });
            if (node.down) {
              traverse(node.down, regionX, node.y + compH, compW, regionH - compH);
            }
          }
        } else {
          if (dh > 0) {
            sheet.cuts.push({
              id: cutId++,
              axis: 'y',
              pos: node.y + compH,
              start: regionX,
              end: regionX + regionW,
              description: `Corte Horizontal (Encosto ${compH}mm). Separa ${compName}.`
            });
            if (node.down) {
              traverse(node.down, regionX, node.y + compH, regionW, regionH - compH);
            }
          }
          if (dw > 0) {
            sheet.cuts.push({
              id: cutId++,
              axis: 'x',
              pos: node.x + compW,
              start: regionY,
              end: regionY + compH,
              description: `Corte Vertical (Encosto ${compW}mm). Separa ${compName}.`
            });
            if (node.right) {
              traverse(node.right, node.x + compW, regionY, regionW - compW, compH);
            }
          }
        }
      }
      
      traverse(root, 0, 0, SHEET_WIDTH, SHEET_HEIGHT);
      
      // Find leftovers
      function findLeftovers(node: GuillotineNode | null) {
        if (!node) return;
        if (!node.used) {
          if (node.w > 10 && node.h > 10) { // Only keep meaningful leftovers
            sheet.leftovers.push({
              x: node.x,
              y: node.y,
              width: node.w,
              height: node.h
            });
          }
          return;
        }
        findLeftovers(node.right);
        findLeftovers(node.down);
      }
      findLeftovers(root);

      // Clean up internal _root
      delete (sheet as any)._root;
    });

    allSheets.push(...sheets);
  });

  return allSheets;
}
