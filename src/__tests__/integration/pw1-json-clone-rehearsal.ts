/** Explicitly invoked local clone rehearsal, never loaded by Vitest. Synthetic data only. */
import { mkdir,writeFile,readFile,readdir } from 'node:fs/promises'
import { hash as bcryptHash } from 'bcryptjs'
import { createHash,createCipheriv,createDecipheriv,createHmac,randomBytes,pbkdf2Sync,timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { Pool } from 'pg'
import { COLLECTIONS,type ImportDocument } from '@/lib/migration/pw1-json/types'
import { EXPECTED_MAPPING_HASH, NEW_MAPPING_HASH, CLASSIFIED_MAPPING_HASH } from '@/lib/migration/pw1-json/artifact'
import { prepareImportArtifact } from '@/lib/migration/pw1-json/credentials'
import { actorTargetIdentityHash, loadCreatorBindings, resolveCreatorContext, validateUserActors } from '@/lib/migration/pw1-json/creator-bindings'
import { localTarget } from '@/lib/migration/pw1-json/runtime'

async function main(){
 const v3=process.env.PW1_TEST_V3==='1'
 const v2=v3||process.env.PW1_TEST_V2==='1'
 if(v2&&(process.env.PW1_TEST_FULL!=='1'||process.env.PW1_TEST_TWO!=='1'))throw new Error('V2_FULL_TWO_REQUIRED')
 const database=process.env.PW1_TEST_DATABASE
 if(!database||!/^pw1_import_1886_[a-z0-9_]+$/.test(database))throw new Error('TEST_CLONE_REQUIRED')
 const uri=new URL(process.env.DATABASE_URI!);uri.hostname='localhost';uri.port='5433';uri.pathname=`/${database}`;uri.search=''
 const env:NodeJS.ProcessEnv={...process.env,DATABASE_URI:uri.toString(),PAYLOAD_PUSH_SCHEMA:'false',PAYLOAD_DROP_DATABASE:'false'}
 const root=process.env.PW1_TEST_ARTIFACT??`/tmp/pw1-cli-rehearsal-${Date.now()}`
 await mkdir(root,{mode:0o700}); const source=join(root,'export');await mkdir(source,{mode:0o700})
 const id='91886001',ref=`@tenants:stores:${id}`,clock='2020-01-02T03:04:05.000Z'
 const store:Record<string,ImportDocument[]>={...Object.fromEntries(COLLECTIONS.map(c=>[c,[]])),tenants:[{_ref:ref,name:'Synthetic migration rehearsal',slug:`pw1-test-${Date.now()}`,plan:'business',status:'active',createdAt:clock,updatedAt:clock,metaData:{pw1StoreId:id},customDomains:[],previousSlugs:[]}],sites:[{_ref:`@sites:stores:${id}`,tenant:ref,name:'Synthetic migration site',status:'draft',siteType:'ecommerce'}]}
 let credentialsPath:string|undefined, credentialText:string|undefined
 if(process.env.PW1_TEST_FULL==='1'){
  const stamp=String(Date.now()),tenant=ref,site=`@sites:stores:${id}`,user='@users:users:1',media='@media:medias:1',product='@products:products:1',customer='@customers:customers:1',discount='@discounts:promotion_codes:1',order='@orders:orders:1',category='@categories:categories:1',blogCategory='@blog_categories:blog_categories:1',subscription='@plan-subscriptions:plan_subscriptions:1'
  const dates={createdAt:clock,updatedAt:clock}
  store.users=[{_ref:user,email:`pw1-${stamp}@example.invalid`,firstName:'Synthetic',lastName:'Owner',roles:['tenant-owner'],tenants:[{tenant,role:'owner',status:'active',permissions:[]}],migrationStatus:'pending'}]
  store.sites[0].seo={ogImage:media}
  store.media=[{_ref:media,alt:'Synthetic external image',url:'https://example.invalid/synthetic.png',sourceUrl:'https://example.invalid/synthetic.png',...dates}]
  store.categories=[{_ref:category,tenant,site,name:'Synthetic category',slug:`category-${stamp}`,...dates}]
  store.products=[{_ref:product,tenant,site,name:'Synthetic product',slug:`product-${stamp}`,price:10,currency:'MYR',inventory:0,sku:`SKU-${stamp}`,status:'draft',hasVariants:false,weight:0.5,dimensions:{length:12.5,width:8,height:4},images:[{image:media}],category:[category],...dates}]
  store.customers=[{_ref:customer,tenant,name:'Synthetic customer',phone:`601${stamp.slice(-8)}`,email:'synthetic@example.invalid',addresses:[{line1:'Synthetic line'}],...dates}]
  store.discounts=[{_ref:discount,tenant,site,code:`TEST${stamp}`,type:'fixed',value:100,status:'inactive',usageCount:1,...dates}]
  store.orders=[{_ref:order,tenant,site,orderNumber:`TEST-${stamp}`,customer,customerName:'Historical synthetic',customerEmail:'synthetic@example.invalid',customerPhone:`601${stamp.slice(-8)}`,items:[{product,productName:'Historical product',quantity:1,unitPrice:10}],subtotal:10,shippingFee:0,tax:0,total:9,discount,discountCode:`TEST${stamp}`,discountAmount:100,currency:'MYR',status:'completed',paymentStatus:'unpaid',paymentMethod:'cod',...dates}]
  store.discount_usage_history=[{_ref:'@discount_usage_history:discount_usage_history:1',tenant,discount,order,amountApplied:100,...dates}]
  store.blog_categories=[{_ref:blogCategory,tenant,name:'Synthetic blog category',slug:`blog-category-${stamp}`,status:'active',...dates}]
  store.blogs=[{_ref:'@blogs:blog_posts:1',tenant,site,title:'Synthetic blog',slug:`blog-${stamp}`,status:'draft',author:user,category:blogCategory,thumbnail:media,content:{root:{type:'root',version:1,direction:null,format:'',indent:0,children:[{type:'paragraph',version:1,direction:null,format:'',indent:0,children:[{type:'text',version:1,text:'Synthetic text',format:0,detail:0,mode:'normal',style:''}]}]}},...dates}]
  store['email-template-settings']=[{_ref:'@email-template-settings:store_email_templates:1',tenant,templateType:'order-confirmation',recipient:'buyer',enabled:false,contentEn:{subject:'Synthetic subject'},...dates}]
  store['plan-subscriptions']=[{_ref:subscription,tenant,name:'main',plan:'PROFESSIONAL_NON_TM_USER',status:'active',startsAt:clock,endsAt:'2027-01-01T00:00:00.000Z',...dates}]
  store['plan-subscription-usages']=[{_ref:'@plan-subscription-usages:plan_subscription_usages:1',subscription,featureCode:'staff_limit',used:0,validUntil:null,...dates}]
  const key=randomBytes(32),iv=randomBytes(16),password='Synthetic-Password-1886';const cipher=createCipheriv('aes-256-cbc',key,iv);const encrypted=Buffer.concat([cipher.update(`s:${Buffer.byteLength(password)}:"${password}";`),cipher.final()]).toString('base64');const ivText=iv.toString('base64');const envelope=Buffer.from(JSON.stringify({iv:ivText,value:encrypted,mac:createHmac('sha256',key).update(ivText+encrypted).digest('hex')})).toString('base64')
  Object.assign(env,{PW1_APP_KEY:`base64:${key.toString('base64')}`,SSO_ENCRYPTION_KEY:randomBytes(32).toString('hex'),PW2_MIGRATION_SECRET:randomBytes(32).toString('hex')});process.env.PW2_MIGRATION_SECRET=env.PW2_MIGRATION_SECRET
  credentialText=`id,key_string,password\n1,${envelope},${await bcryptHash(password,4)}\n`;credentialsPath=join(root,'users.csv');await writeFile(credentialsPath,credentialText,{mode:0o600})
 }
 const stores=[store]
 if(process.env.PW1_TEST_TWO==='1'){const second='91886002';stores.push({...Object.fromEntries(COLLECTIONS.map(c=>[c,[]])),tenants:[{...store.tenants[0],_ref:`@tenants:stores:${second}`,slug:`pw1-second-${Date.now()}`,metaData:{pw1StoreId:second}}],sites:[{_ref:`@sites:stores:${second}`,tenant:`@tenants:stores:${second}`,name:'Synthetic second site',status:'draft',siteType:'ecommerce'}]})}
 if(v2){
  store.users[0].createdBy='@users:users:999'
  store.products[0].shortDescription='S'.repeat(350)
  store.products[0].images=Array.from({length:6},()=>({image:'@media:medias:1'}))
  ;(store.orders[0].items as ImportDocument[])[0].product=null
  stores[1].users=[{...store.users[0],_ref:'@users:users:2',email:`pw1-second-${Date.now()}@example.invalid`,tenants:[{tenant:'@tenants:stores:91886002',role:'owner',status:'active',permissions:[]}]}]
  credentialText=credentialText!+credentialText!.split('\n')[1].replace(/^1,/, '2,')+'\n'
  await writeFile(credentialsPath!,credentialText,{mode:0o600})
 }
 if(v2){const third='91886003';stores.push({...Object.fromEntries(COLLECTIONS.map(c=>[c,[]])),tenants:[{...store.tenants[0],_ref:`@tenants:stores:${third}`,slug:`pw1-third-${Date.now()}`,metaData:{pw1StoreId:third}}],sites:[{_ref:`@sites:stores:${third}`,tenant:`@tenants:stores:${third}`,name:'Synthetic third site',status:'draft',siteType:'ecommerce'}]})}
 const rows=[{table:'stores',sourceId:id,storeId:id,record:1,disposition:'mapped',fields:{id:'source-identity'} as Record<string,string>,contributions:[]}]
 if(stores.length>=2)rows.push({table:'stores',sourceId:'91886002',storeId:'91886002',record:2,disposition:'mapped',fields:{id:'source-identity'},contributions:[]})
 if(stores.length===3)rows.push({table:'stores',sourceId:'91886003',storeId:'91886003',record:3,disposition:'mapped',fields:{id:'source-identity'},contributions:[]})
 if(credentialText)rows.push({table:'users',sourceId:'1',storeId:id,record:1,disposition:'mapped',fields:{id:'source-identity',key_string:'security-excluded',password:'security-excluded'} as Record<string,string>,contributions:[]})
 if(v2)rows.push({table:'users',sourceId:'2',storeId:'91886002',record:2,disposition:'mapped',fields:{id:'source-identity',key_string:'security-excluded',password:'security-excluded'},contributions:[]})
 if(v3)for(const table of ['customers','addresses','orders','products','product_skus'])rows.push({table,sourceId:'1',storeId:id,record:1,disposition:'mapped',fields:{id:'source-identity'},contributions:[]})
 const sourceSnapshot={sourceInstance:`synthetic-cli-${Date.now()}`,sourceDatabase:'synthetic',sourceInstanceToken:'synthetic',snapshotId:'fixture1',asOf:'2026-09-16T00:00:00Z'}
 const reportRows=v3?rows.map(row=>({...row,ownership:{storeId:row.storeId,rule:'SOURCE_STORE_ID'}})):rows
 const hash=(v:string)=>createHash('sha256').update(v).digest('hex')
 const files:Record<string,string>={'master.json':JSON.stringify(stores),'mapping-report.json':JSON.stringify({version:1,diagnostics:[],rows:reportRows}),'mapping-report.csv':'table\n','README.md':'Synthetic foundation rehearsal'}
 if(v2)files['user-actors.json']=JSON.stringify({version:1,purpose:'creator-target-binding-required',sourceInstanceToken:'synthetic',snapshotId:'fixture1',actors:[{_ref:'@users:users:999',sourceId:'999',name:'Synthetic global actor',email:'source-global@example.invalid',source:{table:'users',storeId:null,deletedAt:null,isFrontend:'0',status:'1',createdAt:clock,updatedAt:clock,roles:[]}}]})
 if(v3){
  const emptyDiagnostics=()=>({customerCrosswalk:[],addressDispositions:[],rankDispositions:[],rankConflicts:[],profileConflicts:[]})
  files['customer-reconciliation.json']=JSON.stringify({version:1,sourceSnapshot,archiveStorage:'external-source-csv',stores:[{storeId:id,status:'reconciled',retainedSourceRows:['customers','addresses','orders'].map(table=>({table,sourceId:'1'})),quarantinedCustomerRefs:[],diagnostics:{...emptyDiagnostics(),customerCrosswalk:[{sourceCustomerId:'1',targetRef:'@customers:customers:1',disposition:'canonical'}],addressDispositions:[{sourceOrderId:'1',sourceAddressId:'1',targetRef:'@customers:customers:1',usage:'Shipping',legacyGeographyTypes:[],disposition:'emitted',targetIndex:0}]}},{storeId:'91886002',status:'reconciled',retainedSourceRows:[],quarantinedCustomerRefs:[],diagnostics:emptyDiagnostics()}]})
  if(stores.length===3){const receipt=JSON.parse(files['customer-reconciliation.json']);receipt.stores.push({storeId:'91886003',status:'reconciled',retainedSourceRows:[],quarantinedCustomerRefs:[],diagnostics:emptyDiagnostics()});files['customer-reconciliation.json']=JSON.stringify(receipt)}
  files['product-reconciliation.json']=JSON.stringify({version:1,sourceSnapshot,products:[{storeId:id,sourceProductId:'1',emitted:true,targetRef:'@products:products:1',eligibleSkuCount:1,tiers:[],skus:[{sourceSkuId:'1',targetPath:'',targetId:null,selectedTuple:[]}],errors:[]}]})
 }
 for(const [name,value] of Object.entries(files))await writeFile(join(source,name),value,{mode:0o600})
 const manifest={version:1,exporterVersion:v3?'1.2.0':'1.0.0',...(v3?{classificationVersion:'source-classification-v1',migrationPolicy:{decisionEvidence:'Synthetic clone-only fixture; no policy transformations',preserveHistoricalOrders:false,promoteActiveCategoriesToRoot:false,deferredStoreIds:[],activeCatalogOnly:false,deferEmailTemplates:false,allowSparseVariants:false,preserveUserCreators:true,siteTypeDefault:'ecommerce',siteTypeOverrides:{},shippingPolicy:'review'}}:{}),contractSha256:v3?CLASSIFIED_MAPPING_HASH:v2?NEW_MAPPING_HASH:EXPECTED_MAPPING_HASH,sourceConfigSha256:hash('synthetic'),sourceSnapshot,files:[{table:'stores',filename:'stores.csv',sha256:hash(`id\n${id}\n`),bytes:12,selected:true,rowCount:stores.length,headers:['id']}],artifacts:Object.fromEntries(Object.entries(files).map(([name,value])=>[name,hash(value)])),status:'complete',importReady:false,coverage:{accounted:true},mapping:{complete:true},counts:{sourceStoreCount:stores.length,selectedStoreCount:stores.length,policyExcludedStoreCount:0,emittedStoreCount:stores.length,blockedStoreCount:0,blockers:0},blockedStores:[],policyExcludedStores:[]}
 if(credentialText)manifest.files.push({table:'users',filename:'users.csv',sha256:hash(credentialText),bytes:Buffer.byteLength(credentialText),selected:true,rowCount:v2?2:1,headers:['id','key_string','password']})
 if(v3)for(const table of ['customers','addresses','orders','products','product_skus'])manifest.files.push({table,filename:`${table}.csv`,sha256:hash('id\n1\n'),bytes:5,selected:true,rowCount:1,headers:['id']})
 await writeFile(join(source,'master-manifest.json'),JSON.stringify(manifest),{mode:0o600})
 let creatorBindingsPath:string|undefined,actorId:number|undefined,actorBefore:string|undefined
 if(v2){
  const setup=new Pool({connectionString:uri.toString()})
  try{
   const email=`synthetic-actor-${Date.now()}@example.invalid`
   const actor=(await setup.query('INSERT INTO users (email,first_name,last_name,created_at,updated_at) VALUES ($1,$2,$3,$4,$4) RETURNING id,email',[email,'Synthetic','External actor',clock])).rows[0]
   actorId=Number(actor.id)
   actorBefore=JSON.stringify((await setup.query('SELECT row_to_json(u) AS value FROM users u WHERE id=$1',[actorId])).rows[0].value)
   const evidenceRef=join(root,'actor-evidence.json'),evidence=JSON.stringify({sourceInstance:manifest.sourceSnapshot.sourceInstance,sourceDatabase:'synthetic',sourceInstanceToken:'synthetic',snapshotId:'fixture1',actorArtifactHash:hash(files['user-actors.json']),targetIdentityHash:localTarget(uri.toString(),true).identity,sourceRef:'@users:users:999',targetUserId:actorId,targetUserIdentityHash:actorTargetIdentityHash(actor),decision:'approve-existing-creator-binding',approvedBy:'synthetic-clone-test-operator',approvedAt:'2026-09-17T00:00:00Z'})
   await writeFile(evidenceRef,evidence,{mode:0o600});creatorBindingsPath=join(root,'creator-bindings.json')
   await writeFile(creatorBindingsPath,JSON.stringify({version:1,sourceInstance:manifest.sourceSnapshot.sourceInstance,sourceDatabase:'synthetic',sourceInstanceToken:'synthetic',snapshotId:'fixture1',actorArtifactHash:hash(files['user-actors.json']),targetIdentityHash:localTarget(uri.toString(),true).identity,entries:[{sourceRef:'@users:users:999',targetUserId:actorId,targetUserIdentityHash:actorTargetIdentityHash(actor),provenanceKind:'operator-approved',evidenceRef,evidenceHash:hash(evidence)}]}),{mode:0o600})
  }finally{await setup.end()}
 }
 const prepared=await prepareImportArtifact({exportArtifact:source,credentials:credentialsPath,creatorBindings:creatorBindingsPath,output:join(root,'import')})
 const pool=new Pool({connectionString:uri.toString()})
 const count=async()=> (await pool.query('SELECT (SELECT count(*) FROM tenants)::int tenants,(SELECT count(*) FROM sites)::int sites,(SELECT count(*) FROM pages)::int pages,(SELECT count(*) FROM migration_runs)::int runs')).rows[0]
 const before=await count()
 async function cli(label:string,args:string[]){
  const result=await new Promise<{code:number|null;stdout:string;stderr:string}>(resolve=>{const child=spawn(process.execPath,['--import','tsx','--require','./scripts/seed-preload.cjs','scripts/import-pw1-json.ts',...args],{env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',d=>{stdout+=d;if(label==='apply'&&process.env.PW1_TEST_INTERRUPT==='1'&&stdout.includes('STORE_VERIFIED'))child.kill('SIGINT')});child.stderr.on('data',d=>stderr+=d);child.on('close',code=>resolve({code,stdout,stderr}))})
  await writeFile(join(root,label+'.private.log'),JSON.stringify(result),{mode:0o600})
  const events=result.stdout.split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}})
  const safe=result.stderr.split('\n').filter(Boolean).flatMap(line=>{try{const value=JSON.parse(line);return value.code?[value.code]:[]}catch{return []}})
  console.log(JSON.stringify({label,exitCode:result.code,events,codes:safe,evidence:root}))
  return {...result,events}
 }
 try{
  const args=['--group-size','1','--log-dir',join(root,'logs'),'--manifest',prepared.manifestPath,...(stores.length>1?['--all']:['--store',id])]
  const dry=await cli('dryrun',[...args,'--dry-run']);const afterDry=await count();if(JSON.stringify(before)!==JSON.stringify(afterDry)){console.log(JSON.stringify({label:'dryrun-count-change',before,afterDry}));throw new Error('DRYRUN_MUTATED_COUNTS')}
  if(dry.code!==0)throw new Error('DRYRUN_FAILED')
  const apply=await cli('apply',args);if(apply.code!==0&&!(apply.code===4&&process.env.PW1_TEST_INTERRUPT==='1'))throw new Error('APPLY_FAILED')
  const batch=apply.events.find(event=>event.runId)?.runId??apply.events.find(event=>event.batchId)?.batchId
  if(!batch)throw new Error('BATCH_ID_MISSING')
  if((await cli('resume',['--resume',batch,'--log-dir',join(root,'logs')])).code!==0)throw new Error('RESUME_FAILED')
  if((await cli('crossrun-reuse',args)).code!==0)throw new Error('CROSSRUN_REUSE_FAILED')
  if((await cli('resume-completed',['--resume',batch,'--log-dir',join(root,'logs')])).code!==0)throw new Error('COMPLETED_RESUME_FAILED')
  const completed=(await pool.query('SELECT state FROM migration_import_batches WHERE batch_id=$1',[batch.slice(5)])).rows[0]
  if(completed.state!=='VERIFIED')throw new Error('COMPLETED_BATCH_DOWNGRADED')
  const sessions=await readdir(join(root,'logs'))
  for(const session of sessions){const summary=JSON.parse(await readFile(join(root,'logs',session,'summary.json'),'utf8'));if(summary.outcome==='RUNNING')throw new Error('LOG_SUMMARY_NOT_FINAL')}
  console.log(JSON.stringify({label:'grouped-logs-completion',groups:stores.length,sessions:sessions.length,completedState:completed.state}))

  if(process.env.PW1_TEST_FULL==='1'){
   const claims=await pool.query("SELECT m.target_collection,m.target_id FROM migration_entity_map m JOIN migration_runs r ON r.run_id=m.run_id WHERE m.source_instance_id=$1 AND r.source_store_id='91886001' AND m.claim_active=true AND COALESCE(m.detail->>'scope','')<>'external_reference'",[manifest.sourceSnapshot.sourceInstance]);const targets=Object.fromEntries(claims.rows.map(r=>[r.target_collection,Number(r.target_id)]))
   const order=(await pool.query('SELECT subtotal,total,discount_amount,payment_status,status FROM orders WHERE id=$1',[targets.orders])).rows[0]
   const product=(await pool.query('SELECT inventory,short_description FROM products WHERE id=$1',[targets.products])).rows[0]
   const customer=(await pool.query('SELECT name FROM customers WHERE id=$1',[targets.customers])).rows[0]
   const media=(await pool.query('SELECT url,source_url,filename FROM media WHERE id=$1',[targets.media])).rows[0]
   const user=(await pool.query('SELECT hash,salt,key_string FROM users WHERE id=$1',[targets.users])).rows[0]
   // Payload >= 3.91 hash format: 'pbkdf2-sha256-v1:' + pbkdf2-sha256(600k iterations, 32 bytes)
   const password='Synthetic-Password-1886',hashPrefix='pbkdf2-sha256-v1:',currentFormat=String(user.hash).startsWith(hashPrefix),computed=pbkdf2Sync(password,user.salt,600000,32,'sha256'),stored=Buffer.from(String(user.hash).slice(hashPrefix.length),'hex');const authMatches=currentFormat&&stored.length===computed.length&&timingSafeEqual(stored,computed)
   const [iv,cipher]=String(user.key_string).split(':');const decipher=createDecipheriv('aes-256-cbc',Buffer.from(env.SSO_ENCRYPTION_KEY!,'hex'),Buffer.from(iv,'hex'));const ssoMatches=Buffer.concat([decipher.update(Buffer.from(cipher,'hex')),decipher.final()]).toString()===password
   const checks={claimCount:claims.rowCount,authMatches,ssoMatches,orderMoney:Number(order.subtotal)===10&&Number(order.total)===9&&Number(order.discount_amount)===100,historicalStatus:order.status==='completed'&&order.payment_status==='unpaid',zeroStock:Number(product.inventory)===0,customerSnapshot:customer.name==='Synthetic customer',externalMedia:media.url==='https://example.invalid/synthetic.png'&&media.source_url===media.url&&media.filename===null}
   console.log(JSON.stringify({label:'independent-db-checks',checks}));if(Object.entries(checks).some(([k,v])=>k!=='claimCount'&&!v)||checks.claimCount!==15)throw new Error('INDEPENDENT_VERIFICATION_FAILED')
   if(v2){
    const actorAfter=JSON.stringify((await pool.query('SELECT row_to_json(u) AS value FROM users u WHERE id=$1',[actorId])).rows[0].value)
    const actorOps=await pool.query("SELECT m.claim_active,m.action,m.state,m.depends_on_entity_map_id,m.detail FROM migration_entity_map m WHERE m.source_instance_id=$1 AND m.source_entity='users' AND m.source_id='999'",[manifest.sourceSnapshot.sourceInstance])
    const consumers=await pool.query("SELECT u.created_by_id FROM users u JOIN migration_entity_map m ON m.target_id=u.id::text WHERE m.source_instance_id=$1 AND m.source_entity='users' AND m.source_id IN ('1','2') AND m.claim_active=true",[manifest.sourceSnapshot.sourceInstance])
    const imageCount=Number((await pool.query('SELECT count(*) AS count FROM products_images WHERE _parent_id=$1',[targets.products])).rows[0].count)
    const historicalItem=(await pool.query('SELECT product_id,product_name,quantity,unit_price FROM orders_items WHERE _parent_id=$1',[targets.orders])).rows[0]
    const preservationChecks={sixImagesPreserved:imageCount===6,longDescriptionPreserved:product.short_description==='S'.repeat(350),historicalProductNull:historicalItem.product_id===null&&historicalItem.product_name==='Historical product'&&Number(historicalItem.quantity)===1&&Number(historicalItem.unit_price)===10}
    console.log(JSON.stringify({label:'independent-v2-schema-checks',checks:preservationChecks}))
    if(Object.values(preservationChecks).some(value=>!value))throw new Error('V2_SCHEMA_PRESERVATION_FAILED')
    const actorRegistry=validateUserActors(JSON.parse(files['user-actors.json']),{sourceInstanceToken:'synthetic',snapshotId:'fixture1'})
    const binding=await loadCreatorBindings(creatorBindingsPath!)
    const aliasActors={...actorRegistry,actors:actorRegistry.actors.map(actor=>({...actor,_ref:'@users:users:1000',sourceId:'1000'}))}
    const aliasBindings={...binding,entries:binding.entries.map(entry=>({...entry,sourceRef:'@users:users:1000'}))}
    let aliasCode:string|undefined
    try{await resolveCreatorContext(pool,{actors:aliasActors,bindings:aliasBindings,sourceInstance:manifest.sourceSnapshot.sourceInstance,sourceDatabase:'synthetic',sourceInstanceToken:'synthetic',snapshotId:'fixture1',actorArtifactHash:binding.actorArtifactHash,targetIdentityHash:binding.targetIdentityHash},[{ref:'@users:users:3',collection:'users',sourceEntity:'users',sourceId:'3',storeId:id,data:{createdBy:'@users:users:1000'},sourceChecksum:hash('synthetic-alias-consumer'),refs:[{ref:'@users:users:1000',collection:'users',path:'createdBy',required:false,externalActor:true}]}])}catch(error){aliasCode=error instanceof Error?error.message:undefined}
    console.log(JSON.stringify({label:'readonly-crossrun-actor-alias',blocked:aliasCode==='CREATOR_TARGET_IDENTITY_ALIAS'}))
    if(aliasCode!=='CREATOR_TARGET_IDENTITY_ALIAS')throw new Error('CROSSRUN_ACTOR_ALIAS_NOT_BLOCKED')
    const actorChecks={actorUnchanged:actorBefore===actorAfter,oneActiveOwner:actorOps.rows.filter(row=>row.claim_active).length===1,ownerSkip:actorOps.rows.every(row=>row.action==='SKIP'&&row.state==='SKIPPED'&&row.detail?.ownsBusinessRow===false),consumerDependencies:actorOps.rows.filter(row=>!row.claim_active).every(row=>row.depends_on_entity_map_id!==null),twoCreatorsPreserved:consumers.rowCount===2&&consumers.rows.every(row=>Number(row.created_by_id)===actorId)}
    console.log(JSON.stringify({label:'independent-actor-checks',checks:actorChecks}))
    if(Object.values(actorChecks).some(value=>!value))throw new Error('ACTOR_VERIFICATION_FAILED')
   }
   await pool.query('UPDATE tenants SET name=$1 WHERE id=$2',['Synthetic target drift',targets.tenants])
   if(stores.length===3){
    // A target conflict in group2 must leave group3 unregistered and group1 intact.
    const secondClaim=(await pool.query("SELECT m.target_id FROM migration_entity_map m JOIN migration_runs r ON r.run_id=m.run_id WHERE m.source_instance_id=$1 AND r.source_store_id='91886002' AND m.target_collection='tenants' AND m.claim_active=true",[manifest.sourceSnapshot.sourceInstance])).rows[0]
    const oldName=(await pool.query('SELECT name FROM tenants WHERE id=$1',[secondClaim.target_id])).rows[0].name
    await pool.query("UPDATE tenants SET name='Synthetic group2 conflict' WHERE id=$1",[secondClaim.target_id])
    // Restore store1 drift temporarily so the first group can finish.
    await pool.query('UPDATE tenants SET name=$1 WHERE id=$2',[store.tenants[0].name,targets.tenants])
    const largerGroupArgs=[...args];largerGroupArgs[1]='2'
    const groupBoundary=await cli('group1-last-store-blocked',largerGroupArgs)
    const boundaryBatch=groupBoundary.events.find(event=>event.status==='BATCH_READY')?.runId
    if(groupBoundary.code!==3||!boundaryBatch)throw new Error('GROUP_BOUNDARY_NOT_BLOCKED')
    const registered=(await pool.query('SELECT count(*)::int n FROM migration_import_stores WHERE batch_id=$1',[boundaryBatch.slice(5)])).rows[0].n
    if(registered!==0)throw new Error('GROUP_REGISTERED_BEFORE_ALL_PASS')
    const blocked=await cli('group2-blocked',args)
    const blockedBatch=blocked.events.find(event=>event.status==='BATCH_READY')?.runId
    if(blocked.code!==3||!blockedBatch)throw new Error('GROUP2_NOT_BLOCKED')
    const children=(await pool.query('SELECT source_store_id,state FROM migration_import_stores WHERE batch_id=$1 ORDER BY source_store_id',[blockedBatch.slice(5)])).rows
    if(children.length!==1||children[0].source_store_id!==id||children[0].state!=='VERIFIED')throw new Error('GROUP2_OR_3_WRITTEN')
    await pool.query('UPDATE tenants SET name=$1 WHERE id=$2',[oldName,secondClaim.target_id])
    if((await cli('group2-resume',['--resume',blockedBatch,'--log-dir',join(root,'logs')])).code!==0)throw new Error('GROUP2_RESUME_FAILED')
    await pool.query('UPDATE tenants SET name=$1 WHERE id=$2',['Synthetic target drift',targets.tenants])
    console.log(JSON.stringify({label:'group2-block-and-resume',passed:true}))
   }
   const drift=await cli('target-drift',[...args,'--dry-run']);if(drift.code!==3)throw new Error('TARGET_DRIFT_NOT_BLOCKED')
  }
  console.log(JSON.stringify({label:'counts',before,after:await count(),manifestPath:prepared.manifestPath}))
 }finally{await pool.end()}
}
main().catch(error=>{console.error(JSON.stringify({status:'HARNESS_FAILED',code:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'PRIVATE_LOG_REVIEW_REQUIRED'}));process.exitCode=1})
