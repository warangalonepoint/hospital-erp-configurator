// Apply theme ASAP on static pages (shell, public html)
(function bootTheme(){
  try{
    var t = localStorage.getItem('theme') || 'dark';
    var el = document.documentElement;
    el.classList.remove('theme-dark','theme-light');
    el.classList.add(t === 'light' ? 'theme-light' : 'theme-dark');
  }catch(e){}
})();

function toggleTheme(){
  var el = document.documentElement;
  var isLight = el.classList.contains('theme-light');
  var next = isLight ? 'dark' : 'light';
  el.classList.toggle('theme-light', next === 'light');
  el.classList.toggle('theme-dark', next === 'dark');
  try { localStorage.setItem('theme', next); } catch(e){}
}
