let bufferToMatrix = (buffer, w, h) => {
    let matrix = [];
    for(let y = 0; y < h; y++) {
        let row = [];
        for(let x = 0; x < w; x++) {
            let index = (y * w + x) * 4;

            let r = buffer[index];
            let g = buffer[index + 1];
            let b = buffer[index + 2];
            let a = buffer[index + 3];

            row.push({r, g, b, a});
        }
        matrix.push(row);
    }
    return matrix;
}

let matrixToBuffer = (matrix) => {
    let h = matrix.length;
    if (h == 0) {
        return new ImageData(0, 0).data;
    }
    let w = matrix[0].length;

    let buffer = new ImageData(w, h).data;

    for(let y = 0; y < h; y++) {
        for(let x = 0; x < w; x++) {
            let index = (y * w + x) * 4;
            let pixel = matrix[y][x];

            buffer[index] = pixel.r;
            buffer[index + 1] = pixel.g;
            buffer[index + 2] = pixel.b;
            buffer[index + 3] = pixel.a;
        }
    }
    return buffer;
}

let sortPixels = (matrix, mask, axis = 'x', criterion = 'brightness', direction = 'ascending', renderer) => {
    if (!mask || !renderer) {
      console.log("A selection is required and renderer must be initialized.");
      return;
    }
    
    console.log("Starting GPU pixel sort...");
    const startTime = performance.now();

    // The CPU's only job is to kick off the GPU process
    const sortedImageData = renderer.performGpuSort(
        matrix,
        mask,
        {
            axis,
            criterion,
            direction,
        }
    );
    
    const endTime = performance.now();
    console.log(`GPU sort completed in ${endTime - startTime}ms`);
    
    // Update the state with the final result from the GPU
    // This will trigger a redraw via componentDidUpdate
    console.log(sortedImageData);
    let m = bufferToMatrix(sortedImageData.data, matrix[0].length, matrix.length);
    // console.log(m);
    return m;
}

let invert = (matrix, mask) => {
    if (!mask && mask.length == 0) {
        return;
    }

    let m = cloneMatrix(matrix);
    let h = m.length;
    let w = m[0].length;

    for(let y = 0; y < m.length; y++) {
        for(let x = 0; x < m[y].length; x++) {
            if(mask[y] && mask[y][x]) {
                let pixel = m[y][x];
                pixel.r = 255 - pixel.r;
                pixel.g = 255 - pixel.g;
                pixel.b = 255 - pixel.b;
                m[y][x] = pixel;
            }
        }
    }

    return m;
}

let cloneMatrix = (matrix) => {
    return matrix.map(row => [...row]);
}

let lerp = (a, b, t) => {
    return a + (b - a) * t;
}

let resize = (matrix, scale) => {
    let m = cloneMatrix(matrix);
    let oh = m.length;
    let ow = m[0].length;
    let nh = Math.floor(m.length * scale);
    let nw = Math.floor(m[0].length * scale);

    let nMatrix = [];

    for(let y = 0; y < nh; y++) {
        let nRow = [];
        for(let x = 0; x < nw; x++) {

            let oy = y / scale;
            let ox = x / scale;

            let y1 = Math.floor(oy);
            let x1 = Math.floor(ox);
            let yDiff = oy - y1;
            let xDiff = ox - x1;

            // A---B
            // |   |
            // C---D

            let y2 = Math.min(y1 + 1, oh - 1);
            let x2 = Math.min(x1 + 1, ow - 1);

            let A = m[y1][x1];
            let B = m[y1][x2];
            let C = m[y2][x1];
            let D = m[y2][x2];

            let topR = lerp(A.r, B.r, xDiff);
            let topG = lerp(A.g, B.g, xDiff);
            let topB = lerp(A.b, B.b, xDiff);
            let topA = lerp(A.a, B.a, xDiff);

            let bottomR = lerp(C.r, D.r, xDiff);
            let bottomG = lerp(C.g, D.g, xDiff);
            let bottomB = lerp(C.b, D.b, xDiff);
            let bottomA = lerp(C.a, D.a, xDiff);

            let r = lerp(topR, bottomR, yDiff);
            let g = lerp(topG, bottomG, yDiff);
            let b = lerp(topB, bottomB, yDiff);
            let a = lerp(topA, bottomA, yDiff);

            nRow.push({ r: Math.round(r), g: Math.round(g), b: Math.round(b), a: Math.round(a)});
        }
        nMatrix.push(nRow);
    }
    return nMatrix;
}

let createMask = (w, h, fill=false) => {
    return Array(h).fill(null).map(() => Array(w).fill(fill));
}

function getMaskBounds(maskMatrix) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  let hasPixels = false;
  
  for (let row = 0; row < maskMatrix.length; row++) {
    for (let col = 0; col < maskMatrix[row].length; col++) {
      if (maskMatrix[row][col]) {
        hasPixels = true;
        minX = Math.min(minX, col);
        minY = Math.min(minY, row);
        maxX = Math.max(maxX, col);
        maxY = Math.max(maxY, row);
      }
    }
  }
  
  if (!hasPixels) return null;
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}


function extractMaskedRegion(colorMatrix, maskMatrix) {
  const bounds = getMaskBounds(maskMatrix);
  
  if (!bounds) {
    return { data: [], bounds: null, mask: [] };
  }
  
  const { x, y, width, height } = bounds;
  const croppedData = [];
  const croppedMask = [];
  
  for (let row = y; row < y + height; row++) {
    const dataRow = [];
    const maskRow = [];
    
    for (let col = x; col < x + width; col++) {
      const isMasked = maskMatrix[row][col];
      maskRow.push(isMasked);
      dataRow.push(isMasked ? colorMatrix[row][col] : null);
    }
    
    croppedData.push(dataRow);
    croppedMask.push(maskRow);
  }
  
  return { 
    data: croppedData, 
    bounds: bounds,
    mask: croppedMask
  };
}


function pasteMaskedRegion(colorMatrix, clipboard, pasteX, pasteY) {
  if (!clipboard || !clipboard.data.length) {
    return colorMatrix;
  }
  
  // Create a deep copy to avoid mutating the original
  const newMatrix = colorMatrix.map(row => [...row]);
  
  for (let row = 0; row < clipboard.data.length; row++) {
    for (let col = 0; col < clipboard.data[row].length; col++) {
      const targetRow = pasteY + row;
      const targetCol = pasteX + col;
      
      // Only paste if the pixel was masked AND within bounds
      if (clipboard.mask[row][col] &&
          targetRow >= 0 && targetRow < newMatrix.length &&
          targetCol >= 0 && targetCol < newMatrix[0].length) {
        newMatrix[targetRow][targetCol] = clipboard.data[row][col];
      }
    }
  }
  
  return newMatrix;
}





export default { bufferToMatrix, matrixToBuffer, invert, cloneMatrix, resize, createMask, sortPixels, extractMaskedRegion, pasteMaskedRegion }