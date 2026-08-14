// Foodbroker-prisflyt fra Excel Margin!Q/R.
// Konkret støttet internpris overstyrer støtteprosent. Støtten endrer fordelingen
// mellom Foodbroker og grossist, men ikke total DLVRY-margin.
function beregnFbPrisflyt(linje,kost,manglerKost){
  const isFB=linje.kilde==='Foodbroker'||linje.fbkostpris!=null;
  const internpris=(!manglerKost&&linje.grossistprisFB!=null&&Number(linje.grossistprisFB)>0)
    ?Number(linje.grossistprisFB):null;
  const fbStottePct=Math.min(1,Math.max(0,Number(linje.fbStottePct)||0));
  const fbStotteSpesial=(linje.fbStotteSpesialpris!=null&&linje.fbStotteSpesialpris!==''&&Number(linje.fbStotteSpesialpris)>0)
    ?Number(linje.fbStotteSpesialpris):null;
  const justertGrossistkost=isFB&&internpris!=null
    ?(fbStotteSpesial!=null?fbStotteSpesial:internpris*(1-fbStottePct))
    :(internpris==null?kost:internpris);
  const fbStottePerEnhet=isFB&&internpris!=null&&justertGrossistkost!=null
    ?internpris-justertGrossistkost:0;
  const underFbKost=isFB&&!manglerKost&&justertGrossistkost!=null&&justertGrossistkost<kost;
  return{isFB,internpris,fbStottePct,fbStotteSpesial,justertGrossistkost,fbStottePerEnhet,underFbKost};
}
