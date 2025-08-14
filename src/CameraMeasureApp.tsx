import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";

// ------------------------------------------------------------
// CameraMeasureApp
// ------------------------------------------------------------
// Um app de navegador para capturar vídeo da câmera do computador,
// congelar o quadro, marcar pontos/linhas e medir distâncias/ângulos.
// Inclui calibração por referência (2 pontos + comprimento real),
// grid, zoom/pan, exportação (PNG/CSV/JSON) e um filtro simples de bordas
// para destacar malhas/superfícies.
// ------------------------------------------------------------

export default function CameraMeasureApp() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [streamReady, setStreamReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [constraints, setConstraints] = useState<MediaStreamConstraints>({
    video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "environment" },
    audio: false,
  });

  const [isFrozen, setIsFrozen] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showEdges, setShowEdges] = useState(false);

  type Pt = { x: number; y: number };
  type Segment = { a: Pt; b: Pt; id: string; label?: string };
  type Angle = { a: Pt; b: Pt; c: Pt; id: string; label?: string };

  const [mode, setMode] = useState<"select" | "measure" | "calibrate" | "angle">("measure");
  const [tempPts, setTempPts] = useState<Pt[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [angles, setAngles] = useState<Angle[]>([]);

  // escala: unidade por pixel (ex.: mm/px)
  const [unit, setUnit] = useState<"mm" | "cm" | "in">("mm");
  const [unitPerPx, setUnitPerPx] = useState<number | null>(null);

  const pxToUnit = (px: number) => {
    if (!unitPerPx) return null;
    return px * unitPerPx;
  };

  const formatLen = (len: number | null) => {
    if (len == null) return "–";
    const v = len;
    // Mostrar 2 ou 3 casas dependendo do valor
    const decimals = v < 10 ? 3 : 2;
    return `${v.toFixed(decimals)} ${unit}`;
  };

  // Inicia câmera
  useEffect(() => {
    async function init() {
      try {
        const d = await navigator.mediaDevices.enumerateDevices();
        const vids = d.filter((x) => x.kind === "videoinput");
        setDevices(vids);
        // Primeiro dispositivo como padrão
        if (vids.length && !deviceId) {
          setDeviceId(vids[0].deviceId);
        }
      } catch (e: any) {
        console.error(e);
      }
    }
    init();
  }, [deviceId]);

  // Desenho overlay (pontos/linhas/grid)
  const draw = useCallback(() => {
    const o = overlayRef.current;
    if (!o) return;
    const ctx = o.getContext("2d")!;

    ctx.clearRect(0, 0, o.width, o.height);

    // grid
    if (showGrid) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      const step = 50; // px
      ctx.strokeStyle = "#888";
      for (let x = 0; x <= o.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, o.height);
        ctx.stroke();
      }
      for (let y = 0; y <= o.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(o.width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // segmentos
    segments.forEach((s) => {
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#22c55e";
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
      ctx.stroke();

      // pontos
      ctx.fillStyle = "#22c55e";
      [s.a, s.b].forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      // rótulo com medida
      const dx = s.b.x - s.a.x;
      const dy = s.b.y - s.a.y;
      const pix = Math.sqrt(dx * dx + dy * dy);
      const val = pxToUnit(pix);
      const label = formatLen(val);

      const midX = (s.a.x + s.b.x) / 2;
      const midY = (s.a.y + s.b.y) / 2;
      ctx.fillStyle = "#111";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 4;
      ctx.font = "600 14px ui-sans-serif, system-ui, -apple-system";
      ctx.strokeText(label, midX + 8, midY - 8);
      ctx.fillStyle = "#16a34a";
      ctx.fillText(label, midX + 8, midY - 8);

      ctx.restore();
    });

    // ângulos
    angles.forEach((a) => {
      const ctx2 = ctx;
      ctx2.save();
      ctx2.lineWidth = 3;
      ctx2.strokeStyle = "#3b82f6";

      // linhas AB e CB
      ctx2.beginPath();
      ctx2.moveTo(a.b.x, a.b.y);
      ctx2.lineTo(a.a.x, a.a.y);
      ctx2.moveTo(a.b.x, a.b.y);
      ctx2.lineTo(a.c.x, a.c.y);
      ctx2.stroke();

      // pontos
      ctx2.fillStyle = "#3b82f6";
      [a.a, a.b, a.c].forEach((p) => {
        ctx2.beginPath();
        ctx2.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx2.fill();
      });

      // valor
      const v = angleAtVertex(a.a, a.b, a.c);
      const label = `${v.toFixed(1)}°`;
      ctx2.fillStyle = "#111";
      ctx2.strokeStyle = "#fff";
      ctx2.lineWidth = 4;
      ctx2.font = "600 14px ui-sans-serif, system-ui, -apple-system";
      ctx2.strokeText(label, a.b.x + 8, a.b.y - 8);
      ctx2.fillStyle = "#2563eb";
      ctx2.fillText(label, a.b.x + 8, a.b.y - 8);

      ctx2.restore();
    });

    // pontos temporários
    if (tempPts.length) {
      const ctx3 = ctx;
      ctx3.save();
      ctx3.fillStyle = mode === "calibrate" ? "#eab308" : mode === "angle" ? "#3b82f6" : "#22c55e";
      tempPts.forEach((p) => {
        ctx3.beginPath();
        ctx3.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx3.fill();
      });
      ctx3.restore();
    }
  }, [angles, formatLen, mode, pxToUnit, segments, showGrid, tempPts]);

  // Atualiza stream quando deviceId/constraints mudam
  useEffect(() => {
    let stream: MediaStream | null = null;
    async function start() {
      try {
        if (!deviceId) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { ...((constraints.video as MediaTrackConstraints) || {}), deviceId: { exact: deviceId } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreamReady(true);
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Falha ao acessar câmera");
      }
    }
    start();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [deviceId, constraints]);

  // Ajusta canvas ao vídeo
  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    const o = overlayRef.current;
    if (!v || !c || !o) return;

    const onLoaded = () => {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      o.width = v.videoWidth;
      o.height = v.videoHeight;
      draw();
    };

    v.addEventListener("loadedmetadata", onLoaded);
    return () => v.removeEventListener("loadedmetadata", onLoaded);
  }, [streamReady, draw]);

  // Captura um frame do vídeo para o canvas de base (para aplicar filtros e salvar)
  const snapshotToCanvas = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    // espelho
    if (mirror) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, c.width, c.height);

    if (showEdges) {
      applyEdgeFilter(c);
    }
  };

  const freeze = () => {
    snapshotToCanvas();
    setIsFrozen(true);
  };

  const resume = () => {
    setIsFrozen(false);
  };

  // Clique no overlay para criar medidas
  const handleOverlayClick = (e: React.MouseEvent) => {
    const o = overlayRef.current!;
    const rect = o.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * o.width;
    const y = ((e.clientY - rect.top) / rect.height) * o.height;
    const p: Pt = { x, y };

    if (mode === "measure") {
      const pts = [...tempPts, p];
      if (pts.length === 2) {
        const seg: Segment = { a: pts[0], b: pts[1], id: crypto.randomUUID() };
        setSegments((s) => [...s, seg]);
        setTempPts([]);
      } else {
        setTempPts(pts);
      }
    } else if (mode === "calibrate") {
      const pts = [...tempPts, p];
      if (pts.length === 2) {
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        const pix = Math.sqrt(dx * dx + dy * dy);
        const input = prompt("Informe o comprimento real dessa referência (número)");
        if (input) {
          const val = parseFloat(input);
          if (!isNaN(val) && val > 0) {
            // unitPerPx = (valor na unidade atual) / pixels
            setUnitPerPx(val / pix);
          } else {
            alert("Valor inválido");
          }
        }
        setTempPts([]);
      } else {
        setTempPts(pts);
      }
    } else if (mode === "angle") {
      const pts = [...tempPts, p];
      if (pts.length === 3) {
        const ang: Angle = { a: pts[0], b: pts[1], c: pts[2], id: crypto.randomUUID() };
        setAngles((a) => [...a, ang]);
        setTempPts([]);
      } else {
        setTempPts(pts);
      }
    } else {
      // select/not used
    }

    setTimeout(draw, 0);
  };

  // Redesenhar quando estruturas mudarem
  useEffect(() => {
    draw();
  }, [segments, angles, tempPts, showGrid, unit, unitPerPx, draw]);

  // Limpeza
  const clearAll = () => {
    setSegments([]);
    setAngles([]);
    setTempPts([]);
    setUnitPerPx(null);
    draw();
  };

  // Exportações
  const downloadPNG = () => {
    const cBase = canvasRef.current!;
    const o = overlayRef.current!;

    // combinar base + overlay temporariamente em um canvas
    const out = document.createElement("canvas");
    out.width = cBase.width;
    out.height = cBase.height;
    const ctx = out.getContext("2d")!;

    ctx.drawImage(cBase, 0, 0);
    ctx.drawImage(o, 0, 0);

    const url = out.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapshot_${Date.now()}.png`;
    a.click();
  };

  const downloadJSON = () => {
    const payload = {
      unit,
      unitPerPx,
      segments: segments.map((s) => ({
        a: s.a, b: s.b,
        length_px: dist(s.a, s.b),
        length_unit: unitPerPx ? dist(s.a, s.b) * unitPerPx : null,
      })),
      angles: angles.map((a) => ({
        a: a.a, b: a.b, c: a.c,
        angle_deg: angleAtVertex(a.a, a.b, a.c),
      })),
      width: overlayRef.current?.width,
      height: overlayRef.current?.height,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medicoes_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    const rows = [
      ["type","x1","y1","x2","y2","length_px","length_unit","unit"],
      ...segments.map((s) => [
        "segment",
        s.a.x.toFixed(2), s.a.y.toFixed(2), s.b.x.toFixed(2), s.b.y.toFixed(2),
        dist(s.a, s.b).toFixed(3),
        unitPerPx ? (dist(s.a, s.b) * unitPerPx).toFixed(3) : "",
        unit
      ]),
      ["type","ax","ay","bx","by","cx","cy","angle_deg","-"],
      ...angles.map((a) => [
        "angle",
        a.a.x.toFixed(2), a.a.y.toFixed(2), a.b.x.toFixed(2), a.b.y.toFixed(2), a.c.x.toFixed(2), a.c.y.toFixed(2),
        angleAtVertex(a.a, a.b, a.c).toFixed(2), "-"
      ])
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medicoes_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtro simples de bordas (Sobel) para destacar malhas/detalhes
  const applyEdgeFilter = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d")!;
    const { width, height } = canvas;
    const img = ctx.getImageData(0, 0, width, height);
    const out = ctx.createImageData(width, height);

    const gx = [
      -1, 0, 1,
      -2, 0, 2,
      -1, 0, 1,
    ];
    const gy = [
      -1, -2, -1,
      0, 0, 0,
      1, 2, 1,
    ];

    const idx = (x: number, y: number, c: number) => (y * width + x) * 4 + c;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sx = 0, sy = 0;
        let k = 0;
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const r = img.data[idx(x + i, y + j, 0)];
            const g = img.data[idx(x + i, y + j, 1)];
            const b = img.data[idx(x + i, y + j, 2)];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            sx += gray * gx[k];
            sy += gray * gy[k];
            k++;
          }
        }
        const mag = Math.sqrt(sx * sx + sy * sy);
        const v = Math.max(0, Math.min(255, mag));
        out.data[idx(x, y, 0)] = v;
        out.data[idx(x, y, 1)] = v;
        out.data[idx(x, y, 2)] = v;
        out.data[idx(x, y, 3)] = 255;
      }
    }

    ctx.putImageData(out, 0, 0);
  };

  // Utilidades geométricas
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleAtVertex = (a: Pt, b: Pt, c: Pt) => {
    const abx = a.x - b.x, aby = a.y - b.y;
    const cbx = c.x - b.x, cby = c.y - b.y;
    const dot = abx * cbx + aby * cby;
    const la = Math.hypot(abx, aby);
    const lb = Math.hypot(cbx, cby);
    const cos = Math.max(-1, Math.min(1, dot / (la * lb)));
    return (Math.acos(cos) * 180) / Math.PI;
  };

  // UI helpers
  const startCalibrate = () => {
    setMode("calibrate");
    setTempPts([]);
  };
  const startMeasure = () => {
    setMode("measure");
    setTempPts([]);
  };
  const startAngle = () => {
    setMode("angle");
    setTempPts([]);
  };

  // Render
  return (
    <div ref={containerRef} className="min-h-screen bg-neutral-950 text-neutral-100 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-3">Câmera + Medições para CAD/3D</h1>
        <p className="text-neutral-300 mb-4">Use a câmera do seu computador no navegador, congele o quadro, marque pontos e obtenha medidas aproximadas para orientar modelagem CAD e impressão 3D. Calibre com uma referência real (régua/objeto de tamanho conhecido) para converter pixels em {unit}.</p>

        {error && (
          <div className="bg-red-600/20 border border-red-600 text-red-100 rounded-xl p-3 mb-3">{error}</div>
        )}

        {/* Controles principais */}
        <div className="grid md:grid-cols-3 gap-3 mb-4">
          <div className="rounded-2xl p-3 bg-neutral-900 border border-neutral-800">
            <h2 className="font-semibold mb-2">Câmera</h2>
            <div className="space-y-2">
              <label className="block text-sm text-neutral-300">Dispositivo</label>
              <select
                className="w-full bg-neutral-800 rounded-xl p-2"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Câmera ${i+1}`}</option>
                ))}
              </select>

              <div className="flex items-center gap-2 mt-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Espelhar</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Grid</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} /> Bordas</label>
              </div>

              <div className="flex gap-2 mt-2">
                <button onClick={freeze} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700">Congelar</button>
                <button onClick={resume} className="px-3 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600">Retomar</button>
                <button onClick={() => { snapshotToCanvas(); draw(); }} className="px-3 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600">Atualizar frame</button>
              </div>

              <div className="mt-3">
                <label className="block text-sm text-neutral-300 mb-1">Resolução (sugestão)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[[1280,720],[1920,1080],[2560,1440]].map(([w,h]) => (
                    <button key={`${w}x${h}`} onClick={() => setConstraints({ video: { width: { ideal: w }, height: { ideal: h } }, audio: false })} className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm">{w}×{h}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-3 bg-neutral-900 border border-neutral-800">
            <h2 className="font-semibold mb-2">Medições</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={startMeasure} className={`px-3 py-2 rounded-xl ${mode === 'measure' ? 'bg-emerald-600' : 'bg-neutral-800 hover:bg-neutral-700'}`}>Distância</button>
              <button onClick={startAngle} className={`px-3 py-2 rounded-xl ${mode === 'angle' ? 'bg-blue-600' : 'bg-neutral-800 hover:bg-neutral-700'}`}>Ângulo</button>
              <button onClick={startCalibrate} className={`px-3 py-2 rounded-xl ${mode === 'calibrate' ? 'bg-amber-600' : 'bg-neutral-800 hover:bg-neutral-700'}`}>Calibrar</button>
              <button onClick={() => { setSegments([]); setAngles([]); setTempPts([]); draw(); }} className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700">Limpar medições</button>
              <button onClick={clearAll} className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700">Resetar tudo</button>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div>
                <label className="block text-sm text-neutral-300">Unidade</label>
                <select className="bg-neutral-800 rounded-xl p-2" value={unit} onChange={(e) => setUnit(e.target.value as any)}>
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="in">inch</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-300">Escala (un/px)</label>
                <input className="bg-neutral-800 rounded-xl p-2 w-32" type="number" step="0.0001" value={unitPerPx ?? ''} onChange={(e) => setUnitPerPx(e.target.value === '' ? null : parseFloat(e.target.value))} placeholder="Calibre" />
              </div>
            </div>

            <p className="text-neutral-400 text-sm mt-2">Dica: para precisão, coloque um objeto de referência de tamanho conhecido (ex.: um cartão 85.60 mm de largura) no mesmo plano do objeto e use <span className="text-amber-400 font-semibold">Calibrar</span>.</p>
          </div>

          <div className="rounded-2xl p-3 bg-neutral-900 border border-neutral-800">
            <h2 className="font-semibold mb-2">Exportar</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadPNG} className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700">PNG (snapshot+overlay)</button>
              <button onClick={downloadJSON} className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700">JSON (medidas)</button>
              <button onClick={downloadCSV} className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700">CSV (medidas)</button>
            </div>
            <p className="text-neutral-400 text-sm mt-2">Os dados exportados podem ser importados no seu pipeline (.cad) para referência ao modelar.</p>
          </div>
        </div>

        {/* Área de visualização */}
        <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-black">
          {/* Vídeo */}
          <video
            ref={videoRef}
            className={`w-full h-auto ${mirror ? 'scale-x-[-1]' : ''} ${isFrozen ? 'opacity-0' : 'opacity-100'}`}
            playsInline
            muted
          />
          {/* Canvas base (frame congelado + filtros) */}
          <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full ${isFrozen ? 'opacity-100' : 'opacity-0'}`} />
          {/* Overlay de desenho/medição */}
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            onClick={handleOverlayClick}
          />
        </div>

        <div className="mt-3 text-sm text-neutral-400">
          <ul className="list-disc pl-6 space-y-1">
            <li>Fluxo básico: posicione objeto + referência → <span className="text-amber-400">Calibrar</span> (2 pontos) → <span className="text-emerald-400">Distância</span> (pares de pontos) ou <span className="text-blue-400">Ângulo</span> (3 pontos) → Exportar.</li>
            <li>Para melhores resultados, mantenha o plano do objeto perpendicular à câmera e evite perspectiva acentuada. Este app faz medição <em>2D</em> (projeção), não reconstrução 3D.</li>
            <li>Use o filtro <em>Bordas</em> ao congelar para visualizar detalhes/“malha” do objeto. Isso ajuda a marcar pontos com mais precisão.</li>
          </ul>
        </div>

        <div className="mt-6 rounded-2xl p-4 bg-neutral-900 border border-neutral-800">
          <h3 className="font-semibold mb-2">Limitações & Próximos Passos (opcional)</h3>
          <ol className="list-decimal pl-6 space-y-1 text-neutral-300">
            <li><strong>Escala dependente do plano:</strong> A calibração vale para objetos no mesmo plano (profundidade) da referência. Para 3D real, integre fotogrametria (ex.: WebAssembly de OpenMVG/OpenMVS) ou WebXR com marcadores.</li>
            <li><strong>Marcadores fiduciais:</strong> Para automação, integre detecção de <em>ArUco</em> com <code>opencv.js</code> (CDN) e um marcador de tamanho conhecido para pose/escala.</li>
            <li><strong>Exportar para CAD:</strong> Podemos adicionar exportação DXF de linhas medidas e marcações para importar no seu CAD.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
