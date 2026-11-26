/* The builder remains the single renderer for saved house geometry. */
(function () {
  var scene = document.querySelector('#vecher .eve__scene');
  if (!scene) return;
  var frame = document.createElement('iframe');
  frame.hidden = true;
  frame.title = 'Отрисовка вашего проекта';
  frame.src = 'builder-desktop-draft.html?thumbnail=1&scene=evening#/build';
  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin || event.source !== frame.contentWindow || !event.data || event.data.type !== 'studio-project-scene') return;
    if (!event.data.saved) return;
    var svg = new DOMParser().parseFromString(event.data.svg, 'image/svg+xml').documentElement;
    if (svg.localName !== 'svg' || svg.querySelector('parsererror')) return;
    var old = scene.querySelector('.eve__house');
    var box = old ? old.getAttribute('viewBox') : '0 0 360 210';
    svg.setAttribute('viewBox', box);
    svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
    svg.setAttribute('class', 'eve__house');
    svg.setAttribute('aria-label', 'Ваш дом из конструктора');
    // Leave the page's animated sky visible behind the facade.
    var sky = Array.from(svg.querySelectorAll('rect')).find(function (r) { return +r.getAttribute('width') === 360 && +r.getAttribute('height') === 210; });
    if (sky) sky.remove();
    svg.querySelectorAll('rect,line').forEach(function (r) {
      if ((r.localName === 'rect' && +r.getAttribute('width') === 360 && +r.getAttribute('y') === 180) ||
          (r.localName === 'line' && +r.getAttribute('y1') === 180 && +r.getAttribute('x2') === 360)) r.remove();
    });
    var ns = 'http://www.w3.org/2000/svg';
    // Interior light and the Christmas tree stay behind the terrace foreground.
    var mask = document.createElementNS(ns, 'mask');
    mask.id = 'studio-interior-visibility';
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('maskContentUnits', 'userSpaceOnUse');
    mask.setAttribute('x', '-100'); mask.setAttribute('y', '-100');
    mask.setAttribute('width', '600'); mask.setAttribute('height', '500');
    var visible = document.createElementNS(ns, 'rect');
    visible.setAttribute('x', '-100'); visible.setAttribute('y', '-100');
    visible.setAttribute('width', '600'); visible.setAttribute('height', '500');
    visible.setAttribute('fill', 'white'); mask.appendChild(visible);
    svg.querySelectorAll('.railing-horizontal-board,.railing-short-post,.terrace-front-post').forEach(function (source) {
      var occluder = source.cloneNode(false);
      occluder.removeAttribute('class'); occluder.setAttribute('fill', 'black');
      mask.appendChild(occluder);
    });
    svg.querySelector('defs').appendChild(mask);

    var lights = document.createElementNS(ns, 'svg');
    lights.setAttribute('class', 'eve__lights');
    lights.setAttribute('viewBox', box);
    lights.setAttribute('preserveAspectRatio', 'xMidYMax meet');
    lights.setAttribute('aria-hidden', 'true');
    function place(node, source) {
      var ancestor = source.closest('g[transform]');
      if (ancestor) {
        var g = document.createElementNS(ns, 'g');
        g.setAttribute('transform', ancestor.getAttribute('transform'));
        g.appendChild(node); lights.appendChild(g);
      } else lights.appendChild(node);
    }
    var panes = Array.from(svg.querySelectorAll('rect')).filter(function (r) { return /url\(#.*g\)/.test(r.getAttribute('fill') || ''); });
    var mirrored = !!svg.querySelector('g[transform^="matrix(-1"]');
    function screenX(r) { var x = +r.getAttribute('x') + +r.getAttribute('width') / 2; return mirrored ? 360 - x : x; }
    var rightPane = panes.slice().sort(function (a,b) { return screenX(b)-screenX(a); })[0];
    Array.from(svg.querySelectorAll('rect')).forEach(function (r) {
      var fill = r.getAttribute('fill') || '';
      if (/url\(#.*g\)/.test(fill)) {
        var glow = r.cloneNode(false);
        glow.setAttribute('fill', '#F3C58B');
        glow.setAttribute('class', 'spill');
        // Retain visible glazing and mullions instead of a flat bright panel.
        glow.style.opacity = r === rightPane ? 'var(--bedroom-light, 0)' : 'var(--kitchen-light, 0)';
        glow.style.filter = 'drop-shadow(0 0 2px #DFA86B)';
        var interior = document.createElementNS(ns, 'g');
        interior.setAttribute('mask', 'url(#studio-interior-visibility)');
        interior.appendChild(glow);
        place(interior, r);
      }
      if (event.data.stove && fill.toUpperCase() === '#1E2124') {
        var smoke = document.createElementNS(ns, 'g');
        smoke.setAttribute('class', 'smoke');
        for (var i = 0; i < 3; i++) {
          var puff = document.createElementNS(ns, 'circle');
          puff.setAttribute('cx', +r.getAttribute('x') + +r.getAttribute('width') / 2);
          puff.setAttribute('cy', +r.getAttribute('y') - 3);
          puff.setAttribute('r', '4'); puff.setAttribute('fill', '#DFE4E8');
          smoke.appendChild(puff);
        }
        place(smoke, r);
      }
    });
    scene.querySelectorAll('svg').forEach(function (s) { s.remove(); });
    scene.appendChild(svg); scene.appendChild(lights);
    scene.dataset.project = event.data.saved ? 'saved' : 'default';
    var action = document.querySelector('#vecher [data-build]');
    if (action && event.data.saved) action.textContent = 'Продолжить мой проект';
    var title = document.querySelector('#vecher .eve__day h2');
    if (title) title.textContent = 'Ваш дом из конструктора';
    var values = document.querySelectorAll('#vecher .eve__day dd');
    if (values[0]) values[0].textContent = event.data.size.replace('x', '×') + ' м';
    if (values[1]) values[1].textContent = event.data.terrace === 'none' ? 'Без террасы' : event.data.terrace === 'along' ? 'Вдоль дома' : 'Сбоку';
    var summary = document.querySelectorAll('#vecher .plate dd');
    if (summary[0]) summary[0].textContent = event.data.size.replace('x', '×') + ' м';
    window.dispatchEvent(new Event('resize'));
  });
  document.body.appendChild(frame);
  function lightSequence() {
    var eve = document.getElementById('vecher');
    var p = parseFloat(eve.style.getPropertyValue('--sc-p')) || 0;
    function smooth(a,b) { var t=Math.max(0,Math.min(1,(p-a)/(b-a))); return t*t*(3-2*t); }
    var on = smooth(0.24,0.38);
    // Both rooms light up first. Kitchen fades out, bedroom settles to a nightlight.
    eve.style.setProperty('--kitchen-light', (on * 0.56 * (1-smooth(0.62,0.76))).toFixed(3));
    eve.style.setProperty('--bedroom-light', (on * (0.56-0.28*smooth(0.72,0.88))).toFixed(3));
    requestAnimationFrame(lightSequence);
  }
  requestAnimationFrame(lightSequence);
})();
