/* Adaptador seguro Carla Modas.
 * O painel nao possui chave secreta nem senha no JavaScript.
 * Todas as operacoes autenticadas passam pela Edge Function carla-admin-api.
 */
(function () {
 "use strict";
 const cfg=window.CARLA_SUPABASE_CONFIG||{};
 const base=String(cfg.url||"").replace(/\/$/,"");
 const endpoint=base+"/functions/v1/carla-admin-api";
 const sessionKey="carla_admin_session_v2";
 function loadToken(){
   try {
     const item=JSON.parse(sessionStorage.getItem(sessionKey)||"null");
     if(item && typeof item.token==="string" && Date.parse(item.expiresAt)>Date.now())return item.token;
   }catch{}
   try{sessionStorage.removeItem(sessionKey);}catch{}
   return null;
 }
 function setToken(token,expiresAt){
   try{sessionStorage.setItem(sessionKey,JSON.stringify({token,expiresAt}));}catch{}
 }
 function forgetToken(){try{sessionStorage.removeItem(sessionKey);}catch{}}
 async function call(payload,tokenOverride){
   const token=tokenOverride===undefined?loadToken():tokenOverride;
   let response;
   try{
     response=await fetch(endpoint,{
       method:"POST",
       headers:{"Content-Type":"application/json","apikey":cfg.publishableKey||"",...(token?{"x-carla-session":token}:{})},
       body:JSON.stringify(payload)
     });
   }catch{throw Error("Não foi possível conectar ao painel. Verifique sua internet.");}
   let data;
   try{data=await response.json();}catch{throw Error("O servidor retornou uma resposta inválida.");}
   if(!response.ok || !data.ok){
     if(response.status===401 && payload.op!=="login")forgetToken();
     throw Error(data.error||"Não foi possível realizar a operação.");
   }
   return data.data===undefined?data:data.data;
 }
 function buildQuery(table,op,values){
   const opts={table,op,values,filters:{},sorts:[],single:false};
   const builder={
     eq(column,value){if(column!=="id")throw Error("Filtro não permitido: "+column);opts.filters[column]=value;return builder;},
     order(column,settings){opts.sorts.push({column,ascending:settings?.ascending!==false});return builder;},
     limit(){return builder;},
     maybeSingle(){opts.single=true;return builder;},
     select(columns){
       if(op==="select" && typeof columns==="string")opts.columns=columns;
       return builder;
     },
     then(resolve,reject){
       return call(opts).then(data=>({data,error:null})).catch(error=>({data:null,error})).then(resolve,reject);
     }
   };
   return builder;
 }
 function fileBase64(file){
   return new Promise((resolve,reject)=>{
     const reader=new FileReader();
     reader.onerror=()=>reject(Error("Não foi possível ler a foto."));
     reader.onload=()=>{
       const encoded=String(reader.result||"");
       resolve(encoded.slice(encoded.indexOf(",")+1));
     };
     reader.readAsDataURL(file);
   });
 }
 const admin={
   auth:{
     async signInWithPassword({password}){
       try{
         if(typeof password!=="string"||!password)throw Error("Digite a senha.");
         const data=await call({op:"login",password},null);
         setToken(data.token,data.expiresAt);
         return {data:{session:{access_token:data.token,expires_at:Math.floor(Date.parse(data.expiresAt)/1000)}},error:null};
       }catch(error){return{data:null,error};}
     },
     async getSession(){
       const token=loadToken();
       return{data:{session:token?{access_token:token}:null},error:null};
     },
     async getUser(){
       try{
         const data=await call({op:"me"});
         return{data:{user:data.ok?{id:"carla-admin",role:"owner"}:null},error:null};
       }catch(error){return{data:{user:null},error};}
     },
     async signOut(){
       try{if(loadToken())await call({op:"logout"});}finally{forgetToken();}
       return{error:null};
     }
   },
   from(table){
     return{
       select(columns){return buildQuery(table,"select",null).select(columns);},
       insert(values){return buildQuery(table,"insert",values);},
       update(values){return buildQuery(table,"update",values);},
       delete(){return buildQuery(table,"delete",null);}
     };
   },
   storage:{
     from(bucket){
       if(bucket!=="carla-modas")throw Error("Bucket não autorizado.");
       return{
         async upload(path,file,options){
           try{
             if(!loadToken())throw Error("Entre novamente no painel.");
             if(!file || file.size>8388608)throw Error("A foto excede 8 MB.");
             const base64=await fileBase64(file);
             const data=await call({op:"upload",path,mime:options?.contentType||file.type,base64});
             return{data,error:null};
           }catch(error){return{data:null,error};}
         },
         getPublicUrl(path){
           return{data:{publicUrl:base+"/storage/v1/object/public/carla-modas/"+path}};
         }
       };
     }
   }
 };
 window.CarlaAdminAPI=Object.freeze({
   createClient(){return admin;},
   login:admin.auth.signInWithPassword,
   hasSession(){return!!loadToken();}
 });
})();
