// CS405 Â· Lab 1 â€” your first triangle in WebGPU (starter)
// Work through the TODOs in order. After each one, check the matching
// checkpoint on the lab slides. The reference solution is in ../lab1-solution/.

const canvas = document.querySelector('canvas');
if (!navigator.gpu) throw new Error('WebGPU not available');

const adapter = await navigator.gpu.requestAdapter();
const device  = await adapter.requestDevice();

const ctx = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
ctx.configure({ device, format, alphaMode: 'opaque' });
console.log('WebGPU ready:', format);

const SHADER = `
  // Fare (mouse) değişkenini uniform'a ekledik
  struct U { time: f32, aspect: f32, mouse: vec2f };
  @group(0) @binding(0) var<uniform> u: U;

  struct VSOut {
    @builtin(position) pos: vec4f,
    @location(0) colour: vec4f
  };

  @vertex fn vs(@builtin(vertex_index) i: u32) -> VSOut {
    // Bir kare için iki üçgen (toplam 6 köşe)
    var p = array<vec2f, 6>(
      vec2f(-0.5,  0.5), vec2f(-0.5, -0.5), vec2f( 0.5,  0.5), // Birinci üçgen
      vec2f( 0.5,  0.5), vec2f(-0.5, -0.5), vec2f( 0.5, -0.5)  // İkinci üçgen
    );
    
    // 6 köşe için renkler
    var c = array<vec3f, 6>(
      vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 0.0, 1.0),
      vec3f(0.0, 0.0, 1.0), vec3f(0.0, 1.0, 0.0), vec3f(1.0, 1.0, 0.0)
    );

    let a = u.time;
    // 1. Kendi etrafında döndürme
    let rotated = vec2f(p[i].x * cos(a) - p[i].y * sin(a),
                        p[i].x * sin(a) + p[i].y * cos(a));
    
    // 2. Aspect Ratio (En/Boy) Düzeltmesi: Karenin esnemesini engeller
    let aspect_corrected = vec2f(rotated.x / u.aspect, rotated.y);
    
    // 3. Fare pozisyonuna öteleme
    let final_pos = aspect_corrected + u.mouse;

    var out: VSOut;
    out.pos = vec4f(final_pos, 0.0, 1.0);
    out.colour = vec4f(c[i], 1.0);
    return out;
  }

  @fragment fn fs(in: VSOut) -> @location(0) vec4f {
    return in.colour;
  }`;

const module = device.createShaderModule({ code: SHADER });

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module, entryPoint: 'vs' },
  fragment: { module, entryPoint: 'fs', targets: [{ format }] }
});


const ubuf = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

const bind = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: ubuf } }]
});

// ---------------------------------------------------------------------------
// TODO 5 â€” your turn: a square (two triangles), correct aspect ratio,
//   and the shape following the mouse.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TODO 5 — a square, correct aspect ratio, and the shape following the mouse.
// ---------------------------------------------------------------------------

// Fare koordinatlarını saklayacak değişkenler
let mouseX = 0;
let mouseY = 0;

// Fare hareketini dinle ve WebGPU koordinatlarına (-1.0 ile 1.0 arası) çevir
window.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  // X ekseni: Solda -1, Sağda +1
  mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  // Y ekseni: Tarayıcıda Y aşağı indikçe artar, WebGPU'da ise yukarı arttığı için ters çeviriyoruz (- ile çarpıyoruz)
  mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
});

const t0 = performance.now();

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}
window.addEventListener('resize', resize);
resize();

function frame() {
  const t = (performance.now() - t0) * 0.001;
  const aspect = canvas.width / canvas.height; // Güncel aspect ratio hesaplaması

  // Buffer'a 4 adet 32-bit float yolluyoruz: [time, aspect, mouseX, mouseY]
  // Bu toplamda tam olarak ayırdığımız 16 byte'a (4x4) denk gelir.
  device.queue.writeBuffer(ubuf, 0, new Float32Array([t, aspect, mouseX, mouseY]));

  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({ colorAttachments: [{
    view: ctx.getCurrentTexture().createView(),
    clearValue: { r: 0.19, g: 0.2, b: 0.6, a: 1 },
    loadOp: 'clear', storeOp: 'store' }] 
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bind);
  
  // ÖNEMLİ: Kare 2 üçgenden oluştuğu için 3 değil 6 köşe çizdiriyoruz
  pass.draw(6);
  pass.end();

  device.queue.submit([enc.finish()]);

  requestAnimationFrame(frame);
}
frame();