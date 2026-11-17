import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

type Payload = {
  op?: string;
  password?: string;
  token?: string;
  table?: string;
  filters?: Record<string, unknown>;
  sorts?: {column: string; ascending?: boolean}[];
  single?: boolean;
  values?: Record<string, unknown>;
  path?: string;
  mime?: string;
  base64?: string;
};

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(url, serviceKey, {auth: {persistSession:false,autoRefreshToken:false}});
const storageBucket="carla-modas";
const schemas:Record<string,{fields: string[]; readable: string[]}> = {
 carla_products:{
  fields:["category_id","sku","name","description","price","compare_at_price","image_url","gallery","sizes","colors","stock","featured","active","sort_order"],
  readable:["id","category_id","sku","name","description","price","compare_at_price","image_url","gallery","sizes","colors","stock","featured","active","sort_order","created_at","updated_at"]
 },
 carla_categories:{
  fields:["slug","name","description","image_url","active","sort_order"],
  readable:["id","slug","name","description","image_url","active","sort_order","created_at","updated_at"]
 },
 carla_settings:{
  fields:["store_name","tagline","whatsapp","instagram","announcement","hero_title","hero_subtitle","hero_image_url","logo_url","about_text","address"],
  readable:["id","store_name","tagline","whatsapp","instagram","announcement","hero_title","hero_subtitle","hero_image_url","logo_url","about_text","address","updated_at"]
 }
};
function makeHeaders(req:Request) {
 const origin=req.headers.get("origin") ?? "*";
 return {"Access-Control-Allow-Origin":origin,"Vary":"Origin",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-carla-session",
 "Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
}
function send(req:Request, data:unknown, status=200) {
 return new Response(JSON.stringify(data),{status,headers:makeHeaders(req)});
}
function shaHex(input:string) {
 return crypto.subtle.digest("SHA-256",new TextEncoder().encode(input))
   .then(buffer=>[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,"0")).join(""));
}
function hexBytes(s:string) {
 if(!/^(?:[0-9a-f]{2})+$/i.test(s))throw Error("Invalid configuration");
 return Uint8Array.from(s.match(/.{2}/g)!.map(x=>parseInt(x,16)));
}
async function verifyPassword(password:string, salt:string, hash:string, iterations:number){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
 const derived=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:hexBytes(salt),iterations},key,256));
 const target=hexBytes(hash);
 let difference=derived.length^target.length;
 for(let i=0;i<Math.min(derived.length,target.length);i++) difference|=derived[i]^target[i];
 return difference===0;
}
function newToken(){
 return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,"0")).join("");
}
function fail(message:string,status=400):never{
 const error=new Error(message) as Error & {status?:number};error.status=status;throw error;
}
async function requireSession(req:Request) {
 const token=req.headers.get("x-carla-session") || "";
 if(!/^[a-f0-9]{64}$/.test(token))fail("Sessão expirada. Entre novamente.",401);
 const tokenHash=await shaHex(token);
 const {data,error}=await db.from("carla_admin_sessions").select("expires_at").eq("token_hash",tokenHash).maybeSingle();
 if(error)throw error;
 if(!data || new Date(data.expires_at).getTime()<=Date.now())fail("Sessão expirada. Entre novamente.",401);
 return tokenHash;
}
function validate(table:string, values:unknown, op:string){
 const schema=schemas[table];
 if(!schema)fail("Tabela inválida.");
 if(!values || typeof values!=="object" || Array.isArray(values))fail("Cadastro inválido.");
 const source=values as Record<string, unknown>;
 const result:Record<string, unknown>={};
 for (const [key,value] of Object.entries(source)){
  if(!schema.fields.includes(key))fail("Campo não permitido: "+key);
  if(typeof value==="string" && value.length>8000)fail("Texto muito grande.");
  if(Array.isArray(value) && (value.length>50 || value.some(x=>typeof x!=="string" || x.length>1500)))fail("Lista inválida.");
  result[key]=value;
 }
 if(Object.keys(result).length===0)fail("Nenhum campo para salvar.");
 if(table==="carla_products"){
   if(result.name!==undefined && (typeof result.name!=="string" || !String(result.name).trim()))fail("Informe o nome do produto.");
   if(result.price!==undefined && result.price!==null && (!Number.isFinite(result.price)||Number(result.price)<0||Number(result.price)>1000000))fail("Preço inválido.");
   if(result.stock!==undefined && result.stock!==null && (!Number.isInteger(result.stock)||Number(result.stock)<0))fail("Estoque inválido.");
 }
 if(table==="carla_settings" && op==="insert")fail("Não é possível criar outra loja.");
 return result;
}
function uuidValid(s:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)}
function checkFilter(table:string, payload:Payload) {
 const filters=payload.filters ?? {};
 const id=filters["id"];
 if((payload.op==="update"||payload.op==="delete") && typeof id!=="string" && id!==1)fail("ID obrigatório.");
 if(table==="carla_settings"){
   if(id!==1)fail("Configuração inválida.");
 } else if(id!==undefined && (typeof id!=="string" || !uuidValid(id)))fail("ID inválido.");
 return id;
}
async function queryRecords(payload:Payload){
 const table=payload.table??"",schema=schemas[table];
 if(!schema)fail("Tabela não permitida.");
 const op=payload.op;
 if(!["select","insert","update","delete"].includes(op??""))fail("Operação inválida.");
 const id=checkFilter(table,payload);
 if(op==="select"){
  let q=db.from(table).select(schema.readable.join(","));
  if(id!==undefined)q=q.eq("id",id);
  for(const sort of payload.sorts??[]){
   if(!schema.readable.includes(sort.column))fail("Ordenação inválida.");
   q=q.order(sort.column,{ascending:sort.ascending!==false});
  }
  const r=payload.single ? await q.maybeSingle() : await q.limit(1000);
  if(r.error)throw r.error;
  return r.data;
 }
 if(op==="insert"){
  const record=validate(table,payload.values,op);
  if(table==="carla_settings")fail("Operação inválida.");
  const r=await db.from(table).insert(record).select(schema.readable.join(","));
  if(r.error)throw r.error;return r.data;
 }
 if(op==="update"){
  const record=validate(table,payload.values,op);
  let q=db.from(table).update(record);
  q=q.eq("id",id);
  const r=await q.select(schema.readable.join(","));
  if(r.error)throw r.error;return r.data;
 }
 if(table==="carla_settings")fail("Não é possível excluir as configurações.");
 const r=await db.from(table).delete().eq("id",id).select("id");
 if(r.error)throw r.error;return r.data;
}
async function upload(payload:Payload){
 const path=payload.path||"";
 const mime=payload.mime||"";
 const encoded=payload.base64||"";
 if(!/^(products|categories|gallery|branding)\/[a-f0-9-]{36}\.(jpg|png|webp|avif)$/.test(path))fail("Nome do arquivo inválido.");
 const allowed=["image/jpeg","image/png","image/webp","image/avif"];
 if(!allowed.includes(mime))fail("Formato de foto não permitido.");
 if(encoded.length>11200000)fail("Imagem muito grande.");
 let bytes:Uint8Array;
 try{
  const binary=atob(encoded);bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 }catch{fail("Imagem inválida.");}
 if(bytes.length===0||bytes.length>8388608)fail("Imagem excede 8 MB.");
 const blob=new Blob([bytes],{type:mime});
 const {data,error}=await db.storage.from(storageBucket).upload(path,blob,{upsert:false,contentType:mime,cacheControl:"3600"});
 if(error)throw error;
 return {path:data?.path??path};
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:makeHeaders(req)});
 if(req.method!=="POST")return send(req,{error:"Método não permitido"},405);
 if(!url||!serviceKey)return send(req,{error:"Configuração administrativa do servidor incompleta."},503);
 try{
  const ct=req.headers.get("content-type")??"";
  if(!ct.includes("application/json"))fail("Envie JSON.");
  const len=Number(req.headers.get("content-length")||"0");
  if(len>13_000_000)fail("Arquivo muito grande.",413);
  const payload=await req.json() as Payload;
  if(!payload || typeof payload!=="object")fail("Pedido inválido.");
  if(payload.op==="login"){
   const password=payload.password||"";
   if(typeof password!=="string"||password.length>200||!password)fail("Senha inválida.",401);
   const {data:credential,error}=await db.from("carla_admin_credentials").select("salt_hex,hash_hex,iterations,failed_attempts,locked_until").eq("id",1).maybeSingle();
   if(error)throw error;
   if(!credential)fail("Senha administrativa ainda não configurada.",503);
   if(credential.locked_until && new Date(credential.locked_until).getTime()>Date.now())fail("Muitas tentativas. Tente novamente depois.",429);
   const valid=await verifyPassword(password,credential.salt_hex,credential.hash_hex,credential.iterations);
   if(!valid){
     const attempts=(credential.failed_attempts||0)+1;
     const {error:e}=await db.from("carla_admin_credentials").update({
       failed_attempts:attempts>=8?0:attempts,
       locked_until:attempts>=8?new Date(Date.now()+15*60*1000).toISOString():null
     }).eq("id",1);
     if(e)throw e;
     fail("Senha incorreta.",401);
   }
   await db.from("carla_admin_credentials").update({failed_attempts:0,locked_until:null}).eq("id",1);
   const token=newToken(),hash=await shaHex(token);
   const expiresAt=new Date(Date.now()+8*60*60*1000).toISOString();
   const {error:sessionError}=await db.from("carla_admin_sessions").insert({token_hash:hash,expires_at:expiresAt});
   if(sessionError)throw sessionError;
   return send(req,{ok:true,token,expiresAt});
  }
  const tokenHash=await requireSession(req);
  if(payload.op==="me")return send(req,{ok:true,role:"owner"});
  if(payload.op==="logout"){
   const {error}=await db.from("carla_admin_sessions").delete().eq("token_hash",tokenHash);
   if(error)throw error;
   return send(req,{ok:true});
  }
  if(payload.op==="upload"){
   const data=await upload(payload);
   return send(req,{ok:true,data});
  }
  const data=await queryRecords(payload);
  return send(req,{ok:true,data});
 }catch(error){
  const err=error as Error & {status?:number};
  console.error("carla-admin-api:",err.message);
  return send(req,{error:err.message||"Erro inesperado"},err.status||500);
 }
});
