(() => {
  // Storage keys
  const KEY_HABIT = 'ht_habit';
  const KEY_TODOS = 'ht_todos';
  const KEY_REMS = 'ht_rems';

  // Elements
  const habitNameEl = document.getElementById('habit-name');
  const saveHabitBtn = document.getElementById('save-habit');
  const weekEl = document.getElementById('week');
  const chart = document.getElementById('chart');
  const prevWeekBtn = document.getElementById('prev-week');
  const nextWeekBtn = document.getElementById('next-week');
  const clearWeekBtn = document.getElementById('clear-week');

  const todoText = document.getElementById('todo-text');
  const addTodoBtn = document.getElementById('add-todo');
  const todoListEl = document.getElementById('todo-list');

  const remTime = document.getElementById('rem-time');
  const remMsg = document.getElementById('rem-msg');
  const remDaily = document.getElementById('rem-daily');
  const addRemBtn = document.getElementById('add-reminder');
  const remindersEl = document.getElementById('reminders');
  const alarmTime = document.getElementById('alarm-time');
  const alarmMsg = document.getElementById('alarm-msg');
  const setAlarmBtn = document.getElementById('set-alarm');
  const testNotifBtn = document.getElementById('test-notif');

  let habit = { name: 'Daily Habit', records: {} };
  let weekOffset = 0; // 0 = current week

  // Utils
  const today = () => new Date();
  const fmt = d => d.toISOString().slice(0,10);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

  // Storage helpers
  function load() {
    try { const h = localStorage.getItem(KEY_HABIT); if(h) habit = JSON.parse(h); } catch(e){}
    try { renderTodos(); } catch(e){}
    try { renderReminders(); } catch(e){}
  }
  function saveHabit(){ localStorage.setItem(KEY_HABIT, JSON.stringify(habit)); }

  // Habit UI
  function renderWeek(){
    weekEl.innerHTML='';
    const start = startOfDisplayedWeek();
    for(let i=0;i<7;i++){
      const d = addDays(start, i);
      const key = fmt(d);
      const day = document.createElement('div');
      day.className = 'day' + (habit.records[key] ? ' completed' : '');
      day.innerHTML = `<strong>${d.toLocaleDateString(undefined,{weekday:'short'})}</strong><div>${d.toLocaleDateString()}</div>`;
      const btn = document.createElement('button'); btn.textContent = habit.records[key] ? 'Undo' : 'Done';
      btn.onclick = ()=>{ habit.records[key]=!habit.records[key]; if(!habit.records[key]) delete habit.records[key]; saveHabit(); renderWeek(); drawChart(); };
      day.appendChild(btn);
      weekEl.appendChild(day);
    }
    drawChart();
  }

  function startOfDisplayedWeek(){
    const now = new Date();
    const d = addDays(now, weekOffset*7);
    const day = d.getDay();
    const diff = d.getDate() - day + (day===0?-6:1); // Monday start
    return new Date(d.getFullYear(), d.getMonth(), diff);
  }

  function drawChart(){
    const ctx = chart.getContext('2d');
    ctx.clearRect(0,0,chart.width,chart.height);
    const start = startOfDisplayedWeek();
    const values = [];
    for(let i=0;i<7;i++){ values.push(habit.records[fmt(addDays(start,i))] ? 1 : 0); }
    const w = chart.width/ (values.length*2);
    const max = 1;
    values.forEach((v,i)=>{
      const x = (i*2+0.5)*w;
      const h = (v/max)* (chart.height-20);
      ctx.fillStyle = v? '#34d399' : '#e5e7eb';
      ctx.fillRect(x, chart.height-10-h, w, h);
      ctx.fillStyle = '#111827';
      ctx.fillText(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i], x, chart.height);
    });
  }

  // Week controls
  prevWeekBtn.onclick = () => { weekOffset--; renderWeek(); };
  nextWeekBtn.onclick = () => { weekOffset++; renderWeek(); };
  clearWeekBtn.onclick = ()=>{
    const start = startOfDisplayedWeek();
    for(let i=0;i<7;i++) delete habit.records[fmt(addDays(start,i))]; saveHabit(); renderWeek();
  };
  saveHabitBtn.onclick = ()=>{ habit.name = habitNameEl.value || 'Daily Habit'; saveHabit(); alert('Habit saved'); };

  // Todos
  function getTodos(){ try { return JSON.parse(localStorage.getItem(KEY_TODOS) || '[]'); } catch(e){ return []; } }
  function setTodos(t){ localStorage.setItem(KEY_TODOS, JSON.stringify(t)); }
  function renderTodos(){ const list = getTodos(); todoListEl.innerHTML=''; list.forEach((t,i)=>{
    const li = document.createElement('li');
    const chk = document.createElement('input'); chk.type='checkbox'; chk.checked = !!t.done; chk.onchange = ()=>{ t.done = chk.checked; setTodos(list); renderTodos(); };
    const span = document.createElement('span'); span.textContent = t.text; if(t.done) span.style.textDecoration='line-through';
    const del = document.createElement('button'); del.textContent='Delete'; del.onclick = ()=>{ list.splice(i,1); setTodos(list); renderTodos(); };
    li.appendChild(chk); li.appendChild(span); li.appendChild(del); todoListEl.appendChild(li);
  }); }
  addTodoBtn.onclick = ()=>{ const txt = todoText.value.trim(); if(!txt) return; const list = getTodos(); list.push({text:txt,done:false}); setTodos(list); todoText.value=''; renderTodos(); };

  // Reminders & Alarms
  function getRems(){ try { return JSON.parse(localStorage.getItem(KEY_REMS) || '[]'); } catch(e){ return []; } }
  function setRems(r){ localStorage.setItem(KEY_REMS, JSON.stringify(r)); }
  function renderReminders(){ const list = getRems(); remindersEl.innerHTML=''; list.forEach((r,i)=>{
    const li = document.createElement('li'); li.textContent = `${r.time} — ${r.msg} ${r.daily? '(daily)':''}`;
    const del = document.createElement('button'); del.textContent='Delete'; del.onclick=()=>{ list.splice(i,1); setRems(list); renderReminders(); };
    li.appendChild(del); remindersEl.appendChild(li);
  }); scheduleAllReminders(); }

  addRemBtn.onclick = ()=>{
    const t = remTime.value; const m = remMsg.value.trim(); if(!t || !m) return alert('Set time and message');
    const list = getRems(); list.push({id:Date.now(),time:t,msg:m,daily:remDaily.checked}); setRems(list); remMsg.value=''; renderReminders();
  };

  // Scheduling
  const timers = new Map();
  function msUntilNext(timeStr){ const [hh,mm]=timeStr.split(':').map(Number); const now=new Date(); const t=new Date(now.getFullYear(),now.getMonth(),now.getDate(),hh,mm,0,0); if(t<=now) t.setDate(t.getDate()+1); return t - now; }
  function beep(){ try{ const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.type='sine'; o.frequency.value=880; g.gain.value=0.05; o.connect(g); g.connect(ctx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime+1); setTimeout(()=>{ o.stop(); ctx.close(); },1100);}catch(e){} }

  function showNotif(title, body){ if(window.Notification && Notification.permission==='granted'){ new Notification(title, {body}); } else if(window.alert){ alert(title+ '\n' + body); } }

  function scheduleReminder(rem){ const id = rem.id; if(timers.has(id)) clearTimeout(timers.get(id)); const ms = msUntilNext(rem.time); const t = setTimeout(()=>{ showNotif('Reminder', rem.msg); beep(); if(rem.daily) scheduleReminder(rem); else { const list=getRems(); const idx=list.findIndex(x=>x.id===id); if(idx>=0){ list.splice(idx,1); setRems(list); renderReminders(); } } }, ms); timers.set(id,t); }
  function scheduleAllReminders(){ getRems().forEach(scheduleReminder); }

  // Alarm set once (non-recurring) or repeated when set again
  let alarmTimer = null;
  setAlarmBtn.onclick = ()=>{
    const t = alarmTime.value; const m = alarmMsg.value.trim() || 'Alarm'; if(!t) return alert('Pick a time'); if(alarmTimer) clearTimeout(alarmTimer);
    const ms = msUntilNext(t); alarmTimer = setTimeout(()=>{ showNotif('Alarm', m); beep(); alarmTimer=null; }, ms); alert('Alarm set');
  };

  testNotifBtn.onclick = ()=>{ requestNotifPerm().then(()=>{ showNotif('Test', 'This is a test notification'); beep(); }); };

  function requestNotifPerm(){ return new Promise(res=>{ if(!('Notification' in window)) return res(false); if(Notification.permission==='granted') return res(true); Notification.requestPermission().then(p=>res(p==='granted')); }); }

  function scheduleAll(){ requestNotifPerm().then(()=>{ scheduleAllReminders(); }); }

  // Initialize
  function init(){ load(); habitNameEl.value = habit.name || 'Daily Habit'; renderWeek(); renderTodos(); renderReminders(); scheduleAll(); }
  init();

  // Expose for debugging
  window._ht = { habit, renderWeek, getTodos, getRems };
})();
