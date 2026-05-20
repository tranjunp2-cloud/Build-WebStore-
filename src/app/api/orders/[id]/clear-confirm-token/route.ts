import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const res = NextResponse.json({ ok: true })
    res.cookies.delete(`ct_${id}`)
    return res
}
