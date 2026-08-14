(function(global){
  function kanSeFbInternokonomiFor(bruker){
    return !!(bruker && (
      bruker.rolle === 'superadmin' || bruker.kan_se_fb_internokonomi === true
    ));
  }
  global.kanSeFbInternokonomiFor = kanSeFbInternokonomiFor;
  if(typeof module !== 'undefined' && module.exports)module.exports={kanSeFbInternokonomiFor};
})(typeof window !== 'undefined' ? window : globalThis);
