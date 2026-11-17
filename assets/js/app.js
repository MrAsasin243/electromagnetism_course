(function(){
  'use strict';
  const topics = Array.isArray(window.EM_TOPICS) ? window.EM_TOPICS : [];
  const $ = (id) => document.getElementById(id);
  const nav = $('courseNav'), page = $('topicPage'), welcome = $('welcomePanel');
  let activeIndex = 0;
  let tocObserver = null;
  const progressKey = 'em-course-completed-v1';
  let completed = new Set();
  try { completed = new Set(JSON.parse(localStorage.getItem(progressKey) || '[]')); } catch(e) {}

  const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const inline = (s='') => String(s); // HTML is intentionally allowed in authored topic content.
  const groupTopics = () => {
    const groups = [];
    topics.forEach((t,i)=>{
      let g = groups.find(x=>x.name===t.chapter);
      if(!g){g={name:t.chapter,items:[]};groups.push(g)}
      g.items.push({...t,_index:i});
    });
    return groups;
  };
  function renderNav(filter=''){
    const q=filter.trim().toLocaleLowerCase('ru');
    nav.innerHTML='';
    groupTopics().forEach(group=>{
      const matches=group.items.filter(t=>!q || (t.title+' '+t.chapter+' '+(t.tags||[]).join(' ')).toLocaleLowerCase('ru').includes(q));
      if(!matches.length)return;
      const wrap=document.createElement('div');wrap.className='nav-group';
      const heading=document.createElement('div');heading.className='nav-heading';heading.textContent=group.name;wrap.appendChild(heading);
      matches.forEach(t=>{
        const b=document.createElement('button');b.className='nav-link'+(t._index===activeIndex?' active':'');
        b.innerHTML=`<span class="nav-number">${String(t.number||'').padStart(2,'0')}</span><span>${escapeHtml(t.title)}</span>`;
        b.addEventListener('click',()=>{showTopic(t._index);closeSidebar()});wrap.appendChild(b);
      });nav.appendChild(wrap);
    });
    if(!nav.children.length)nav.innerHTML='<div class="empty-state">Ничего не найдено</div>';
  }
  function updateProgress(){
    const count=topics.length, done=topics.filter(t=>completed.has(t.id)).length, p=count?Math.round(done/count*100):0;
    $('progressValue').textContent=p+'%';$('progressBar').style.width=p+'%';
  }
  function renderFormula(f){const tex=escapeHtml(f.formula||'');return `<div class="formula-card"><div class="formula-label">${escapeHtml(f.label||'Основная формула')}</div><div class="formula">\\[${tex}\\]</div>${f.explain?`<div class="formula-explain">${inline(f.explain)}</div>`:''}</div>`}
  function renderSection(s,i){
    let content=(s.body||[]).map(p=>`<p>${inline(p)}</p>`).join('');
    if(s.list?.length)content+=`<ul>${s.list.map(x=>`<li>${inline(x)}</li>`).join('')}</ul>`;
    if(s.definition)content+=`<div class="definition"><div class="definition-label">Определение</div>${inline(s.definition)}</div>`;
    if(s.formulas?.length)content+=s.formulas.map(renderFormula).join('');
    if(s.note)content+=`<div class="callout"><strong>${escapeHtml(s.noteTitle||'Важно.')} </strong>${inline(s.note)}</div>`;
    return `<section class="section-block" id="sec-${escapeHtml(s.id||i)}"><div class="section-heading"><div class="section-index">${String(i+1).padStart(2,'0')}</div><h2>${escapeHtml(s.title)}</h2></div><div class="section-content">${content}</div></section>`;
  }
  function renderExample(e){return `<div class="example-card"><div class="example-tag">Разобранный пример</div><h3>${escapeHtml(e.title)}</h3><p><b>Условие.</b> ${inline(e.problem)}</p>${(e.steps||[]).map((s,i)=>`<div class="solution-step"><b>${i+1}.</b><div>${inline(s)}</div></div>`).join('')}${e.answer?`<p><b>Ответ:</b> ${inline(e.answer)}</p>`:''}</div>`}
  function renderQuiz(q,idx){
    const opts=q.options.map((o,i)=>`<button class="quiz-option" data-quiz="${idx}" data-option="${i}">${String.fromCharCode(65+i)}. ${inline(o)}</button>`).join('');
    return `<div class="quiz-card" data-quiz-card="${idx}"><h3>Проверка понимания: ${inline(q.question)}</h3>${opts}<div class="quiz-feedback" id="quiz-feedback-${idx}"></div></div>`;
  }
  function visualMarkup(v,idx){
    return `<div class="visual-card" data-visual="${escapeHtml(v.type)}" data-visual-id="${idx}"><div class="visual-top"><div><div class="visual-kicker">ИНТЕРАКТИВНАЯ МОДЕЛЬ</div><h3>${escapeHtml(v.title)}</h3><div class="visual-description">${inline(v.description||'Изменяйте параметры модели и наблюдайте, как меняется результат.')}</div></div><span class="visual-tag">Модель</span></div><div class="visual-stage" id="visual-stage-${idx}"></div><div class="visual-controls" id="visual-controls-${idx}"></div><div class="visual-result" id="visual-result-${idx}"></div><div class="visual-legend" id="visual-legend-${idx}"></div></div>`;
  }
  function showTopic(index){
    if(!topics.length){page.innerHTML='<div class="empty-state">Добавьте хотя бы одну тему в реестр.</div>';return}
    activeIndex=Math.max(0,Math.min(index,topics.length-1));
    const t=topics[activeIndex];
    welcome.hidden=true;page.hidden=false;
    $('breadcrumbs').innerHTML=`${escapeHtml(t.chapter)} <span>/</span> ${escapeHtml(t.title)}`;
    const sections=t.sections||[];
    let toc=sections.map((s,i)=>`<a class="toc-link" href="#sec-${escapeHtml(s.id||i)}">${String(i+1).padStart(2,'0')} · ${escapeHtml(s.title)}</a>`).join('');
    if(t.examples?.length)toc+=`<a class="toc-link" href="#examples">EX · Разобранные задачи</a>`;
    if(t.quiz?.length)toc+=`<a class="toc-link" href="#self-check">? · Проверка знаний</a>`;
    let body='';
    if(t.definition)body+=`<div class="definition"><div class="definition-label">Ключевая идея</div>${inline(t.definition)}</div>`;
    if(t.visuals?.length)body+=t.visuals.map(visualMarkup).join('');
    body+=sections.map(renderSection).join('');
    if(t.examples?.length)body+=`<section class="section-block" id="examples"><div class="section-heading"><div class="section-index">EX</div><h2>Разобранные задачи</h2></div>${t.examples.map(renderExample).join('')}</section>`;
    if(t.quiz?.length)body+=`<section class="section-block" id="self-check"><div class="section-heading"><div class="section-index">?</div><h2>Проверь себя</h2></div>${t.quiz.map(renderQuiz).join('')}</section>`;
    if(t.takeaways?.length)body+=`<div class="takeaways"><h3>Что необходимо запомнить</h3><ul>${t.takeaways.map(x=>`<li>${inline(x)}</li>`).join('')}</ul></div>`;
    const prev=activeIndex>0?topics[activeIndex-1]:null,next=activeIndex<topics.length-1?topics[activeIndex+1]:null;
    body+=`<div class="page-navigation">${prev?`<button data-go="${activeIndex-1}"><span>← ПРЕДЫДУЩАЯ ТЕМА</span>${escapeHtml(prev.title)}</button>`:'<span></span>'}${next?`<button class="next" data-go="${activeIndex+1}"><span>СЛЕДУЮЩАЯ ТЕМА →</span>${escapeHtml(next.title)}</button>`:''}</div>`;
    if(window.MathJax?.typesetClear)window.MathJax.typesetClear([page]);
    const objectives=(t.objectives||[]).length?`<div class="rail-card"><div class="rail-title">Результаты изучения</div><ul class="objectives">${t.objectives.map(x=>`<li>${inline(x)}</li>`).join('')}</ul></div>`:'';
    page.innerHTML=`<header class="topic-header"><div class="chapter-kicker">${escapeHtml(t.chapter)} · §${escapeHtml(String(t.number||''))}</div><h1>${escapeHtml(t.title)}</h1><p class="topic-lead">${inline(t.lead||'')}</p><div class="topic-meta"><span class="meta-chip">${escapeHtml(t.level||'Базовый уровень')}</span><span class="meta-chip">Система СИ</span><span class="meta-chip">${sections.length} разделов</span></div></header><div class="learning-grid"><div class="topic-body">${body}</div><aside class="right-rail"><div class="rail-card"><div class="rail-title">На этой странице</div>${toc}</div>${objectives}<div class="rail-card"><button class="primary-button" id="markComplete">${completed.has(t.id)?'✓ Изучено':'Отметить изученным'}</button></div></aside></div>`;
    renderNav($('topicSearch').value);updateProgress();attachPageEvents();activateToc();initVisuals();
    if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise([page]).catch(err=>console.error('MathJax:',err));
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function activateToc(){
    if(tocObserver){tocObserver.disconnect();tocObserver=null}
    const links=[...page.querySelectorAll('.toc-link[href^="#"]')];
    if(!links.length || !('IntersectionObserver' in window))return;
    const targets=links.map(a=>$(decodeURIComponent(a.getAttribute('href').slice(1)))).filter(Boolean);
    if(!targets.length)return;
    const byId=new Map(links.map(a=>[decodeURIComponent(a.getAttribute('href').slice(1)),a]));
    tocObserver=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
      if(!visible.length)return;
      links.forEach(a=>{a.classList.remove('active');a.removeAttribute('aria-current')});
      const active=byId.get(visible[0].target.id);
      if(active){active.classList.add('active');active.setAttribute('aria-current','location')}
    },{rootMargin:'-78px 0px -68% 0px',threshold:0});
    targets.forEach(target=>tocObserver.observe(target));
  }
  function attachPageEvents(){
    page.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showTopic(Number(b.dataset.go))));
    const done=$('markComplete');if(done)done.addEventListener('click',()=>{const id=topics[activeIndex].id;if(completed.has(id))completed.delete(id);else completed.add(id);try{localStorage.setItem(progressKey,JSON.stringify([...completed]))}catch(e){}done.textContent=completed.has(id)?'✓ Изучено':'Отметить изученным';updateProgress()});
    page.querySelectorAll('[data-quiz]').forEach(b=>b.addEventListener('click',()=>{
      const qi=Number(b.dataset.quiz),oi=Number(b.dataset.option),q=topics[activeIndex].quiz[qi];
      const all=page.querySelectorAll(`[data-quiz="${qi}"]`);all.forEach(x=>{x.disabled=true;const n=Number(x.dataset.option);if(n===q.answer)x.classList.add('correct');else if(n===oi)x.classList.add('wrong')});
      const f=$(`quiz-feedback-${qi}`);f.textContent=oi===q.answer?'Верно. '+(q.explain||''): 'Неверно. '+(q.explain||'Попробуйте ещё раз при повторном изучении темы.');
    }));
  }
  function closeSidebar(){if(window.innerWidth<=760){$('sidebar').classList.remove('open');$('sidebarScrim').classList.remove('show')}}
  $('topicSearch').addEventListener('input',e=>renderNav(e.target.value));
  $('mobileMenu').addEventListener('click',()=>{$('sidebar').classList.toggle('open');$('sidebarScrim').classList.toggle('show')});
  $('sidebarScrim').addEventListener('click',closeSidebar);
  $('startCourse').addEventListener('click',()=>showTopic(0));
  document.addEventListener('keydown',e=>{if(e.key==='/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('topicSearch').focus()}if(e.key==='Escape')closeSidebar()});
  $('fontSmaller').addEventListener('click',()=>{const v=Math.max(.9,parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale'))-.05);document.documentElement.style.setProperty('--font-scale',v)});
  $('fontLarger').addEventListener('click',()=>{const v=Math.min(1.2,parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale'))+.05);document.documentElement.style.setProperty('--font-scale',v)});
  $('topicCount').textContent=topics.length;renderNav();updateProgress();
  const initial=new URLSearchParams(location.search).get('topic');const start=initial?topics.findIndex(t=>t.id===initial):-1;
  if(start>=0)showTopic(start);else{welcome.hidden=false;page.hidden=true}

  // SVG helpers and interactive physical models.
  const NS='http://www.w3.org/2000/svg';
  const svgEl=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e};
  const fmt=(n,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
  function makeRange(container,label,min,max,step,value,suffix,cb){
    const wrap=document.createElement('div');wrap.className='control-item';const lab=document.createElement('label');const l=document.createElement('span');l.textContent=label;const out=document.createElement('output');out.textContent=value+suffix;lab.append(l,out);const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=value;input.addEventListener('input',()=>{out.textContent=input.value+suffix;cb(Number(input.value))});wrap.append(lab,input);container.append(wrap);return input;
  }
  function baseSvg(stage,w=640,h=240){stage.innerHTML='';const s=svgEl('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':'Интерактивная физическая схема'});stage.append(s);return s}
  function text(svg,x,y,str,fill='#eaf3ec',size=11,anchor='middle'){const e=svgEl('text',{x,y,fill,'font-size':size,'text-anchor':anchor,'font-family':'Manrope,Arial'});e.textContent=str;svg.append(e);return e}
  function line(svg,x1,y1,x2,y2,stroke='#b4cbb9',width=1.4,dash=''){svg.append(svgEl('line',{x1,y1,x2,y2,stroke,'stroke-width':width,'stroke-dasharray':dash,'stroke-linecap':'round'}))}
  function circle(svg,cx,cy,r,fill,stroke='#d8e9dd'){svg.append(svgEl('circle',{cx,cy,r,fill,stroke,'stroke-width':1.2}))}
  function addArrow(svg,x1,y1,x2,y2,color='#d4b274',width=1.8,head=8){
    const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);
    if(len<1)return;
    const ux=dx/len,uy=dy/len,px=-uy,py=ux;
    line(svg,x1,y1,x2-ux*head*.55,y2-uy*head*.55,color,width);
    const bx=x2-ux*head,by=y2-uy*head;
    const p=`M ${x2} ${y2} L ${bx+px*head*.48} ${by+py*head*.48} L ${bx-px*head*.48} ${by-py*head*.48} Z`;
    svg.append(svgEl('path',{d:p,fill:color,stroke:color,'stroke-width':.6}));
  }
  function fmtExp(n,sig=3){
    if(!Number.isFinite(n))return '—';
    if(n===0)return '0';
    const a=Math.abs(n);
    if(a>=0.01&&a<10000)return Number(n.toPrecision(sig)).toString().replace('.',',');
    const [mantissa,exponent]=n.toExponential(sig-1).split('e');
    const power=Number(exponent),sign=power<0?'−':'';
    return `${mantissa.replace('.',',')} × 10<sup>${sign}${Math.abs(power)}</sup>`;
  }
  function drawField(svg,cx,cy,charge,scale=1,maxLines=16){
    const magnitude=Math.abs(charge);
    const color=charge>=0?'#e3bd75':'#7db7d0';
    const count=magnitude===0?0:Math.max(4,Math.min(maxLines,Math.round(magnitude*1.5)));
    const radius=90*scale;
    for(let a=0;a<count;a++){
      const ang=2*Math.PI*a/count;
      const x1=cx+Math.cos(ang)*15,y1=cy+Math.sin(ang)*15;
      const x2=cx+Math.cos(ang)*radius,y2=cy+Math.sin(ang)*radius;
      if(charge>0)addArrow(svg,x1,y1,x2,y2,color,1.15,6);
      else addArrow(svg,x2,y2,x1,y1,color,1.15,6);
    }
    circle(svg,cx,cy,13,charge>0?'#d9a64e':charge<0?'#5797b5':'#71867a');
    text(svg,cx,cy+4,charge>0?'+':charge<0?'−':'0','#15241d',14);
  }
  function drawAxis(svg,x1,y,x2,label){
    line(svg,x1,y,x2,y,'#849b8c',1);
    addArrow(svg,x2-15,y,x2,y,'#849b8c',1,5);
    if(label)text(svg,x2,y+16,label,'#b9c9bd',10);
  }
  function drawDipoleStreamlines(svg,xp,xn,cy){
    const field=(x,y)=>{
      const ax=x-xp,ay=y-cy,bx=x-xn,by=y-cy;
      const ra=Math.max(10,Math.hypot(ax,ay)),rb=Math.max(10,Math.hypot(bx,by));
      let ex=ax/(ra*ra*ra)-bx/(rb*rb*rb),ey=ay/(ra*ra*ra)-by/(rb*rb*rb);
      const m=Math.hypot(ex,ey)||1;return [ex/m,ey/m];
    };
    const step=(x,y,h)=>{
      const k1=field(x,y),k2=field(x+h*k1[0]/2,y+h*k1[1]/2),k3=field(x+h*k2[0]/2,y+h*k2[1]/2),k4=field(x+h*k3[0],y+h*k3[1]);
      return [x+h*(k1[0]+2*k2[0]+2*k3[0]+k4[0])/6,y+h*(k1[1]+2*k2[1]+2*k3[1]+k4[1])/6];
    };
    const seeds=20;
    for(let i=0;i<seeds;i++){
      const a=2*Math.PI*i/seeds;
      let x=xp+17*Math.cos(a),y=cy+17*Math.sin(a),pts=[[x,y]];
      for(let n=0;n<850;n++){
        const next=step(x,y,2.0);x=next[0];y=next[1];pts.push([x,y]);
        if(Math.hypot(x-xn,y-cy)<15)break;
        if(x<18||x>622||y<18||y>222)break;
        if(Math.hypot(x-xp,y-cy)<14)break;
      }
      if(pts.length<5)continue;
      const d=pts.map((p,j)=>(j?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
      svg.append(svgEl('path',{d,fill:'none',stroke:'#d9bd82','stroke-width':1.05,opacity:.85}));
      const k=Math.min(pts.length-2,Math.max(2,Math.floor(pts.length*.52))),a1=pts[k],a2=pts[k+1];
      addArrow(svg,a1[0],a1[1],a2[0],a2[1],'#f0d69e',1.1,5);
    }
  }
  function initVisuals(){
    page.querySelectorAll('.visual-card').forEach(card=>{
      const type=card.dataset.visual,idx=card.dataset.visualId;
      const stage=$(`visual-stage-${idx}`),controls=$(`visual-controls-${idx}`),result=$(`visual-result-${idx}`),legend=$(`visual-legend-${idx}`);
      controls.innerHTML='';result.innerHTML='';legend.innerHTML='';
      let state=[];
      const update=()=>{
        let svg;
        if(type==='charge'){
          const [q]=state;svg=baseSvg(stage);drawField(svg,320,116,q,1.0,18);
          text(svg,320,218,'Направление стрелок совпадает с направлением поля','#bdcfc2',10);
          result.innerHTML=q===0?'При q = 0 электрического поля нет.':`Заряд <strong>${q>0?'+':''}${q.toFixed(1)} нКл</strong> · ${q>0?'поле направлено от заряда':'поле направлено к заряду'}`;
          legend.innerHTML='<span><i class="legend-dot" style="background:#e3bd75"></i>Положительный заряд и исходящие линии</span><span><i class="legend-dot" style="background:#7db7d0"></i>Отрицательный заряд и входящие линии</span>';
        }
        else if(type==='coulomb'){
          const [q1,q2,r]=state;svg=baseSvg(stage);
          const half=65+(r-.5)*32,x1=320-half,x2=320+half,y=122;
          line(svg,x1,y,x2,y,'#6b8b77',1.5,'5 5');
          circle(svg,x1,y,Math.max(12,Math.min(22,12+Math.abs(q1)*.7)),q1>0?'#d5a64f':q1<0?'#5b9cba':'#71867a');
          circle(svg,x2,y,Math.max(12,Math.min(22,12+Math.abs(q2)*.7)),q2>0?'#d5a64f':q2<0?'#5b9cba':'#71867a');
          text(svg,x1,y+5,q1>0?'+':q1<0?'−':'0','#14241c',15);text(svg,x2,y+5,q2>0?'+':q2<0?'−':'0','#14241c',15);
          text(svg,320,84,`r = ${r.toFixed(1).replace('.',',')} м`,'#c6d4ca',11);
          text(svg,x1,y+43,'q₁','#c5d4c8',10);text(svg,x2,y+43,'q₂','#c5d4c8',10);
          const product=q1*q2;
          const F=8.9875517923e9*Math.abs(q1*1e-9*q2*1e-9)/(r*r);
          if(product!==0){
            const repel=product>0,dir1=repel?-1:1,dir2=-dir1;
            const arrowLen=Math.max(15,Math.min(58,15+10*Math.log10(1+F/1e-10)));
            addArrow(svg,x1,y-21,x1+dir1*arrowLen,y-21,'#f0ca85',2.1,8);
            addArrow(svg,x2,y-21,x2+dir2*arrowLen,y-21,'#f0ca85',2.1,8);
          }
          result.innerHTML=product===0?'При нулевом одном из зарядов сила взаимодействия равна нулю.':`Модуль силы <strong>${fmtExp(F)} Н</strong> · ${product>0?'отталкивание':'притяжение'} · стрелки показывают силы на каждом заряде`;
          legend.innerHTML='<span><i class="legend-dot" style="background:#d5a64f"></i>q &gt; 0</span><span><i class="legend-dot" style="background:#5b9cba"></i>q &lt; 0</span><span>Стрелки — силы Кулона</span>';
        }
        else if(type==='superposition'){
          const [q1,q2,d]=state;svg=baseSvg(stage);const half=45+(d-.5)*34,x1=320-half,x2=320+half,y=76;
          line(svg,x1,y,x2,y,'#799181',1.2,'4 4');
          circle(svg,x1,y,13,q1>0?'#d5a64f':q1<0?'#5b9cba':'#71867a');circle(svg,x2,y,13,q2>0?'#d5a64f':q2<0?'#5b9cba':'#71867a');
          text(svg,x1,y+4,q1>0?'+':q1<0?'−':'0','#14241c',14);text(svg,x2,y+4,q2>0?'+':q2<0?'−':'0','#14241c',14);
          line(svg,320,48,320,222,'#8ba092',1,'3 4');circle(svg,320,76,4,'#f3f3df');text(svg,320,35,'P — точка наблюдения (середина отрезка)','#c7d5cb',10);
          const r=d/2,k=8.9875517923e9,E1=k*q1*1e-9/(r*r),E2=-k*q2*1e-9/(r*r),Et=E1+E2;
          const max=Math.max(Math.abs(E1),Math.abs(E2),Math.abs(Et),1e-20),scale=145/max;
          const vec=(val,yy,color,label)=>{text(svg,74,yy+4,label,'#c7d5cb',10,'start');circle(svg,320,yy,2,'#eef5ef');if(Math.abs(val)>1e-15)addArrow(svg,320,yy,320+Math.sign(val)*Math.max(12,Math.abs(val)*scale),yy,color,2.2,8);else text(svg,337,yy+4,'0','#c7d5cb',10,'start')};
          vec(E1,126,'#e4c078','E₁');vec(E2,164,'#80b8d0','E₂');vec(Et,207,'#9bd2a8','EΣ');
          result.innerHTML=`В точке P: <strong>E₁ₓ = ${fmtExp(E1)} Н/Кл</strong> · <strong>E₂ₓ = ${fmtExp(E2)} Н/Кл</strong> · <strong>EΣₓ = ${fmtExp(Et)} Н/Кл</strong>`;
          legend.innerHTML='<span><i class="legend-dot" style="background:#e4c078"></i>Вклад q₁</span><span><i class="legend-dot" style="background:#80b8d0"></i>Вклад q₂</span><span><i class="legend-dot" style="background:#9bd2a8"></i>Результирующий вектор</span>';
        }
        else if(type==='gauss'){
          const [q,r]=state;svg=baseSvg(stage);const rad=34+(r-.5)*8.5,cx=320,cy=116;
          circle(svg,cx,cy,rad,'rgba(112,166,132,.08)','#8db59a');
          const qC=q*1e-9,eps0=8.8541878128e-12,k=8.9875517923e9,E=k*Math.abs(qC)/(r*r),flux=qC/eps0;
          const arrowLen=q===0?0:8+30*Math.sqrt(E/(k*8e-9/(.5*.5)));
          for(let i=0;i<12;i++){const a=i*Math.PI/6,ux=Math.cos(a),uy=Math.sin(a),sx=cx+ux*(rad+2),sy=cy+uy*(rad+2),ex=cx+ux*(rad+arrowLen),ey=cy+uy*(rad+arrowLen);if(q>0)addArrow(svg,sx,sy,ex,ey,'#e0ba76',1.35,6);else if(q<0)addArrow(svg,ex,ey,sx,sy,'#80b9d0',1.35,6)}
          circle(svg,cx,cy,13,q>0?'#d5a64f':q<0?'#5b9cba':'#71867a');text(svg,cx,cy+4,q>0?'+':q<0?'−':'0','#14241c',15);
          text(svg,320,22,'Замкнутая сферическая поверхность радиуса r','#bdcfc2',10);
          result.innerHTML=`На сфере: <strong>E = ${fmtExp(E)} Н/Кл</strong> · Поток: <strong>Φ<sub>E</sub> = ${fmtExp(flux)} Н·м²/Кл</strong> · изменение r меняет E, но не поток`;
          legend.innerHTML='<span>Точечный заряд в центре сферы. Поле на сфере однородно по модулю; полный поток не зависит от радиуса.</span>';
        }
        else if(type==='potential'){
          const [q,r0]=state;svg=baseSvg(stage);const left=70,right=590,top=32,bottom=195,y0=(top+bottom)/2;
          drawAxis(svg,left,y0,right,'r, м');line(svg,left,top,left,bottom,'#849b8c',1);text(svg,left-12,top+3,'φ, В','#c7d5cb',10);
          const rMin=.3,rMax=5,k=8.9875517923e9,qC=q*1e-9,vMax=q===0?1:k*Math.abs(qC)/rMin;
          const toX=r=>left+(r-rMin)/(rMax-rMin)*(right-left),toY=v=>y0-v/(vMax*1.12)*((bottom-top)/2-5);
          let d='';for(let i=0;i<=180;i++){const rr=rMin+(rMax-rMin)*i/180,phi=q===0?0:k*qC/rr;d+=(i?' L ':'M ')+toX(rr).toFixed(2)+' '+toY(phi).toFixed(2)}
          svg.append(svgEl('path',{d,stroke:q>=0?'#e2ba77':'#7eb8d1','stroke-width':2.5,fill:'none'}));
          const phi=q===0?0:k*qC/r0,x=toX(r0),y=toY(phi);line(svg,x,top,x,bottom,'#b6c7ba',1,'3 4');circle(svg,x,y,5,'#f3dfb5','#fff');
          text(svg,95,219,'0,3','#b8c9bd',9);text(svg,580,219,'5,0','#b8c9bd',9,'end');
          const E=k*Math.abs(qC)/(r0*r0);
          result.innerHTML=`При r = ${r0.toFixed(2).replace('.',',')} м: <strong>φ = ${fmtExp(phi)} В</strong> · <strong>|E| = ${fmtExp(E)} Н/Кл</strong> · знак φ совпадает со знаком q`;
          legend.innerHTML='<span>График: φ(r) = kq/r · координата r отсчитывается от заряда</span>';
        }
        else if(type==='dipole'){
          const [q,d]=state;svg=baseSvg(stage);const half=d*10,xp=320-half,xn=320+half,cy=112;
          drawDipoleStreamlines(svg,xp,xn,cy);
          circle(svg,xp,cy,13,'#d6a653');circle(svg,xn,cy,13,'#5898b7');text(svg,xp,cy+5,'+','#16241d',14);text(svg,xn,cy+5,'−','#16241d',14);
          addArrow(svg,xn,196,xp,196,'#b5d6bd',2.2,9);text(svg,320,216,'p⃗ направлен от −q к +q','#c1d2c6',10);
          addArrow(svg,284,160,356,160,'#f0d39a',1.7,7);text(svg,320,149,'E в середине: от +q к −q','#c1d2c6',9);
          const qC=q*1e-9,dM=d*1e-2,k=8.9875517923e9,p=qC*dM,E=8*k*qC/(dM*dM);
          result.innerHTML=`Дипольный момент <strong>p = ${fmtExp(p)} Кл·м</strong> · поле в середине диполя <strong>E = ${fmtExp(E)} Н/Кл</strong> (направлено от +q к −q)`;
          legend.innerHTML='<span>Линии поля рассчитаны для пары равных по модулю зарядов +q и −q; стрелки направлены от + к −</span>';
        }
        else if(type==='conductor'){
          const [q,Rcm]=state;svg=baseSvg(stage);const cx=320,cy=116,rad=35+Rcm*3.5;
          circle(svg,cx,cy,rad,'rgba(123,170,139,.13)','#98bda0');circle(svg,cx,cy,rad-7,'#294033','#8db79a');
          text(svg,cx,cy+4,'E = 0','#d7e9dc',14);text(svg,320,20,'Проводник в электростатическом равновесии','#c1d1c5',10);
          const qC=q*1e-9,R=Rcm*1e-2,k=8.9875517923e9,sigma=qC/(4*Math.PI*R*R),E=k*Math.abs(qC)/(R*R);
          if(q!==0){
            const sigmaRatio=Math.min(1,Math.abs(sigma)/(8e-9/(4*Math.PI*.02*.02)));
            const markerR=1.4+2.2*sigmaRatio;
            for(let i=0;i<16;i++){const a=2*Math.PI*i/16,x=cx+Math.cos(a)*rad,y=cy+Math.sin(a)*rad;circle(svg,x,y,markerR,q>0?'#e3bd75':'#80b9d0','#15251e')}
            const arrowLen=8+24*Math.sqrt(E/(k*8e-9/(.02*.02)));
            for(let i=0;i<10;i++){const a=2*Math.PI*i/10,ux=Math.cos(a),uy=Math.sin(a),sx=cx+ux*(rad+7),sy=cy+uy*(rad+7),ex=cx+ux*(rad+arrowLen),ey=cy+uy*(rad+arrowLen);if(q>0)addArrow(svg,sx,sy,ex,ey,'#e3bd75',1.3,6);else addArrow(svg,ex,ey,sx,sy,'#80b9d0',1.3,6)}
          }
          result.innerHTML=q===0?'Нейтральная сферическая оболочка: поле от её собственного заряда отсутствует. Внутри проводящего материала E = 0.':`На поверхности: <strong>σ = ${fmtExp(sigma)} Кл/м²</strong> · <strong>E<sub>снаружи</sub> = ${fmtExp(E)} Н/Кл</strong> · ${q>0?'поле направлено наружу':'поле направлено к поверхности'}`;
          legend.innerHTML='<span>Стрелки показывают внешнее поле сферического проводника; внутри металла в равновесии E = 0.</span>';
        }
        else if(type==='dielectric'){
          const [er,sigmaNC]=state;svg=baseSvg(stage);const eps0=8.8541878128e-12,sigmaF=sigmaNC*1e-5,D=sigmaF,E=sigmaF/(eps0*er),P=eps0*(er-1)*E;
          // Parallel-plate arrangement: left free plate is positive, right free plate is negative.
          line(svg,112,42,112,190,'#e0b875',7);line(svg,528,42,528,190,'#80b9d0',7);
          text(svg,112,28,'+σсвоб','#e6c98f',11);text(svg,528,28,'−σсвоб','#9ac9db',11);
          svg.append(svgEl('rect',{x:236,y:48,width:168,height:136,rx:5,fill:'rgba(119,173,143,.12)',stroke:'#8cb79b','stroke-width':1.3}));
          // Bound surface charges: negative on the left face, positive on the right.
          const pMax=2e-5*(5/6),pRatio=Math.min(1,P/pMax),boundDotR=1.2+2.3*pRatio;
          if(P>0){for(let i=0;i<7;i++){const yy=60+i*19;circle(svg,226,yy,boundDotR,'#82c0d6','#d2e5eb');circle(svg,414,yy,boundDotR,'#e3bd75','#f2dfb4')}}
          const pLen=(er-1)/5*32,eLen=40/er;
          for(let i=0;i<5;i++){const yy=72+i*22;if(pLen>0)addArrow(svg,260,yy,260+pLen,yy,'#e4c078',1.5,6);circle(svg,304,yy,5,'#699f84');}
          for(let i=0;i<3;i++){const yy=84+i*37;addArrow(svg,350,yy,350+eLen,yy,'#91c5d8',1.5,6)}
          text(svg,320,210,'P⃗ направлен вдоль E⃗; связанные заряды появляются на гранях','#c4d3c8',10);
          result.innerHTML=`εᵣ = ${er.toFixed(1).replace('.',',')} · <strong>E = ${fmtExp(E)} В/м</strong> · <strong>P = ${fmtExp(P)} Кл/м²</strong> · |σ<sub>связ</sub>| = P`;
          legend.innerHTML='<span>Синие точки — отрицательный связанный заряд, золотые — положительный. Длина стрелок P и размер точек растут с поляризацией; при εᵣ = 1 связанных зарядов нет.</span><span>При фиксированном σсвоб: D = σсвоб, E = D/(ε₀εᵣ), P = ε₀(εᵣ−1)E.</span>';
        }
        else if(type==='capacitor'){
          const [area,gap,u,er]=state;svg=baseSvg(stage);const areaScale=Math.sqrt(area/20),plateH=Math.max(64,Math.min(142,104*areaScale)),gapPx=58+gap*13,x1=320-gapPx/2,x2=320+gapPx/2,y1=116-plateH/2,y2=116+plateH/2;
          line(svg,x1,y1,x1,y2,'#d7ad67',6);line(svg,x2,y1,x2,y2,'#78b6ce',6);
          text(svg,x1,Math.max(20,y1-12),'+Q','#e6bd78',12);text(svg,x2,Math.max(20,y1-12),'−Q','#83c3d9',12);
          const eps0=8.8541878128e-12,A=area*1e-4,dM=gap*1e-3,C=eps0*er*A/dM,E=u/dM,W=.5*C*u*u,Q=C*u;
          const n=7,fieldArrowLen=8+16*Math.min(1,E/60000);
          for(let i=0;i<n;i++){const yy=y1+10+(plateH-20)*i/(n-1),mid=(x1+x2)/2;addArrow(svg,mid-fieldArrowLen/2,yy,mid+fieldArrowLen/2,yy,'#c7d9cb',1.0,5)}
          text(svg,320,210,`S = ${area.toFixed(0)} см² · d = ${gap.toFixed(1).replace('.',',')} мм`,'#c1d0c5',10);
          result.innerHTML=`C = <strong>${fmtExp(C)} Ф</strong> (${fmt(C*1e12,2)} пФ) · E = <strong>${fmtExp(E)} В/м</strong> · Q = <strong>${fmtExp(Q)} Кл</strong> · W = <strong>${fmtExp(W)} Дж</strong>`;
          legend.innerHTML='<span>Приближение плоского конденсатора: однородное поле между пластинами, краевыми эффектами пренебрегаем.</span>';
        }
        else if(type==='circuit'){
          const [u,R]=state;svg=baseSvg(stage);const xL=180,xR=460,yT=65,yB=180;
          // Wires and a zig-zag resistor in the upper branch.
          line(svg,xL,yT,xL+90,yT,'#acc6b2',2);line(svg,xL+90,yT,xL+112,yT,'#acc6b2',2);
          const pts=[[xL+112,yT],[xL+122,yT-10],[xL+136,yT+10],[xL+150,yT-10],[xL+164,yT+10],[xL+178,yT-10],[xL+192,yT+10],[xL+202,yT]];
          for(let i=0;i<pts.length-1;i++)line(svg,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],'#e3bd75',2.4);
          line(svg,xL+202,yT,xR,yT,'#acc6b2',2);line(svg,xR,yT,xR,yB,'#acc6b2',2);line(svg,xR,yB,xL,yB,'#acc6b2',2);
          // Battery: long upper plate is positive, short lower plate is negative.
          line(svg,xL,yT,xL,100,'#acc6b2',2);line(svg,xL,100,xL,108,'#acc6b2',2);line(svg,xL-14,108,xL+14,108,'#80b9ce',3);line(svg,xL-8,125,xL+8,125,'#80b9ce',2);line(svg,xL,125,xL,yB,'#acc6b2',2);
          text(svg,xL+22,104,'+','#e3bd75',14,'start');text(svg,xL+22,132,'−','#80b9ce',14,'start');
          const I=u/R,P=u*I,currentLevel=Math.min(1,Math.log10(1+I/.01)/Math.log10(1+2.4/.01)),currentWidth=1.2+1.8*currentLevel,currentHead=5+3*currentLevel;
          text(svg,320,42,`R = ${R.toFixed(0)} Ом`,'#e5c27f',11);addArrow(svg,258,yT-25,315,yT-25,'#b7d8be',currentWidth,currentHead);addArrow(svg,xR+24,92,xR+24,145,'#b7d8be',currentWidth,currentHead);addArrow(svg,370,yB+19,300,yB+19,'#b7d8be',currentWidth,currentHead);
          text(svg,320,156,`I = ${fmt(I,3)} А`,'#eef5ef',13);
          result.innerHTML=`Ток I = <strong>${fmtExp(I)} А</strong> · мощность P = <strong>${fmtExp(P)} Вт</strong> · направление условного тока — от «+» источника через резистор к «−»`;
          legend.innerHTML='<span>Идеальный источник напряжения и один резистор; внутренним сопротивлением источника и проводов пренебрегаем.</span>';
        }
        else {
          svg=baseSvg(stage);text(svg,320,120,'Для этого типа модели обработчик отсутствует','#cfdbd1',13);result.textContent='Проверьте поле type в конфигурации темы.';
        }
      };
      const c=(label,min,max,step,val,suffix,idx)=>makeRange(controls,label,min,max,step,val,suffix,v=>{state[idx]=v;update()});
      if(type==='charge'){state=[3];c('Заряд q',-8,8,.5,3,' нКл',0)}
      else if(type==='coulomb'){state=[2,-3,1.5];c('Заряд q₁',-8,8,.5,2,' нКл',0);c('Заряд q₂',-8,8,.5,-3,' нКл',1);c('Расстояние r',.5,4,.1,1.5,' м',2)}
      else if(type==='superposition'){state=[3,-2,2];c('Заряд q₁',-8,8,.5,3,' нКл',0);c('Заряд q₂',-8,8,.5,-2,' нКл',1);c('Расстояние между зарядами',.5,4,.1,2,' м',2)}
      else if(type==='gauss'){state=[2,2];c('Заряд q',-8,8,.5,2,' нКл',0);c('Радиус сферы r',.5,5,.1,2,' м',1)}
      else if(type==='potential'){state=[2,2];c('Заряд q',-8,8,.5,2,' нКл',0);c('Расстояние r',.3,5,.1,2,' м',1)}
      else if(type==='dipole'){state=[3,6];c('Модуль заряда q',.5,8,.5,3,' нКл',0);c('Разделение d',2,10,.5,6,' см',1)}
      else if(type==='conductor'){state=[3,5];c('Полный заряд Q',-8,8,.5,3,' нКл',0);c('Радиус сферы R',2,8,.5,5,' см',1)}
      else if(type==='dielectric'){state=[2.5,1];c('Относительная проницаемость εᵣ',1,6,.1,2.5,'',0);c('Свободная плотность заряда',.2,2,.1,1,' нКл/см²',1)}
      else if(type==='capacitor'){state=[20,2,12,1];c('Площадь пластин S',5,50,1,20,' см²',0);c('Зазор d',.5,8,.1,2,' мм',1);c('Напряжение U',1,30,1,12,' В',2);c('Проницаемость εᵣ',1,6,.1,1,'',3)}
      else if(type==='circuit'){state=[12,100];c('Напряжение U',1,24,1,12,' В',0);c('Сопротивление R',10,500,10,100,' Ом',1)}
      update();
    });
  }
})();
