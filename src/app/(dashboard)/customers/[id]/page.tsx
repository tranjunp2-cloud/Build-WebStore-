import { notFound } from 'next/navigation'
import { getShopCustomerDetailAction } from '../actions'
import { CustomersDetail } from '../_components/customers-detail'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const numId = parseInt(id, 10)
    if (isNaN(numId)) notFound()

    try {
        const customer = await getShopCustomerDetailAction(numId)
        return <CustomersDetail customer={customer} />
    } catch {
        notFound()
    }
}
