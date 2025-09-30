// WebGLRenderer.js

// --- The GLSL Shader Code (defined here for convenience) ---
const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_position * 0.5 + 0.5;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform sampler2D u_texture;
  uniform sampler2D u_mask;
  uniform float u_stage;
  uniform float u_pass;
  uniform float u_direction;
  uniform vec2 u_resolution;
  varying vec2 v_texCoord;

  float getBrightness(vec4 color) {
    return (color.r + color.g + color.b) / 3.0;
  }

  void main() {
    float isSelected = texture2D(u_mask, v_texCoord).r;
    vec4 selfColor = texture2D(u_texture, v_texCoord);

    if (isSelected < 0.5) {
      gl_FragColor = selfColor; // Not selected, do nothing
      return;
    }
    
    // --- Bitonic Merge Sort Step ---
    float two_s = pow(2.0, u_stage);
    float two_s_p = pow(2.0, u_pass);
    
    // Determine the distance and direction of the pixel to compare with
    float distance = two_s_p / u_resolution.x;
    float flowDir = mod(floor(v_texCoord.x * u_resolution.x / two_s), 2.0) == 0.0 ? 1.0 : -1.0;
    
    vec4 neighborColor = texture2D(u_texture, v_texCoord + vec2(distance * flowDir, 0.0));
    
    float selfBrightness = getBrightness(selfColor);
    float neighborBrightness = getBrightness(neighborColor);
    
    vec4 minColor = selfBrightness < neighborBrightness ? selfColor : neighborColor;
    vec4 maxColor = selfBrightness < neighborBrightness ? neighborColor : selfColor;
    
    gl_FragColor = flowDir * u_direction < 0.0 ? maxColor : minColor;
  }
`;

// --- The Helper Class ---
export class WebGLSortRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl');
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
    this.stageLocation = this.gl.getUniformLocation(this.program, "u_stage");
    this.passLocation = this.gl.getUniformLocation(this.program, "u_pass");
    this.directionLocation = this.gl.getUniformLocation(this.program, "u_direction");

    // Create a buffer to hold the vertices of the rectangle that fills the canvas
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
  }

  performGpuSort(pixelMatrix, mask, direction) {
    const gl = this.gl;
    if (!gl) return;
    const width = pixelMatrix[0].length;
    const height = pixelMatrix.length;

    this.canvas.width = width;
    this.canvas.height = height;
    gl.viewport(0, 0, width, height);

    const imageTexture = this.createTextureFromMatrix(pixelMatrix);
    const maskTexture = this.createTextureFromMask(mask);
    
    // Create two framebuffers for ping-ponging
    const fbo1 = this.createFramebuffer(width, height);
    const fbo2 = this.createFramebuffer(width, height);

    gl.useProgram(this.program);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set uniforms that don't change during the loop
    gl.uniform2f(this.resolutionLocation, width, height);
    gl.uniform1f(this.directionLocation, direction === 'ascending' ? 1.0 : -1.0);
    gl.uniform1i(this.maskLocation, 1); // Mask will be on texture unit 1

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.activeTexture(gl.TEXTURE0);

    // Copy initial image data into the first framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1.fb);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // --- The Multi-Pass Sorting Loop ---
    let stages = Math.ceil(Math.log2(width));
    let source = fbo1, dest = fbo2;

    for (let i = 0; i < stages; i++) {
      for (let j = 0; j < i + 1; j++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dest.fb);
        gl.bindTexture(gl.TEXTURE_2D, source.texture);
        
        gl.uniform1f(this.stageLocation, i + 1);
        gl.uniform1f(this.passLocation, j + 1);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        [source, dest] = [dest, source]; // Ping-pong
      }
    }
    
    // Read the final sorted pixels back to the CPU
    gl.bindFramebuffer(gl.FRAMEBUFFER, source.fb);
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    return new ImageData(new Uint8ClampedArray(pixels.buffer), width, height);
  }

  // --- WebGL utility methods below ---
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

// (Full implementation of utility methods in the next code block)