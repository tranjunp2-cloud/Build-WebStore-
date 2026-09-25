import type { ImportDiagnostic, ImportDocument, ImportStore } from './types'

const approvedPairs = new Map([['1327','2697'],['1329','2701']])
const identity = (store:string,id:string) => JSON.stringify([store,id])
/** Only the two explicitly approved PROD secondary owners; never a generic non-owner waiver. */
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
      const id=approvedPairs.get(store.storeId)
      if(!id)return
      const users=store.collections.users
      const owners=users.filter(doc=>Array.isArray(doc.roles)&&doc.roles.length===1&&doc.roles[0]==='tenant-owner'&&membership(doc,store.storeId,'owner'))
      const candidates=users.filter(doc=>doc._ref===`@users:users:${id}`)
      if(owners.length!==1||owners[0]._ref===`@users:users:${id}`||candidates.length!==1)return
      const doc=candidates[0]
      if(Array.isArray(doc.roles)&&doc.roles.length===1&&doc.roles[0]==='editor'&&membership(doc,store.storeId,'editor'))documents.add(identity(store.storeId,id))
    },
    addDiagnostic(d:ImportDiagnostic) {
      if(enabled&&d.storeId&&d.sourceId&&approvedPairs.get(d.storeId)===d.sourceId&&d.code==='OWNER_SECONDARY_MAPPED_EDITOR'&&d.severity==='warning'&&d.table==='users'&&d.field==='is_store_owner'&&d.reason==='PRIMARY_OWNER_SELECTED')receipts.add(identity(d.storeId,d.sourceId))
    },
    approves(d:ImportDiagnostic) {
      if(!enabled||!d.storeId||!d.sourceId||d.code!=='USER_PERMISSION_RUNTIME_PARITY_UNVERIFIED'||d.severity!=='warning'||d.table!=='users'||d.field!==undefined||d.reason!==undefined)return false
      const key=identity(d.storeId,d.sourceId)
      return documents.has(key)&&receipts.has(key)
    },
  }
}
