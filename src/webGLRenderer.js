// WebGLRenderer.js

// --- The GLSL Shader Code ---

const vertexShaderSource = `
  // This shader's only job is to create a rectangle that fills the screen
  // and pass texture coordinates to the fragment shader.
  attribute vec2 a_position;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_position * 0.5 + 0.5; // Convert from clip space (-1 -> 1) to texture space (0 -> 1)
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  // Uniforms are inputs from our JavaScript code
  uniform sampler2D u_texture;   // The image from the previous pass
  uniform sampler2D u_mask;      // The user's selection mask
  uniform float u_passType;    // 0.0 for an Even Pass, 1.0 for an Odd Pass
  uniform float u_direction;   // 1.0 for ascending, -1.0 for descending
  uniform vec2 u_resolution;   // The width and height of the image
  uniform float u_axis;        // 0.0 for X-axis sort, 1.0 for Y-axis sort
  uniform float u_criterion;   // 0:brightness, 1:red, 2:green, 3:blue, 4:hue

  // Varying is the data passed from the vertex shader
  varying vec2 v_texCoord;

  // --- Helper Functions in GLSL ---
  
  // Converts an RGB color to a single Hue value
  float getHue(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return abs(q.z + (q.w - q.y) / (6.0 * d + e));
  }

  // Returns the value to sort by based on the chosen criterion
  float getSortValue(vec4 color, float criterion) {
    if (criterion == 1.0) return color.r;
    if (criterion == 2.0) return color.g;
    if (criterion == 3.0) return color.b;
    if (criterion == 4.0) return getHue(color.rgb);
    // Default to brightness
    return (color.r + color.g + color.b) / 3.0;
  }

  void main() {
    vec4 selfColor = texture2D(u_texture, v_texCoord);

    // If this pixel is not selected in the mask, do nothing and return its original color.
    if (texture2D(u_mask, v_texCoord).r < 0.5) {
      gl_FragColor = selfColor;
      return;
    }

    // Determine the step vector (either horizontal or vertical) based on the sorting axis
    vec2 step = u_axis == 0.0 ? vec2(1.0 / u_resolution.x, 0.0) : vec2(0.0, 1.0 / u_resolution.y);
    
    // Determine the coordinate to check for the odd/even pass
    float coord = u_axis == 0.0 ? v_texCoord.x * u_resolution.x : v_texCoord.y * u_resolution.y;

    // Determine if this pixel is the 'left' (or 'top') pixel in a comparison pair for this pass
    bool isLeftPixel = mod(floor(coord), 2.0) == u_passType;

    if (isLeftPixel) {
      // I am a left/top pixel. Compare with my right/bottom neighbor.
      vec4 neighborColor = texture2D(u_texture, v_texCoord + step);
      float selfVal = getSortValue(selfColor, u_criterion);
      float neighborVal = getSortValue(neighborColor, u_criterion);
      
      // If the values are out of order according to the sort direction, output the neighbor's color (swap).
      if ((selfVal - neighborVal) * u_direction > 0.0) {
        gl_FragColor = neighborColor;
      } else {
        gl_FragColor = selfColor;
      }
    } else {
      // I am a right/bottom pixel. Compare with my left/top neighbor.
      vec4 neighborColor = texture2D(u_texture, v_texCoord - step);
      float selfVal = getSortValue(selfColor, u_criterion);
      float neighborVal = getSortValue(neighborColor, u_criterion);

      // If the values are out of order, output the neighbor's color (swap).
      if ((neighborVal - selfVal) * u_direction > 0.0) {
        gl_FragColor = neighborColor;
      } else {
        gl_FragColor = selfColor;
      }
    }
  }
`;

// Map our human-readable criteria to the numbers the shader expects
const CRITERION_MAP = {
  brightness: 0.0,
  red: 1.0,
  green: 2.0,
  blue: 3.0,
  hue: 4.0,
};

export class WebGLSortRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!this.gl) {
      console.error("WebGL not supported!");
      return;
    }
    
    const vs = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fs = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = this.createProgram(vs, fs);
    
    // Get locations of shader attributes and uniforms
    this.positionLocation = this.gl.getAttribLocation(this.program, "a_position");
    this.resolutionLocation = this.gl.getUniformLocation(this.program, "u_resolution");
    this.textureLocation = this.gl.getUniformLocation(this.program, "u_texture");
    this.maskLocation = this.gl.getUniformLocation(this.program, "u_mask");
    this.passTypeLocation = this.gl.getUniformLocation(this.program, "u_passType");
    this.directionLocation = this.gl.getUniformLocation(this.program, "u_direction");
    this.axisLocation = this.gl.getUniformLocation(this.program, "u_axis");
    this.criterionLocation = this.gl.getUniformLocation(this.program, "u_criterion");

    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
  }

  performGpuSort(pixelMatrix, mask, options) {
    const {
      axis = 'y',
      criterion = 'brightness',
      direction = 'decending'
    } = options;

    const gl = this.gl;
    if (!gl) return;
    const width = pixelMatrix[0].length;
    const height = pixelMatrix.length;

    this.canvas.width = width;
    this.canvas.height = height;
    gl.viewport(0, 0, width, height);

    const imageTexture = this.createTextureFromMatrix(pixelMatrix);
    const maskTexture = this.createTextureFromMask(mask);
    
    const fbo1 = this.createFramebuffer(width, height);
    const fbo2 = this.createFramebuffer(width, height);

    gl.useProgram(this.program);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(this.resolutionLocation, width, height);
    gl.uniform1f(this.directionLocation, direction === 'ascending' ? 1.0 : -1.0);
    gl.uniform1f(this.axisLocation, axis === 'x' ? 0.0 : 1.0);
    gl.uniform1f(this.criterionLocation, CRITERION_MAP[criterion] || 0.0);
    
    gl.uniform1i(this.textureLocation, 0); // Tell shader texture unit 0 is for the image
    gl.uniform1i(this.maskLocation, 1);     // Tell shader texture unit 1 is for the mask
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.activeTexture(gl.TEXTURE0); // Switch back to texture unit 0

    // Initial copy of image data into fbo1
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1.fb);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    let source = fbo1, dest = fbo2;
    const passes = axis === 'x' ? width : height;

    for (let i = 0; i < passes; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dest.fb);
      gl.bindTexture(gl.TEXTURE_2D, source.texture);
      gl.uniform1f(this.passTypeLocation, i % 2);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      [source, dest] = [dest, source];
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, source.fb);
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    // Clean up WebGL resources
    gl.deleteTexture(imageTexture);
    gl.deleteTexture(maskTexture);
    gl.deleteFramebuffer(fbo1.fb);
    gl.deleteTexture(fbo1.texture);
    gl.deleteFramebuffer(fbo2.fb);
    gl.deleteTexture(fbo2.texture);
    
    return new ImageData(new Uint8ClampedArray(pixels.buffer), width, height);
  }

  // --- WebGL Utility Methods ---
  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  createProgram(vs, fs) {
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program link error:', this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  createTexture(width, height, data) {
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, data);
    return texture;
  }
  
  createTextureFromMatrix(matrix) {
    const height = matrix.length;
    const width = matrix[0].length;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const pixel = matrix[y][x];
        data[i] = pixel.r; data[i+1] = pixel.g; data[i+2] = pixel.b; data[i+3] = pixel.a;
      }
    }
    return this.createTexture(width, height, data);
  }
  
  createTextureFromMask(mask) {
    if (!mask || mask.length === 0) {
      return this.createTexture(1, 1, new Uint8Array([255, 255, 255, 255])); // Return a 1x1 white texture
    }
    const height = mask.length;
    const width = mask[0].length;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const value = mask[y][x] ? 255 : 0;
        data[i] = value; data[i+1] = value; data[i+2] = value; data[i+3] = 255;
      }
    }
    return this.createTexture(width, height, data);
  }
  
  createFramebuffer(width, height) {
    const texture = this.createTexture(width, height, null);
    const fb = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);
    return { fb, texture };
  }
}