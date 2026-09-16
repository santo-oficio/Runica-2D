import base64

fpath = r'C:\Proyectos personales\Runika 2D\assets\menu principal\menu principal_preview.png'
with open(fpath, 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()

html_template = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Calibrar botones del menu</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #111; color: #e0e0e0; font-family: monospace; overflow: hidden; }
  #stage { position: relative; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
  #img { max-width: 100%; max-height: 100%; object-fit: contain; }
  #canvas { position: absolute; pointer-events: none; z-index: 10; }
  #info { position: fixed; top: 10px; left: 10px; z-index: 20; background: rgba(0,0,0,0.85); padding: 10px 15px; border-radius: 4px; font-size: 0.85em; line-height: 1.6; }
  #info b { color: #0ff; }
  #buttons-list { position: fixed; top: 10px; right: 10px; z-index: 20; background: rgba(0,0,0,0.85); padding: 10px 15px; border-radius: 4px; font-size: 0.8em; max-height: 80vh; overflow-y: auto; min-width: 300px; }
  #buttons-list h3 { color: #fc4; margin-bottom: 8px; }
  #buttons-list .btn-entry { margin: 4px 0; padding: 4px 6px; background: rgba(255,255,255,0.05); border-radius: 3px; }
  #buttons-list .btn-entry .del { color: #f44; cursor: pointer; margin-left: 8px; }
  #output { position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 20; background: rgba(0,0,0,0.9); padding: 10px 20px; border-radius: 4px; font-size: 0.8em; color: #0f0; max-width: 90vw; display: none; white-space: pre-wrap; max-height: 40vh; overflow-y: auto; }
</style>
</head>
<body>
<div id="info">
  <b>Calibracion de botones</b><br>
  1. Arrastra sobre cada boton para marcarlo<br>
  2. Escribe el nombre del boton<br>
  3. Pulsa <b>G</b> para descargar JSON<br>
  4. Pulsa <b>Z</b> para deshacer el ultimo<br>
  <br>
  Coordenadas normalizadas (0-1)
</div>
<div id="buttons-list"><h3>Botones marcados</h3><div id="list"><i style="color:#888">Sin botones</i></div></div>
<div id="stage">
  <img id="img" src="data:image/png;base64,__B64__" />
  <canvas id="canvas"></canvas>
</div>
<div id="output"></div>
<script>
  const img = document.getElementById("img");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const list = document.getElementById("list");
  const output = document.getElementById("output");
  let buttons = [], dragging = false, dragStart = null, dragEnd = null;

  function resizeCanvas() {
    const rect = img.getBoundingClientRect();
    canvas.width = rect.width; canvas.height = rect.height;
    canvas.style.left = rect.left + "px"; canvas.style.top = rect.top + "px";
    canvas.style.width = rect.width + "px"; canvas.style.height = rect.height + "px";
    drawButtons();
  }
  function getImgCoords(e) {
    const rect = img.getBoundingClientRect();
    return { x: Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)), y: Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height)) };
  }
  function drawButtons() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const rect = img.getBoundingClientRect();
    buttons.forEach((b,i) => {
      const x=b.x*rect.width, y=b.y*rect.height, w=b.w*rect.width, h=b.h*rect.height;
      ctx.strokeStyle="#0ff"; ctx.lineWidth=2; ctx.strokeRect(x,y,w,h);
      ctx.fillStyle="rgba(0,255,255,0.1)"; ctx.fillRect(x,y,w,h);
      ctx.fillStyle="#0ff"; ctx.font="14px monospace";
      ctx.fillText(i+": "+b.label, x+4, y+16);
    });
    if (dragging && dragStart && dragEnd) {
      const x=dragStart.x*rect.width, y=dragStart.y*rect.height, w=(dragEnd.x-dragStart.x)*rect.width, h=(dragEnd.y-dragStart.y)*rect.height;
      ctx.strokeStyle="#fc4"; ctx.lineWidth=2; ctx.setLineDash([6,4]); ctx.strokeRect(x,y,w,h); ctx.setLineDash([]);
    }
  }
  function updateList() {
    list.innerHTML = buttons.map((b,i) =>
      '<div class="btn-entry">' + i + ': ' + b.label +
      ' (' + b.x.toFixed(3) + ',' + b.y.toFixed(3) + ' ' + b.w.toFixed(3) + 'x' + b.h.toFixed(3) + ')' +
      ' <span class="del" onclick="buttons.splice(' + i + ');updateList();drawButtons()">x</span></div>'
    ).join('') || '<i style="color:#888">Sin botones</i>';
  }
  img.addEventListener("mousedown", e => { dragging=true; dragStart=getImgCoords(e); dragEnd=dragStart; });
  window.addEventListener("mousemove", e => { if(dragging){ dragEnd=getImgCoords(e); drawButtons(); } });
  window.addEventListener("mouseup", e => {
    if (dragging && dragStart && dragEnd) {
      const w=Math.abs(dragEnd.x-dragStart.x), h=Math.abs(dragEnd.y-dragStart.y);
      if (w>0.01 && h>0.01) {
        const label=prompt("Nombre del boton:", "boton " + buttons.length);
        if (label) { buttons.push({label,x:Math.min(dragStart.x,dragEnd.x),y:Math.min(dragStart.y,dragEnd.y),w,h}); updateList(); }
      }
    }
    dragging=false; dragStart=null; dragEnd=null; drawButtons();
  });
  window.addEventListener("keydown", e => {
    if (e.key==="z"||e.key==="Z") { buttons.pop(); updateList(); drawButtons(); }
    else if (e.key==="g"||e.key==="G") {
      const json=JSON.stringify(buttons,null,2);
      output.textContent=json; output.style.display="block";
      const blob=new Blob([json],{type:"application/json"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="menu-buttons.json"; a.click();
    }
  });
  img.addEventListener("load", resizeCanvas);
  window.addEventListener("resize", resizeCanvas);
</script>
</body></html>"""

html = html_template.replace("__B64__", b64)

out = r'C:\Proyectos personales\Runika 2D\calibrate-menu-standalone.html'
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'HTML creado: {len(html)/1024/1024:.1f} MB')
