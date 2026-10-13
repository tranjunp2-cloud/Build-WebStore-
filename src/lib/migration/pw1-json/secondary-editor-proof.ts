import type { ImportDiagnostic, ImportDocument, ImportStore } from './types'

const identity = (store:string,id:string) => JSON.stringify([store,id])
/** Require a matching source diagnostic and a mapped editor beside one tenant owner. */
export function createSecondaryEditorProof(enabled:boolean) {
  const documents=new Set<string>(),receipts=new Set<string>()
  const membership=(doc:ImportDocument,store:string,role:string) => {
    const entries=doc.tenants
    if(!Array.isArray(entries)||entries.length!==1)return false
    const entry=entries[0] as Record<string,unknown>
    return entry.tenant===`@tenants:stores:${store}`&&entry.role===role&&Array.isArray(entry.permissions)&&entry.permissions.length===0
  }
  return {
    addStore(store:ImportStore) {
      if(!enabled)return
      const users=store.collections.users
      const owners=users.filter(doc=>Array.isArray(doc.roles)&&doc.roles.length===1&&doc.roles[0]==='tenant-owner'&&membership(doc,store.storeId,'owner'))
      if(owners.length!==1)return
      for(const doc of users) {
        if(typeof doc._ref!=='string'||doc._ref===owners[0]._ref||!/^@users:users:[1-9]\d*$/.test(doc._ref))continue
        if(Array.isArray(doc.roles)&&doc.roles.length===1&&doc.roles[0]==='editor'&&membership(doc,store.storeId,'editor'))
          documents.add(identity(store.storeId,doc._ref.slice('@users:users:'.length)))
      }
    },
    addDiagnostic(d:ImportDiagnostic) {
      if(enabled&&d.storeId&&d.sourceId&&d.code==='OWNER_SECONDARY_MAPPED_EDITOR'&&d.severity==='warning'&&d.table==='users'&&d.field==='is_store_owner'&&d.reason==='PRIMARY_OWNER_SELECTED')receipts.add(identity(d.storeId,d.sourceId))
    },
    approves(d:ImportDiagnostic) {
      if(!enabled||!d.storeId||!d.sourceId||d.code!=='USER_PERMISSION_RUNTIME_PARITY_UNVERIFIED'||d.severity!=='warning'||d.table!=='users'||d.field!==undefined||d.reason!==undefined)return false
      const key=identity(d.storeId,d.sourceId)
      return documents.has(key)&&receipts.has(key)
    },
  }
}
