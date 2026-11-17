import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const projectUrl=Deno.env.get("SUPABASE_URL")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(projectUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
type Line={id:string;size?:string;qty:number};
type Checkout={request_key?:string;items?:Line[];customer_name?:string;customer_note?:string;fulfillment?:string};
const allowedFulfillment=["combinar","entrega","retirada"];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function headers(request:Request){
  return {
    "Content-Type":"application/json",
    "Access-Control-Allow-Origin":request.headers.get("origin")||"*",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Access-Control-Allow-Headers":"authorization,apikey,content-type",
    "Vary":"Origin",
    "Cache-Control":"no-store"
  };
}
function response(request:Request,body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:headers(request)});
}
class CheckoutError extends Error{ constructor(message:string,public status=400){super(message);} }
function invalid(message:string,status=400):never{throw new CheckoutError(message,status);}
function clean(value:unknown,max:number){
 return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
}
function money(value:number){return Math.round(value*100)/100;}
async function hash(value:string){
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
 return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,"0")).join("");
}
function renderOrder(order:any){
  return {
    id:order.id,number:order.number,items:order.items,total:Number(order.total),
    missing_prices:order.missing_prices,item_count:order.item_count,
    status:order.status,created_at:order.created_at
  };
}
Deno.serve(async (request:Request)=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:headers(request)});
 if(request.method!=="POST")return response(request,{error:"Método não permitido"},405);
 if(!projectUrl||!serviceKey)return response(request,{error:"Servidor indisponível"},503);
 try{
   const size=Number(request.headers.get("content-length")||0);
   if(size>16000)invalid("O pedido é muito grande",413);
   if(!String(request.headers.get("content-type")||"").includes("application/json"))invalid("Formato inválido");
   const input=await request.json() as Checkout;
   if(!input||typeof input!=="object")invalid("Pedido inválido");
   const key=input.request_key;
   if(typeof key!=="string"||!uuid.test(key))invalid("Identificador do pedido inválido");
   const {data:previous,error:previousError}=await db.from("carla_order_intents").select("*").eq("request_key",key).maybeSingle();
   if(previousError)throw previousError;
   if(previous)return response(request,{ok:true,order:renderOrder(previous),reused:true});
   if(!Array.isArray(input.items)||input.items.length<1||input.items.length>20)invalid("Escolha entre 1 e 20 peças");
   const lines=input.items;
   let itemCount=0;
   for(const line of lines){
     if(!line || typeof line.id!=="string"||!uuid.test(line.id)||!Number.isInteger(line.qty)||line.qty<1||line.qty>20)invalid("Uma das peças está inválida");
     itemCount+=line.qty;
   }
   if(itemCount>99)invalid("Quantidade máxima: 99 peças");
   const customer_name=clean(input.customer_name,100);
   const customer_note=clean(input.customer_note,400);
   const fulfillment=allowedFulfillment.includes(input.fulfillment||"")?input.fulfillment:"combinar";
   const ids=[...new Set(lines.map(l=>l.id))];
   const {data:products,error:productsError}=await db.from("carla_products")
     .select("id,name,sku,price,stock,active,sizes,category_id")
     .in("id",ids);
   if(productsError)throw productsError;
   if(!products || products.length!==ids.length)invalid("Uma peça não está mais disponível. Atualize a página.");
   const {data:categories,error:categoriesError}=await db.from("carla_categories").select("id,active").in("id",[...new Set(products.map(p=>p.category_id))]);
   if(categoriesError)throw categoriesError;
   const categoriesMap=new Map((categories||[]).map(c=>[c.id,c.active]));
   const lookup=new Map(products.map(p=>[p.id,p]));
   const quantities=new Map<string,number>();
   const snapshot=[];
   let total=0,missing=0;
   for(const line of lines){
     const product=lookup.get(line.id);
     if(!product||!product.active||!categoriesMap.get(product.category_id))invalid("Uma das peças ficou indisponível. Atualize a página.");
     const size=clean(line.size||"Único",40);
     const sizes=Array.isArray(product.sizes)?product.sizes:[];
     if(sizes.length && !sizes.includes(size))invalid("Um dos tamanhos não está disponível. Atualize a página.");
     const qty=(quantities.get(line.id)||0)+line.qty;
     quantities.set(line.id,qty);
     if(product.stock!==null&&qty>product.stock)invalid("Estoque insuficiente para "+product.name+". Altere a quantidade.");
     const unit=product.price===null?null:money(Number(product.price));
     if(unit===null)missing+=line.qty;
     const subtotal=unit===null?null:money(unit*line.qty);
     if(subtotal!==null)total=money(total+subtotal);
     snapshot.push({
       product_id:product.id,sku:product.sku||"",name:product.name,
       size,qty:line.qty,unit_price:unit,subtotal
     });
   }
   const ip=(request.headers.get("cf-connecting-ip")||
     request.headers.get("x-real-ip")||
     (request.headers.get("x-forwarded-for")||"").split(",")[0]).trim().slice(0,80);
   const fingerprint=ip?await hash("carla-order|"+ip+"|"+serviceKey.slice(0,20)):null;
   if(fingerprint){
     const since=new Date(Date.now()-15*60*1000).toISOString();
     const {count,error:limitError}=await db.from("carla_order_intents").select("id",{count:"exact",head:true})
       .eq("request_fingerprint",fingerprint).gte("created_at",since);
     if(limitError)throw limitError;
     if((count||0)>=30)invalid("Muitas tentativas recentes. Aguarde alguns minutos e tente novamente.",429);
   }
   const {data:order,error:insertError}=await db.from("carla_order_intents").insert({
     request_key:key,customer_name,customer_note,fulfillment,
     items:snapshot,total,missing_prices:missing,item_count:itemCount,
     status:"whatsapp_aberto",request_fingerprint:fingerprint
   }).select("*").single();
   if(insertError){
     if(insertError.code==="23505"){
       const {data:existing}=await db.from("carla_order_intents").select("*").eq("request_key",key).maybeSingle();
       if(existing)return response(request,{ok:true,order:renderOrder(existing),reused:true});
     }
     throw insertError;
   }
   return response(request,{ok:true,order:renderOrder(order)});
 }catch(error){
   const problem=error as CheckoutError;
   console.error("carla-order",problem.message);
   return response(request,{error:problem instanceof CheckoutError?problem.message:"Não foi possível registrar o pedido agora."},problem.status||500);
 }
});
