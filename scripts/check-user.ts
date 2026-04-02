import { getPayload } from 'payload'
import config from '../src/payload.config'

async function run() {
    const payload = await getPayload({ config })
    const users = await payload.find({
        collection: 'users',
        where: { email: { equals: 'yangtest@yopmail.com' } }
    })
    
    if (users.docs.length > 0) {
        const u = users.docs[0]
        console.log("User Email:", u.email)
        console.log("Tenants:", JSON.stringify(u.tenants, null, 2))
    } else {
        console.log("Khong tim thay user.")
    }
    process.exit(0)
}
run().catch(console.error)
