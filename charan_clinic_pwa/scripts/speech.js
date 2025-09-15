// ./scripts/speech.js
export function startDictation(){
  return new Promise(resolve=>{
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ alert("Speech recognition not supported on this browser."); return resolve(""); }
    const r = new SR();
    r.lang = "en-IN";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e)=> {
      const text = e.results[0][0].transcript;
      resolve(text);
    };
    r.onerror = ()=> resolve("");
    r.onend = ()=>{};
    r.start();
  });
}
