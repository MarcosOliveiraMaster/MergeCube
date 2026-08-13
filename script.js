(() => {
  'use strict';

  /* ------------------------------------------------------------------
   * 1. RECORTE DAS 6 FACES A PARTIR DA PLANIFICAÇÃO (cube-net.png)
   *    Coordenadas mapeadas manualmente na imagem de origem (2000x1414px)
   * ------------------------------------------------------------------ */
  const NET_SRC = 'cube-net.png';

  // { face: [sx, sy, sw, sh] } em pixels da imagem original
  const FACE_CROPS = {
    top:    [675, 190, 335, 337],
    left:   [325, 528, 344, 335],
    front:  [675, 528, 335, 335],
    right:  [1016, 528, 342, 335],
    back:   [1358, 528, 342, 335],
    bottom: [675, 864, 335, 337],
  };

  const OUTPUT_SIZE = 512; // resolução de cada face recortada

  const loadingFill = document.getElementById('loadingFill');
  const loadingEl = document.getElementById('loading');

  function cropFace([sx, sy, sw, sh], img) {
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    return canvas.toDataURL('image/png');
  }

  function applyFaces(img) {
    const faces = Object.keys(FACE_CROPS);
    faces.forEach((face, i) => {
      const dataUrl = cropFace(FACE_CROPS[face], img);
      const el = document.querySelector(`.face-${face}`);
      if (el) el.style.backgroundImage = `url(${dataUrl})`;
      loadingFill.style.width = `${Math.round(((i + 1) / faces.length) * 100)}%`;
    });
    setTimeout(() => loadingEl.classList.add('hidden'), 250);
  }

  const netImage = new Image();
  netImage.onload = () => applyFaces(netImage);
  netImage.onerror = () => {
    loadingEl.querySelector('span').textContent = 'ERRO AO CARREGAR cube-net.png';
  };
  netImage.src = NET_SRC;

  /* ------------------------------------------------------------------
   * 2. ESTADO DA CÂMERA (rotação + zoom)
   * ------------------------------------------------------------------ */
  const cubeWrapper = document.getElementById('cubeWrapper');
  const scene = document.getElementById('scene');
  const statusText = document.getElementById('statusText');

  const state = {
    rotX: -18,
    rotY: -28,
    scale: 1,
    velX: 0,
    velY: 0,
    sensitivity: 1,
    autoRotate: false,
  };

  const DEFAULT_STATE = { rotX: -18, rotY: -28, scale: 1 };
  const MIN_SCALE = 0.4;
  const MAX_SCALE = 2.5;

  function render() {
    cubeWrapper.style.transform =
      `scale(${state.scale}) rotateX(${state.rotX}deg) rotateY(${state.rotY}deg)`;
  }
  render();

  /* ------------------------------------------------------------------
   * 3. ROTAÇÃO POR PONTEIRO (mouse + toque unificados via Pointer Events)
   *    + zoom por pinça (dois dedos) + inércia após soltar
   * ------------------------------------------------------------------ */
  const pointers = new Map(); // id -> {x, y}
  let dragging = false;
  let lastX = 0, lastY = 0;
  let lastMoveT = 0;
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let inertiaRAF = null;

  function setStatus(text, active) {
    statusText.textContent = text;
    statusText.classList.toggle('active', !!active);
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function stopInertia() {
    if (inertiaRAF) {
      cancelAnimationFrame(inertiaRAF);
      inertiaRAF = null;
    }
  }

  scene.addEventListener('pointerdown', (e) => {
    scene.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopInertia();

    if (pointers.size === 1) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMoveT = performance.now();
      state.velX = 0;
      state.velY = 0;
      scene.classList.add('grabbing');
      setStatus('GIRANDO', true);
    } else if (pointers.size === 2) {
      dragging = false;
      const [p1, p2] = [...pointers.values()];
      pinchStartDist = dist(p1, p2);
      pinchStartScale = state.scale;
      setStatus('AJUSTANDO ZOOM', true);
    }
  });

  scene.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      const d = dist(p1, p2);
      if (pinchStartDist > 0) {
        const factor = d / pinchStartDist;
        setScale(pinchStartScale * factor);
      }
      return;
    }

    if (!dragging || pointers.size !== 1) return;

    const now = performance.now();
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const dt = Math.max(1, now - lastMoveT);

    const sens = state.sensitivity * 0.35;
    state.rotY += dx * sens;
    state.rotX -= dy * sens;

    // velocidade para inércia (graus por ms)
    state.velX = (-dy * sens) / dt;
    state.velY = (dx * sens) / dt;

    lastX = e.clientX;
    lastY = e.clientY;
    lastMoveT = now;
    render();
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);

    if (pointers.size === 0) {
      if (dragging) {
        dragging = false;
        scene.classList.remove('grabbing');
        setStatus('ARRASTE PARA GIRAR', false);
        startInertia();
      }
    } else if (pointers.size === 1) {
      // saiu do modo pinça, volta a permitir arraste com o dedo restante
      const remaining = [...pointers.values()][0];
      lastX = remaining.x;
      lastY = remaining.y;
      lastMoveT = performance.now();
      dragging = true;
      setStatus('GIRANDO', true);
    }
  }

  scene.addEventListener('pointerup', endPointer);
  scene.addEventListener('pointercancel', endPointer);
  scene.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && pointers.has(e.pointerId)) endPointer(e);
  });

  function startInertia() {
    const friction = 0.94;
    function step() {
      state.velX *= friction;
      state.velY *= friction;
      state.rotX += state.velX * 16;
      state.rotY += state.velY * 16;
      render();
      if (Math.abs(state.velX) > 0.0008 || Math.abs(state.velY) > 0.0008) {
        inertiaRAF = requestAnimationFrame(step);
      } else {
        inertiaRAF = null;
      }
    }
    inertiaRAF = requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------
   * 4. ZOOM: roda do mouse, botões, slider — todos sincronizados
   * ------------------------------------------------------------------ */
  const zoomRange = document.getElementById('zoomRange');
  const zoomIn = document.getElementById('zoomIn');
  const zoomOut = document.getElementById('zoomOut');
  const sensRange = document.getElementById('sensRange');
  const autoRotateToggle = document.getElementById('autoRotate');
  const resetBtn = document.getElementById('resetBtn');

  function setScale(v) {
    state.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
    zoomRange.value = state.scale.toFixed(2);
    render();
  }

  scene.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0016;
    setScale(state.scale + delta);
  }, { passive: false });

  zoomRange.addEventListener('input', (e) => setScale(parseFloat(e.target.value)));
  zoomIn.addEventListener('click', () => setScale(state.scale + 0.15));
  zoomOut.addEventListener('click', () => setScale(state.scale - 0.15));

  sensRange.addEventListener('input', (e) => {
    state.sensitivity = parseFloat(e.target.value);
  });

  /* ------------------------------------------------------------------
   * 5. ROTAÇÃO AUTOMÁTICA (pausa durante interação)
   * ------------------------------------------------------------------ */
  let autoRAF = null;
  function autoStep() {
    if (state.autoRotate && !dragging && pointers.size === 0) {
      state.rotY += 0.25;
      render();
    }
    autoRAF = requestAnimationFrame(autoStep);
  }
  autoRAF = requestAnimationFrame(autoStep);

  autoRotateToggle.addEventListener('change', (e) => {
    state.autoRotate = e.target.checked;
  });

  /* ------------------------------------------------------------------
   * 6. REDEFINIR VISTA (animação suave até o estado inicial)
   * ------------------------------------------------------------------ */
  resetBtn.addEventListener('click', () => {
    stopInertia();
    autoRotateToggle.checked = false;
    state.autoRotate = false;

    const start = { rotX: state.rotX, rotY: state.rotY, scale: state.scale };
    const target = DEFAULT_STATE;
    const duration = 500;
    const t0 = performance.now();

    function ease(t) { return 1 - Math.pow(1 - t, 3); }

    function step(now) {
      const p = Math.min(1, (now - t0) / duration);
      const k = ease(p);
      state.rotX = start.rotX + (target.rotX - start.rotX) * k;
      state.rotY = start.rotY + (target.rotY - start.rotY) * k;
      state.scale = start.scale + (target.scale - start.scale) * k;
      zoomRange.value = state.scale.toFixed(2);
      render();
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });

  /* ------------------------------------------------------------------
   * 7. PREVINE GESTOS PADRÃO DO NAVEGADOR (pinch-zoom da página, etc.)
   * ------------------------------------------------------------------ */
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  scene.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
})();
